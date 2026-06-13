"""Pub/sub event bus + control channel for live scans.

Two backends behind one interface:
- **In-memory** (default): single-process fan-out via asyncio queues. Used in
  tests and single-process dev.
- **Redis** (when `REDIS_URL` is reachable): cross-process pub/sub + history +
  control flags, so a separate worker can publish scan progress and the API
  process streams it to WebSocket clients, and pause/cancel reach the worker.

The backend is chosen lazily on first use; if Redis can't be reached we fall
back to in-memory permanently. `set_control`/`get_control`/`replay`/`publish`
are async (Redis does network I/O); call sites await them.
"""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from enum import Enum

from app.core.config import settings

# Event type names — must match what the frontend's live screen consumes.
SCAN_STARTED = "scan_started"
FILE_PARSED = "file_parsed"
SEGMENT_COMPLETED = "segment_completed"
FINDING_DISCOVERED = "finding_discovered"
MODEL_STATUS = "model_status"
SCAN_PROGRESS = "scan_progress"
SCAN_COMPLETED = "scan_completed"
SCAN_FAILED = "scan_failed"
SCAN_CANCELLED = "scan_cancelled"
SCAN_PAUSED = "scan_paused"
SCAN_RESUMED = "scan_resumed"

_HISTORY_TTL = 3600          # seconds to retain a scan's event history in Redis
_HISTORY_MAX = 2000          # cap history length
_CONTROL_TTL = 3600


class Control(str, Enum):
    RUNNING = "running"
    PAUSE = "pause"
    CANCEL = "cancel"


@dataclass
class _ScanChannel:
    subscribers: set[asyncio.Queue] = field(default_factory=set)
    control: Control = Control.RUNNING
    history: list[dict] = field(default_factory=list)
    listener: asyncio.Task | None = None  # redis bridge task, if any


class ScanEventBus:
    def __init__(self) -> None:
        self._channels: dict[str, _ScanChannel] = {}
        self._redis = None          # redis.asyncio.Redis | None
        self._redis_ready = False   # have we attempted connection?

    def _chan(self, scan_id: str) -> _ScanChannel:
        return self._channels.setdefault(scan_id, _ScanChannel())

    # ---- redis bootstrap ----
    async def _get_redis(self):
        """Lazily connect to Redis. Returns the client or None (in-memory mode)."""
        if self._redis_ready:
            return self._redis
        self._redis_ready = True
        url = settings.redis_url
        if not url:
            return None
        try:
            import redis.asyncio as aioredis
            client = aioredis.from_url(
                url, decode_responses=True,
                socket_connect_timeout=0.5, socket_timeout=2.0,
            )
            await client.ping()
            self._redis = client
        except Exception:
            self._redis = None  # unreachable -> in-memory
        return self._redis

    @staticmethod
    def _chan_key(scan_id: str) -> str:
        return f"akira:evt:{scan_id}"

    @staticmethod
    def _hist_key(scan_id: str) -> str:
        return f"akira:hist:{scan_id}"

    @staticmethod
    def _ctrl_key(scan_id: str) -> str:
        return f"akira:ctrl:{scan_id}"

    # ---- publish ----
    async def publish(self, scan_id: str, event_type: str, payload: dict | None = None) -> None:
        evt = {"type": event_type, "payload": payload or {}}
        redis = await self._get_redis()
        if redis is not None:
            raw = json.dumps(evt)
            pipe = redis.pipeline()
            pipe.rpush(self._hist_key(scan_id), raw)
            pipe.ltrim(self._hist_key(scan_id), -_HISTORY_MAX, -1)
            pipe.expire(self._hist_key(scan_id), _HISTORY_TTL)
            pipe.publish(self._chan_key(scan_id), raw)
            await pipe.execute()
            return
        # In-memory fan-out.
        chan = self._chan(scan_id)
        chan.history.append(evt)
        for q in list(chan.subscribers):
            await q.put(evt)

    # ---- subscribe ----
    async def subscribe(self, scan_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        chan = self._chan(scan_id)
        chan.subscribers.add(q)
        redis = await self._get_redis()
        if redis is not None and chan.listener is None:
            chan.listener = asyncio.create_task(self._bridge(scan_id))
        return q

    async def _bridge(self, scan_id: str) -> None:
        """Forward Redis pub/sub messages for a scan to local subscriber queues."""
        redis = await self._get_redis()
        if redis is None:
            return
        pubsub = redis.pubsub()
        await pubsub.subscribe(self._chan_key(scan_id))
        try:
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                try:
                    evt = json.loads(message["data"])
                except (ValueError, KeyError):
                    continue
                chan = self._channels.get(scan_id)
                if not chan:
                    continue
                for sub_q in list(chan.subscribers):
                    await sub_q.put(evt)
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe(self._chan_key(scan_id))
            await pubsub.aclose()

    def unsubscribe(self, scan_id: str, q: asyncio.Queue) -> None:
        chan = self._channels.get(scan_id)
        if not chan:
            return
        chan.subscribers.discard(q)
        # Stop the redis bridge when nobody's listening.
        if not chan.subscribers and chan.listener is not None:
            chan.listener.cancel()
            chan.listener = None

    async def replay(self, scan_id: str) -> list[dict]:
        redis = await self._get_redis()
        if redis is not None:
            raw = await redis.lrange(self._hist_key(scan_id), 0, -1)
            return [json.loads(r) for r in raw]
        chan = self._channels.get(scan_id)
        return list(chan.history) if chan else []

    # ---- control ----
    async def set_control(self, scan_id: str, control: Control) -> None:
        self._chan(scan_id).control = control  # local cache
        redis = await self._get_redis()
        if redis is not None:
            await redis.set(self._ctrl_key(scan_id), control.value, ex=_CONTROL_TTL)

    async def get_control(self, scan_id: str) -> Control:
        redis = await self._get_redis()
        if redis is not None:
            val = await redis.get(self._ctrl_key(scan_id))
            return Control(val) if val else Control.RUNNING
        return self._chan(scan_id).control

    async def reset(self, scan_id: str) -> None:
        """Drop a finished scan's channel/state."""
        chan = self._channels.pop(scan_id, None)
        if chan and chan.listener is not None:
            chan.listener.cancel()
        redis = await self._get_redis()
        if redis is not None:
            await redis.delete(self._hist_key(scan_id), self._ctrl_key(scan_id))


# Process-wide singleton.
bus = ScanEventBus()

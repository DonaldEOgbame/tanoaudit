"""In-process pub/sub event bus + control channel for live scans.

Single-process fan-out via asyncio queues: the scan orchestrator publishes
progress events and WebSocket handlers in the same process stream them to
clients; pause/cancel flags are read back by the orchestrator. History is kept
in memory so a late-joining client can replay what it missed.

This is a single-process design, and that's intentional: every scan runs inside
the API process (user scans as BackgroundTasks, headless scans via the in-process
maintenance loop), so the orchestrator and the WebSocket always share this bus —
live events are never lost to a process boundary. A reconnect to an
already-finished scan with no buffered events falls back to DB-derived terminal
state (see `api/scan_ws.py`).
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from enum import Enum

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


class Control(str, Enum):
    RUNNING = "running"
    PAUSE = "pause"
    CANCEL = "cancel"


@dataclass
class _ScanChannel:
    subscribers: set[asyncio.Queue] = field(default_factory=set)
    control: Control = Control.RUNNING
    history: list[dict] = field(default_factory=list)


class ScanEventBus:
    def __init__(self) -> None:
        self._channels: dict[str, _ScanChannel] = {}

    def _chan(self, scan_id: str) -> _ScanChannel:
        return self._channels.setdefault(scan_id, _ScanChannel())

    # ---- publish ----
    async def publish(self, scan_id: str, event_type: str, payload: dict | None = None) -> None:
        evt = {"type": event_type, "payload": payload or {}}
        chan = self._chan(scan_id)
        chan.history.append(evt)
        for q in list(chan.subscribers):
            await q.put(evt)

    # ---- subscribe ----
    async def subscribe(self, scan_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._chan(scan_id).subscribers.add(q)
        return q

    def unsubscribe(self, scan_id: str, q: asyncio.Queue) -> None:
        chan = self._channels.get(scan_id)
        if chan:
            chan.subscribers.discard(q)

    async def replay(self, scan_id: str) -> list[dict]:
        chan = self._channels.get(scan_id)
        return list(chan.history) if chan else []

    # ---- control ----
    async def set_control(self, scan_id: str, control: Control) -> None:
        self._chan(scan_id).control = control

    async def get_control(self, scan_id: str) -> Control:
        return self._chan(scan_id).control

    async def reset(self, scan_id: str) -> None:
        """Drop a finished scan's channel/state."""
        self._channels.pop(scan_id, None)


# Process-wide singleton.
bus = ScanEventBus()

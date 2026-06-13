"""Structured JSON logging + a per-request correlation ID.

Every request gets an `X-Request-ID` (honored from the client or generated). The
id is stored in a contextvar and attached to every log record emitted while the
request (or a scan it spawns) is in flight, so logs can be correlated.
"""
from __future__ import annotations

import json
import logging
import uuid
from contextvars import ContextVar

correlation_id: ContextVar[str | None] = ContextVar("correlation_id", default=None)


class _CorrelationFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = correlation_id.get() or "-"
        return True


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "correlation_id": getattr(record, "correlation_id", "-"),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(_JsonFormatter())
    handler.addFilter(_CorrelationFilter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)


def set_correlation_id(value: str | None = None) -> str:
    cid = value or str(uuid.uuid4())
    correlation_id.set(cid)
    return cid

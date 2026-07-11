"""MCP server (HTTP Streamable transport) mounted at /mcp.

Implements the MCP JSON-RPC 2.0 handshake and tool calls directly:
- POST /mcp  : client-to-server JSON-RPC requests
- GET  /mcp  : SSE stream (kept open; this server pushes nothing unsolicited,
               so it emits an initial comment and holds the connection)

Supported methods: initialize, notifications/initialized, tools/list,
tools/call, ping.
"""
from __future__ import annotations

import asyncio
import json

import secrets

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.core.config import settings
from app.services.mcp_tools import TOOL_DEFINITIONS, call_tool

router = APIRouter()


def _authorized(request: Request) -> bool:
    """When MCP_API_KEY is configured, require a matching bearer token."""
    if not settings.mcp_api_key:
        return True
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return False
    return secrets.compare_digest(header[7:].strip(), settings.mcp_api_key)

# Protocol versions this server supports, newest first. The server is a
# stateless request/response implementation (no server-initiated messages or
# resumable streams), which is conformant across all of these.
SUPPORTED_PROTOCOL_VERSIONS = ("2025-06-18", "2025-03-26", "2024-11-05")
PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0]
SERVER_INFO = {"name": "tanoaudit-ai", "version": "0.1.0"}


def _result(req_id, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def _error(req_id, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


async def _handle(message: dict) -> dict | None:
    method = message.get("method")
    req_id = message.get("id")
    params = message.get("params") or {}

    # Notifications (no id) — acknowledge with no response.
    if method == "notifications/initialized":
        return None

    if method == "initialize":
        # Echo the client's requested version when we support it; otherwise
        # offer our newest. The client decides whether to proceed.
        requested = params.get("protocolVersion")
        negotiated = requested if requested in SUPPORTED_PROTOCOL_VERSIONS else PROTOCOL_VERSION
        return _result(req_id, {
            "protocolVersion": negotiated,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": SERVER_INFO,
        })

    if method == "ping":
        return _result(req_id, {})

    if method == "tools/list":
        return _result(req_id, {"tools": TOOL_DEFINITIONS})

    if method == "tools/call":
        name = params.get("name")
        args = params.get("arguments") or {}
        if name not in {t["name"] for t in TOOL_DEFINITIONS}:
            return _error(req_id, -32602, f"Unknown tool: {name}")
        text = await call_tool(name, args)
        # Tool errors are returned as text content (not protocol errors), per spec.
        return _result(req_id, {
            "content": [{"type": "text", "text": text}],
            "isError": text.startswith("Error:"),
        })

    return _error(req_id, -32601, f"Method not found: {method}")


@router.post("/mcp")
async def mcp_post(request: Request):
    if not _authorized(request):
        return JSONResponse(_error(None, -32001, "Unauthorized"), status_code=401)
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(_error(None, -32700, "Parse error"), status_code=400)

    # Support both a single message and a batch.
    if isinstance(body, list):
        responses = []
        for msg in body:
            resp = await _handle(msg)
            if resp is not None:
                responses.append(resp)
        return JSONResponse(responses)

    resp = await _handle(body)
    if resp is None:
        # Notification: 202 Accepted with empty body.
        return JSONResponse(None, status_code=202)
    return JSONResponse(resp)


@router.get("/mcp")
async def mcp_sse():
    """SSE stream. This server doesn't push unsolicited messages; hold open with
    periodic comments so clients that open the stream stay connected."""
    async def stream():
        yield ": mcp stream open\n\n"
        try:
            while True:
                await asyncio.sleep(15)
                yield ": keep-alive\n\n"
        except asyncio.CancelledError:  # client disconnected
            return

    return StreamingResponse(stream(), media_type="text/event-stream")

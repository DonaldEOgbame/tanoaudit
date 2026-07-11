"""Schemas for Module 8: scoped report chat."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    # Conversation history (truncated by the client on edit/resend).
    messages: list[ChatMessage] = Field(default_factory=list)
    message: str = Field(min_length=1, max_length=4000)
    # Optional TanoAudit model tier id (see model_catalog). None -> default tier.
    tier: Optional[str] = None


class ChatInfo(BaseModel):
    """Served when the chat loads: exec summary as the first AI message."""
    executive_summary: Optional[str] = None
    message_count: int
    messages_remaining_this_hour: int

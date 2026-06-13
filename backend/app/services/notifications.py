"""Notification creation + delivery.

`notify()` respects the user's preference flags: it always creates an in-app
record (unless in-app is explicitly disabled) and sends an email when the
matching email preference is on and email delivery is configured.
"""
from __future__ import annotations

from app.core.database import SessionLocal
from app.models.notification import Notification
from app.models.user import User
from app.services.email import send_email

# Map notification type -> the user preference key that gates it.
_PREF_KEY = {
    "scan_complete": "scan_complete",
    "critical_found": "critical_found",
    "watchlist_changed": "watchlist_changed",
    "weekly_digest": "weekly_digest",
    "handoff_consumed": "scan_complete",          # piggyback; no dedicated flag
    "finding_fixed_via_claude_code": "scan_complete",
}


async def notify(
    user_id: str,
    type_: str,
    title: str,
    body: str | None = None,
    link: dict | None = None,
) -> None:
    """Create an in-app notification + optionally email, honoring preferences."""
    async with SessionLocal() as db:
        user = await db.get(User, user_id)
        if user is None:
            return
        prefs = user.notifications or {}

        # In-app (created unless the user turned in-app off).
        if prefs.get("in_app", True):
            db.add(Notification(
                user_id=user_id, type=type_, title=title, body=body, link=link,
            ))
            await db.commit()

        # Email, if the gating preference is on.
        pref_key = _PREF_KEY.get(type_, type_)
        if prefs.get(pref_key, False) and user.email:
            await send_email(user.email, title, body or title)

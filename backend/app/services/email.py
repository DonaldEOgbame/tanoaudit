"""Email delivery via SMTP. No-op (logs) when SMTP isn't configured.

Kept deliberately small and pluggable — a provider (MailerSend/SendGrid) can
replace `send_email` without touching callers.
"""
from __future__ import annotations

import logging
from email.message import EmailMessage
from email.utils import parseaddr

from app.core.config import settings

logger = logging.getLogger("akira.email")

# Records sent emails when SMTP is unconfigured — useful for tests/dev.
sent_outbox: list[dict] = []


async def _send_mailersend(to: str, subject: str, body: str) -> bool:
    import httpx
    # MailerSend wants `from` as {email, name}; smtp_from is "Name <email>".
    from_name, from_email = parseaddr(settings.smtp_from)
    from_obj: dict[str, str] = {"email": from_email or settings.smtp_from}
    if from_name:
        from_obj["name"] = from_name
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.post(
                "https://api.mailersend.com/v1/email",
                headers={"Authorization": f"Bearer {settings.mailersend_api_key}"},
                json={"from": from_obj, "to": [{"email": to}],
                      "subject": subject, "text": body},
            )
        return r.status_code < 300
    except httpx.HTTPError:
        logger.exception("MailerSend send failed to %s", to)
        return False


async def send_email(to: str, subject: str, body: str) -> bool:
    """Send an email via MailerSend (preferred) or SMTP. Returns True if dispatched.

    With neither configured, records to an in-memory outbox + logs (dev/tests).
    """
    if settings.mailersend_api_key:
        return await _send_mailersend(to, subject, body)

    if not settings.smtp_host:
        sent_outbox.append({"to": to, "subject": subject, "body": body})
        logger.info("email (not sent — no provider configured) to=%s subject=%s", to, subject)
        return False

    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    # smtplib is blocking; run it off the event loop.
    import asyncio
    import smtplib

    def _send() -> None:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)

    try:
        await asyncio.to_thread(_send)
        return True
    except Exception:  # noqa: BLE001 — email failures must not break the caller
        logger.exception("Failed to send email to %s", to)
        return False

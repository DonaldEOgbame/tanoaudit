"""Application settings, loaded from environment / .env."""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Annotated, ClassVar

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Tests set TANOAUDIT_TESTING=1 so the real .env doesn't leak into the test config.
_ENV_FILE = None if os.environ.get("TANOAUDIT_TESTING") else ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE, env_file_encoding="utf-8", extra="ignore"
    )

    # App
    app_env: str = "development"
    # True under pytest (conftest sets TANOAUDIT_TESTING=1). Used to skip the
    # in-process maintenance loop, which tests drive directly instead.
    testing: bool = bool(os.environ.get("TANOAUDIT_TESTING"))
    rate_limit_enabled: bool = True
    app_name: str = "TanoAudit"
    api_v1_prefix: str = "/api/v1"
    # NoDecode: let our comma-split validator handle the env string (otherwise
    # pydantic-settings tries to JSON-parse list fields and rejects "a,b,c").
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173", "http://localhost:3000",
        "http://127.0.0.1:5173", "http://127.0.0.1:3000",
    ]

    # Database
    database_url: str = "sqlite+aiosqlite:///./tanoaudit.db"

    # Security
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Fernet encryption key for secrets at rest
    fernet_key: str = "change-me-generate-a-real-fernet-key"

    # TOTP
    totp_issuer: str = "TanoAudit"

    # Optional bearer API key for the MCP server (/mcp). When set, every /mcp
    # request must send `Authorization: Bearer <key>`. Unset = open transport
    # (tool calls are still gated by handoff-token validation).
    mcp_api_key: str | None = None

    # Email (Module 15). When unset, emails are logged, not sent.
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str = "TanoAudit <no-reply@tanoaudit.ai>"
    # MailerSend HTTP email provider (preferred over SMTP when set).
    mailersend_api_key: str | None = None

    # Storage
    export_dir: str = "./exports"
    public_base_url: str = "https://tanoaudit.ai"

    # Where the SPA is served. Used to redirect the browser back into the app
    # after server-side OAuth callbacks (e.g. GitHub connect).
    frontend_url: str = "http://localhost:8765"

    # File cache for ZIP/URL scan sources (gives fix/implementation gen full-file
    # context). Files are removed when the scan is deleted; this is a safety TTL
    # for orphaned caches, swept by the worker.
    file_cache_ttl_days: int = 7

    # Segment batching: how many input tokens of code to pack into one analysis
    # request. Larger = fewer requests (key for tight provider rate limits, e.g.
    # Gemini free tier's 25 req/day) but bigger prompts. Set to 0 to disable
    # batching (one request per segment).
    analysis_batch_tokens: int = 6000
    # How many analysis batches to run concurrently. >1 cuts wall-clock time on
    # large scans (the LLM calls are the slow part and are independent). Keep
    # modest to respect provider rate limits; 1 = fully sequential.
    analysis_concurrency: int = 4
    # Per-request timeout (seconds) for one analysis LLM call. A batch packs many
    # segments, so a slow model can take a while on a large prompt — too low and
    # big batches time out and get dropped/retried. Bump for slow providers.
    segment_timeout_s: float = 60.0

    # --- LLM access (server-side; users never provide keys) ------------------
    # Server-held provider keys. The app uses these for every user's scans/chat;
    # there is no bring-your-own-key. Unset -> that provider is unavailable and
    # scans fall back to the empty-result placeholder (a deploy misconfig, not a
    # user state). The vendor names are internal only — users pick TanoAudit tiers.
    gemini_api_key: str | None = None
    openrouter_api_key: str | None = None

    # Concrete model id backing each user-facing TanoAudit tier (see
    # services/model_catalog.py). Env-overridable so a tier's backend can change
    # without touching stored tier ids or the UI. The vendor for each tier is
    # all on the openrouter provider; Gemini is kept only as an auto fallback).
    # The three tiers differ by segment-coverage cap, not by model.
    tier_fast_model: str = "openai/gpt-oss-120b:free"
    tier_balanced_model: str = "openai/gpt-oss-120b:free"
    tier_deep_model: str = "openai/gpt-oss-120b:free"

    # Per-provider default model ids (used when no tier model is given, e.g. the
    # llm_clients defaults). Kept in sync with the fast/balanced tiers.
    gemini_model: str = "gemini-flash-latest"
    openrouter_model: str = "openai/gpt-oss-120b:free"

    # Hard daily cap on scans per user (rolling 24h). At the cap, scan-create
    # returns 429 with the seconds until the oldest counted scan ages out.
    daily_scan_limit: int = 5

    # Per-mode daily token limits (rolling 24h). Protects shared server keys.
    daily_tokens_fast: int = 2_000_000
    daily_tokens_balanced: int = 1_000_000
    daily_tokens_deep: int = 500_000

    # GitHub OAuth app (Module 11). Without these, OAuth endpoints return a clear
    # "not configured" error; the rest of the app runs fine.
    github_client_id: str | None = None
    github_client_secret: str | None = None
    github_oauth_redirect_uri: str = "http://localhost:8000/api/v1/github/callback"
    # Separate callback for "Sign in with GitHub" (authentication, not the
    # account-linking flow above). Must be registered as a valid callback URL on
    # the GitHub OAuth app alongside github_oauth_redirect_uri.
    github_login_redirect_uri: str = "http://localhost:8000/api/v1/github/callback"

    # Google OAuth (Sign in with Google). Without these, the Google sign-in
    # endpoints return a clear "not configured" error; everything else runs fine.
    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_login_redirect_uri: str = "http://localhost:8000/api/v1/auth/google/callback"

    # Optional web-search provider(s) for custom-vuln research.
    # Tavily is the default (AI-focused, 1k free credits/mo); SerpAPI is a
    # secondary option. With neither set, research uses a deterministic stub.
    tavily_key: str | None = None
    serpapi_key: str | None = None

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    # Sample secrets shipped in .env.example — refused in production.
    _SAMPLE_JWT: ClassVar[str] = "qTCDLxME9uk_QKzfCzO1skdPd6V6MVq4mmWFUPtJ_JOTtAix4uiYteBme9rAZmrs"
    _SAMPLE_FERNET: ClassVar[str] = "r0dTkLqpgiVNT8zxh7q9ZcUotDM7FqVTGLrPE4JB_AU="

    def assert_production_safe(self) -> None:
        """Raise if running in production with the sample/placeholder secrets."""
        if not self.is_production:
            return
        bad = []
        if self.jwt_secret in (self._SAMPLE_JWT, "change-me-in-production"):
            bad.append("JWT_SECRET")
        if self.fernet_key in (self._SAMPLE_FERNET, "change-me-generate-a-real-fernet-key"):
            bad.append("FERNET_KEY")
        if bad:
            raise RuntimeError(
                f"Refusing to start in production with sample {', '.join(bad)}. "
                "Run `python -m scripts.generate_secrets` and set real values."
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

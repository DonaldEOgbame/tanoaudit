"""Application settings, loaded from environment / .env."""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Annotated, ClassVar

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Tests set AKIRA_TESTING=1 so the real .env doesn't leak into the test config.
_ENV_FILE = None if os.environ.get("AKIRA_TESTING") else ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE, env_file_encoding="utf-8", extra="ignore"
    )

    # App
    app_env: str = "development"
    rate_limit_enabled: bool = True
    app_name: str = "Akira AI"
    api_v1_prefix: str = "/api/v1"
    # NoDecode: let our comma-split validator handle the env string (otherwise
    # pydantic-settings tries to JSON-parse list fields and rejects "a,b,c").
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173", "http://localhost:3000",
    ]

    # Database
    database_url: str = "sqlite+aiosqlite:///./akira.db"

    # Security
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Fernet encryption key for secrets at rest
    fernet_key: str = "change-me-generate-a-real-fernet-key"

    # TOTP
    totp_issuer: str = "Akira AI"

    # Optional bearer API key for the MCP server (/mcp). When set, every /mcp
    # request must send `Authorization: Bearer <key>`. Unset = open transport
    # (tool calls are still gated by handoff-token validation).
    mcp_api_key: str | None = None

    # Email (Module 15). When unset, emails are logged, not sent.
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str = "Akira AI <no-reply@akira.ai>"
    # MailerSend HTTP email provider (preferred over SMTP when set).
    mailersend_api_key: str | None = None

    # Storage
    export_dir: str = "./exports"
    public_base_url: str = "https://akira.ai"

    # Redis (event bus + arq task queue)
    redis_url: str = "redis://localhost:6379/0"
    # Connect timeout (seconds) for the event-bus Redis client. Must allow for a
    # TLS handshake to a managed/remote Redis (e.g. Upstash rediss://), which can
    # take >1s — too low and the bus silently falls back to in-memory, breaking
    # cross-process live scan events while arq still works.
    redis_connect_timeout: float = 5.0
    # Task dispatch. When enabled AND Redis is reachable, scans/fixes/exports are
    # enqueued to the arq worker; otherwise they fall back to in-process
    # execution (FastAPI BackgroundTasks / the polling worker). Auto = decide by
    # Redis reachability at call time.
    arq_enabled: bool = True
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

    # LLM model IDs per provider (override to track provider releases).
    # `gemini-flash-latest` works on the free tier; `gemini-2.0-flash` has had
    # free-tier quota zeroed (limit: 0) — override via GEMINI_MODEL as needed.
    gemini_model: str = "gemini-flash-latest"
    openrouter_model: str = "anthropic/claude-3.5-haiku"
    # (Groq removed — no longer offered.)

    # GitHub OAuth app (Module 11). Without these, OAuth endpoints return a clear
    # "not configured" error; the rest of the app runs fine.
    github_client_id: str | None = None
    github_client_secret: str | None = None
    github_oauth_redirect_uri: str = "http://localhost:8000/api/v1/github/callback"

    # Demo provider keys consumed by `python -m app.seed` (stored per-user).
    demo_gemini_key: str | None = None
    demo_openrouter_key: str | None = None

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

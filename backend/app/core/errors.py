"""Consistent error types and the JSON envelope used across the API.

Success:  {"data": <payload>, "error": null}
Failure:  {"data": null, "error": {"code": "...", "message": "..."}}
"""
from __future__ import annotations

from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class APIError(Exception):
    """Raised anywhere in the app to produce a clean enveloped error response."""

    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def envelope(data: Any) -> dict:
    return {"data": data, "error": None}


def error_body(code: str, message: str) -> dict:
    return {"data": None, "error": {"code": code, "message": message}}


# Common shortcuts ------------------------------------------------------------
def not_found(message: str = "Resource not found") -> APIError:
    return APIError("not_found", message, status.HTTP_404_NOT_FOUND)


def unauthorized(message: str = "Not authenticated") -> APIError:
    return APIError("unauthorized", message, status.HTTP_401_UNAUTHORIZED)


def forbidden(message: str = "Forbidden") -> APIError:
    return APIError("forbidden", message, status.HTTP_403_FORBIDDEN)


def conflict(message: str = "Conflict") -> APIError:
    return APIError("conflict", message, status.HTTP_409_CONFLICT)


def bad_request(message: str = "Bad request") -> APIError:
    return APIError("bad_request", message, status.HTTP_400_BAD_REQUEST)


def register_exception_handlers(app) -> None:
    @app.exception_handler(APIError)
    async def _api_error(_: Request, exc: APIError):
        return JSONResponse(
            status_code=exc.status_code, content=error_body(exc.code, exc.message)
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body("http_error", str(exc.detail)),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_body("validation_error", _format_validation(exc)),
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_body("internal_error", "An unexpected error occurred"),
        )


def _format_validation(exc: RequestValidationError) -> str:
    parts = []
    for err in exc.errors():
        loc = ".".join(str(p) for p in err.get("loc", []) if p != "body")
        parts.append(f"{loc}: {err.get('msg')}" if loc else err.get("msg", "invalid"))
    return "; ".join(parts) or "Validation failed"

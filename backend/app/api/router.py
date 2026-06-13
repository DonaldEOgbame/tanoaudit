"""Aggregate v1 router. New modules register their routers here."""
from fastapi import APIRouter

from app.api import (
    auth,
    chat,
    custom_vulns,
    findings,
    fun_facts,
    github,
    handoff,
    learning,
    notifications,
    optimization_plans,
    profile,
    reports,
    scan_ws,
    scans,
    security,
    settings,
    usage,
    watchlist,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(profile.router)
api_router.include_router(security.router)
api_router.include_router(settings.router)
api_router.include_router(scans.router)
api_router.include_router(scan_ws.router)
api_router.include_router(reports.router)
api_router.include_router(findings.router)
api_router.include_router(chat.router)
api_router.include_router(custom_vulns.router)
api_router.include_router(optimization_plans.router)
api_router.include_router(watchlist.router)
api_router.include_router(github.router)
api_router.include_router(handoff.router)
api_router.include_router(learning.router)
api_router.include_router(notifications.router)
api_router.include_router(usage.router)
api_router.include_router(fun_facts.router)

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.rate_limit import RateLimitMiddleware
from .db.mongo import ensure_indexes
from .routers import baseline, extraction, invoices, reconcile, traders

app = FastAPI(title="Munshi Compliance Brain")

# The CA dashboard and client self-service portal (frontendmain/, a Vite SPA)
# call this API directly from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)

app.include_router(extraction.router)
app.include_router(baseline.router)
app.include_router(invoices.router)
app.include_router(reconcile.router)
app.include_router(traders.router)

# CA-firm B2B SaaS platform (multi-tenant, built on the same compliance brain).
# Imported lazily-tolerant: the WhatsApp pipeline still boots if its deps differ.
from .ca_platform.router import router as ca_router  # noqa: E402
from .ca_platform.client_portal import router as client_portal_router  # noqa: E402

app.include_router(ca_router)
app.include_router(client_portal_router)


@app.on_event("startup")
async def _on_startup() -> None:
    ensure_indexes()


@app.get("/health")
async def health() -> dict:
    checks = {"mongo": False, "gemini_configured": bool(os.environ.get("GEMINI_API_KEY")), "groq_configured": bool(os.environ.get("GROQ_API_KEY"))}
    try:
        from .db.mongo import get_client

        get_client().admin.command("ping")
        checks["mongo"] = True
    except Exception:
        checks["mongo"] = False
    status = "ok" if checks["mongo"] else "degraded"
    return {"status": status, "checks": checks}

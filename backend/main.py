from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import baseline, extraction, invoices, reconcile

app = FastAPI(title="Munshi Compliance Brain")

# The CA SaaS frontend (Next.js) calls this API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(extraction.router)
app.include_router(baseline.router)
app.include_router(invoices.router)
app.include_router(reconcile.router)

# CA-firm B2B SaaS platform (multi-tenant, built on the same compliance brain).
# Imported lazily-tolerant: the WhatsApp pipeline still boots if its deps differ.
from .ca_platform.router import router as ca_router  # noqa: E402

app.include_router(ca_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}

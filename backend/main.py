from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI

from .routers import baseline, extraction, invoices, reconcile

app = FastAPI(title="Munshi Compliance Brain")

app.include_router(extraction.router)
app.include_router(baseline.router)
app.include_router(invoices.router)
app.include_router(reconcile.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}

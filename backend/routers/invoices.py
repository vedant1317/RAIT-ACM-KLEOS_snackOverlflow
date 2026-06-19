from __future__ import annotations

from fastapi import APIRouter

from ..db.mongo import get_db
from ..models.schemas import ExtractedInvoice

router = APIRouter()


@router.post("/invoices/confirm")
async def confirm_invoice(trader_id: str, invoice: ExtractedInvoice) -> dict:
    """Append a trader-confirmed invoice to their repository. Called after
    the trader has reviewed/corrected the extracted fields — never persisted
    silently straight off the VLM output.
    """
    db = get_db()
    record = invoice.model_dump(mode="json")
    db.invoices.update_one(
        {"trader_id": trader_id},
        {"$push": {"records": record}},
        upsert=True,
    )
    return {"trader_id": trader_id, "stored": True}


@router.post("/invoices/reset")
async def reset_invoices(trader_id: str) -> dict:
    """Clear a trader's pending invoice batch, e.g. when starting a fresh
    reconciliation run."""
    db = get_db()
    db.invoices.update_one({"trader_id": trader_id}, {"$set": {"records": []}}, upsert=True)
    return {"trader_id": trader_id, "reset": True}

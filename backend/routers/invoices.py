from __future__ import annotations

from fastapi import APIRouter, Depends

from ..ca_platform.auth import require_service_token
from ..core.period_utils import derive_period
from ..db.mongo import get_db
from ..models.schemas import ExtractedInvoice

router = APIRouter(dependencies=[Depends(require_service_token)])


@router.post("/invoices/confirm")
async def confirm_invoice(trader_id: str, invoice: ExtractedInvoice) -> dict:
    """Append a trader-confirmed invoice to their repository. Called after
    the trader has reviewed/corrected the extracted fields — never persisted
    silently straight off the VLM output.
    """
    db = get_db()
    record = invoice.model_dump(mode="json")
    record["period"] = derive_period(record.get("invoice_date"))
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


@router.post("/invoices/confirm-batch")
async def confirm_batch(trader_id: str, invoices: list[ExtractedInvoice]) -> dict:
    """Bulk-commit a batch of invoices in one call — used after a trader
    sends several bills in a row. High-confidence invoices (``needs_review``
    false) are auto-confirmed by the caller before reaching here; this
    endpoint just persists whatever batch it's handed and reports how many
    of them still need review."""
    db = get_db()
    records = []
    for invoice in invoices:
        record = invoice.model_dump(mode="json")
        record["period"] = derive_period(record.get("invoice_date"))
        records.append(record)

    if records:
        db.invoices.update_one(
            {"trader_id": trader_id},
            {"$push": {"records": {"$each": records}}},
            upsert=True,
        )
    needs_review = sum(1 for r in records if r.get("needs_review"))
    return {"trader_id": trader_id, "saved": len(records), "needs_review": needs_review}

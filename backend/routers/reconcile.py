from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..core import explanation_service
from ..core.reconciliation_engine import reconcile
from ..db.mongo import get_db

router = APIRouter()


@router.post("/reconcile/{trader_id}")
async def run_reconciliation(trader_id: str, language: str = "Hindi") -> dict:
    db = get_db()
    invoice_doc = db.invoices.find_one({"trader_id": trader_id}) or {}
    baseline_doc = db.baselines.find_one({"trader_id": trader_id}) or {}

    invoices = invoice_doc.get("records", [])
    baseline = baseline_doc.get("records", [])

    if not invoices:
        raise HTTPException(status_code=400, detail="No confirmed invoices for this trader yet")
    if not baseline:
        raise HTTPException(status_code=400, detail="No GSTR-2B baseline uploaded for this trader yet")

    result = reconcile(trader_id, invoices, baseline)

    explanations = [
        {
            "invoice_number": m.invoice_number,
            "vendor_name": m.vendor_name,
            "type": m.type.value,
            "rupee_impact": m.rupee_impact,
            "text": explanation_service.explain_mismatch(m, language=language),
        }
        for m in result.mismatches
    ]
    headline = explanation_service.summary_headline(result.total_recoverable_or_blocked, language=language)

    return {
        "trader_id": trader_id,
        "headline": headline,
        "total_recoverable_or_blocked": result.total_recoverable_or_blocked,
        "total_invoices": result.total_invoices,
        "explanations": explanations,
    }

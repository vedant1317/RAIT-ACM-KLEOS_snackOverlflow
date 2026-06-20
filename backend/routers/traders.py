"""Trader-facing read endpoints for WhatsApp: a compact 'status' mini-card
summary and a structured facts context for the 'Ask Munshi' Q&A flow. Both
reuse the deterministic reconciliation engine — no new money math, and
Groq (on the Twilio side) only ever narrates the facts returned here.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ..ca_platform.auth import require_service_token
from ..core.reconciliation_engine import reconcile
from ..db.mongo import get_db

router = APIRouter(prefix="/traders", dependencies=[Depends(require_service_token)])


def _load(trader_id: str) -> tuple[list[dict], list[dict]]:
    db = get_db()
    invoices = (db.invoices.find_one({"trader_id": trader_id}) or {}).get("records", [])
    baseline = (db.baselines.find_one({"trader_id": trader_id}) or {}).get("records", [])
    return invoices, baseline


@router.get("/{trader_id}/summary")
async def trader_summary(trader_id: str) -> dict:
    invoices, baseline = _load(trader_id)
    if not invoices or not baseline:
        return {
            "trader_id": trader_id,
            "invoices_uploaded": len(invoices),
            "has_2b": bool(baseline),
            "itc_at_risk": 0.0,
            "issues_open": 0,
            "top_supplier": None,
            "next_action": (
                "Send your invoices and GSTR-2B file to get started."
                if not invoices
                else "Send your GSTR-2B file to run a check."
            ),
        }

    result = reconcile(trader_id, invoices, baseline)
    by_vendor: dict[str, float] = {}
    for m in result.mismatches:
        by_vendor[m.vendor_name] = by_vendor.get(m.vendor_name, 0.0) + m.rupee_impact
    top_supplier = max(by_vendor.items(), key=lambda kv: kv[1])[0] if by_vendor else None
    top_mismatch = max(result.mismatches, key=lambda m: m.rupee_impact) if result.mismatches else None

    return {
        "trader_id": trader_id,
        "invoices_uploaded": len(invoices),
        "has_2b": True,
        "itc_at_risk": result.total_recoverable_or_blocked,
        "issues_open": len(result.mismatches),
        "top_supplier": top_supplier,
        "next_action": (
            top_mismatch.details.get("recommendation")
            if top_mismatch
            else "No issues found — you're all clear this month."
        ),
    }


@router.get("/{trader_id}/context")
async def trader_context(trader_id: str) -> dict:
    """Structured, already-computed facts for the 'Ask Munshi' Q&A flow —
    Groq narrates from this; it never recalculates a number itself."""
    invoices, baseline = _load(trader_id)
    if not invoices or not baseline:
        return {"trader_id": trader_id, "has_data": False, "mismatches": []}

    result = reconcile(trader_id, invoices, baseline)
    return {
        "trader_id": trader_id,
        "has_data": True,
        "total_invoices": result.total_invoices,
        "total_recoverable_or_blocked": result.total_recoverable_or_blocked,
        "mismatches": [
            {
                "invoice_number": m.invoice_number,
                "vendor_name": m.vendor_name,
                "vendor_gstin": m.vendor_gstin,
                "type": m.type.value,
                "rupee_impact": m.rupee_impact,
                "recommendation": m.details.get("recommendation"),
            }
            for m in result.mismatches
        ],
    }

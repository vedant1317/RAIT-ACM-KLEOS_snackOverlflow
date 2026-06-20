"""CA knowledge graph — adjacency-style JSON views over existing Mongo data
(firm -> client -> supplier -> invoice -> issue -> action/status ->
HSN/category). No graph database in v1; this is plain Mongo aggregation,
enabling queries like "which clients does this supplier affect" or "what are
this client's riskiest HSN codes" without a dedicated graph store.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from . import store
from .auth import require_ca_auth

router = APIRouter()


@router.get("/graph/supplier/{gstin}")
async def supplier_graph(gstin: str, _user: dict = Depends(require_ca_auth)) -> dict:
    supplier = store.get_supplier(gstin)
    if supplier is None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    issues = store.list_issues(vendor_gstin=gstin)
    client_ids = supplier.get("client_ids", [])
    clients = [{"client_id": cid, "client_name": (store.get_client(cid) or {}).get("name", cid)} for cid in client_ids]

    hsn_codes = sorted(
        {
            inv.get("hsn_code")
            for cid in client_ids
            for inv in store.list_invoices(cid)
            if inv.get("hsn_code") and str(inv.get("vendor_gstin", "")).strip().upper() == gstin.strip().upper()
        }
    )

    by_type: dict[str, int] = {}
    for issue in issues:
        by_type[issue["type"]] = by_type.get(issue["type"], 0) + 1

    return {
        "supplier": supplier,
        "clients": clients,
        "hsn_codes": hsn_codes,
        "issues": issues,
        "issue_type_breakdown": by_type,
        "total_itc_at_risk": float(round(sum(i["rupee_impact"] for i in issues), 2)),
    }


@router.get("/graph/client/{client_id}")
async def client_graph(client_id: str, _user: dict = Depends(require_ca_auth)) -> dict:
    client = store.get_client(client_id)
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    issues = store.list_issues(client_id=client_id)
    supplier_gstins = sorted({i["vendor_gstin"] for i in issues})
    suppliers = [s for s in (store.get_supplier(g) for g in supplier_gstins) if s]

    hsn_breakdown: dict[str, int] = {}
    for invoice in store.list_invoices(client_id):
        code = invoice.get("hsn_code")
        if code:
            hsn_breakdown[code] = hsn_breakdown.get(code, 0) + 1
    top_hsn = sorted(hsn_breakdown.items(), key=lambda kv: -kv[1])[:5]

    return {
        "client": client,
        "suppliers": suppliers,
        "issues": issues,
        "top_hsn_codes": [{"hsn_code": code, "invoice_count": count} for code, count in top_hsn],
    }

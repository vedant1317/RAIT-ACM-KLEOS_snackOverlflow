"""Cross-client vendor compliance scorecard — firm-wide supplier risk
visibility, built from every persisted issue (``ca_issues``) grouped by
``vendor_gstin`` across all clients and periods.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from . import store
from .auth import require_ca_auth

router = APIRouter()

_RED_REPEAT_CLIENTS = 2
_RED_UNRESOLVED_THRESHOLD = 10_000.0
_YELLOW_UNRESOLVED_THRESHOLD = 2_000.0


def _rating(missing_from_2b_count: int, clients_affected: int, unresolved_amount: float) -> str:
    if missing_from_2b_count > 0 and clients_affected >= _RED_REPEAT_CLIENTS:
        return "red"
    if unresolved_amount >= _RED_UNRESOLVED_THRESHOLD:
        return "red"
    if missing_from_2b_count > 0 or unresolved_amount >= _YELLOW_UNRESOLVED_THRESHOLD:
        return "yellow"
    return "green"


def build_scorecard(issues: list[dict]) -> list[dict]:
    by_gstin: dict[str, list[dict]] = {}
    for issue in issues:
        by_gstin.setdefault(issue["vendor_gstin"], []).append(issue)

    cards = []
    for gstin, vendor_issues in by_gstin.items():
        supplier = store.get_supplier(gstin) or {}
        clients_affected = sorted({i["client_id"] for i in vendor_issues})
        missing_from_2b = sum(1 for i in vendor_issues if i["type"] == "missing_from_2b")
        amount_or_hsn = sum(1 for i in vendor_issues if i["type"] in ("amount_diff", "hsn_mismatch"))
        unresolved = sum(i["rupee_impact"] for i in vendor_issues if i["status"] in ("open", "chasing"))
        total_at_risk = sum(i["rupee_impact"] for i in vendor_issues)
        client_names = {c: (store.get_client(c) or {}).get("name", c) for c in clients_affected}
        latest_issue_at = max((i["last_seen_at"] for i in vendor_issues), default=None)

        cards.append(
            {
                "vendor_gstin": gstin,
                "vendor_name": supplier.get("name") or vendor_issues[0]["vendor_name"],
                "rating": _rating(missing_from_2b, len(clients_affected), unresolved),
                "clients_affected": len(clients_affected),
                "top_affected_clients": [client_names[c] for c in clients_affected[:5]],
                "issue_count": len(vendor_issues),
                "missing_from_2b_count": missing_from_2b,
                "amount_or_hsn_issue_count": amount_or_hsn,
                "total_itc_at_risk": float(round(total_at_risk, 2)),
                "unresolved_amount": float(round(unresolved, 2)),
                "latest_issue_at": latest_issue_at,
            }
        )

    cards.sort(key=lambda c: c["unresolved_amount"], reverse=True)
    return cards


def scorecard_for_firm() -> list[dict]:
    return build_scorecard(store.list_issues())


def scorecard_for_client(client_id: str) -> list[dict]:
    return build_scorecard(store.list_issues(client_id=client_id))


def _paginate(items: list[dict], limit: int | None, offset: int) -> dict:
    offset = max(offset, 0)
    page = items[offset : offset + limit] if limit is not None else items[offset:]
    return {"items": page, "total": len(items), "limit": limit, "offset": offset}


@router.get("/vendors")
async def list_vendor_scorecard(
    limit: int | None = None, offset: int = 0, _user: dict = Depends(require_ca_auth)
) -> dict:
    return _paginate(scorecard_for_firm(), limit, offset)


@router.get("/clients/{client_id}/vendors")
async def list_client_vendor_scorecard(
    client_id: str, limit: int | None = None, offset: int = 0, _user: dict = Depends(require_ca_auth)
) -> dict:
    return _paginate(scorecard_for_client(client_id), limit, offset)

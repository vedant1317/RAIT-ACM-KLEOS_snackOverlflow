"""Deterministic "what if this gets fixed?" simulator.

Given a set of issue keys to hypothetically resolve, computes the resulting
ITC recovered/open totals and a projected health-score delta. Pure
arithmetic over already-persisted issue data — never AI, never a new
rupee figure that didn't already come from the matching engine.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from . import service, store
from .auth import require_ca_auth

router = APIRouter()


class SimulateIn(BaseModel):
    issue_keys: list[str]


def simulate(client_id: str, issue_keys: list[str]) -> dict:
    current = service.issues_summary(client_id=client_id)
    all_issues = {i["id"]: i for i in store.list_issues(client_id=client_id)}

    resolved_amount = 0.0
    not_found: list[str] = []
    already_resolved: list[str] = []
    for key in issue_keys:
        issue = all_issues.get(key)
        if issue is None:
            not_found.append(key)
            continue
        if issue["status"] == "resolved":
            already_resolved.append(key)
            continue
        resolved_amount += issue["rupee_impact"]

    projected_open = max(0.0, current["itc_still_open"] - resolved_amount)
    projected_recovered = current["itc_recovered"] + resolved_amount

    last_run = store.latest_reconciliation_run(client_id)
    health_before = last_run["summary"]["health_score"] if last_run else 100
    total_at_risk = last_run["summary"]["itc_at_risk"] if last_run else 0.0
    risk_ratio_before = min(current["itc_still_open"] / total_at_risk, 1.0) if total_at_risk else 0.0
    risk_ratio_after = min(projected_open / total_at_risk, 1.0) if total_at_risk else 0.0
    health_after = min(100, round(health_before + (risk_ratio_before - risk_ratio_after) * 50))

    vendors_affected = sorted({all_issues[k]["vendor_gstin"] for k in issue_keys if k in all_issues})

    return {
        "client_id": client_id,
        "issue_keys_requested": issue_keys,
        "issue_keys_not_found": not_found,
        "issue_keys_already_resolved": already_resolved,
        "itc_recovered_before": current["itc_recovered"],
        "itc_recovered_after": float(round(projected_recovered, 2)),
        "itc_open_before": current["itc_still_open"],
        "itc_open_after": float(round(projected_open, 2)),
        "health_score_before": health_before,
        "health_score_after": health_after,
        "vendors_affected": vendors_affected,
    }


@router.post("/clients/{client_id}/simulate")
async def simulate_endpoint(client_id: str, payload: SimulateIn, _user: dict = Depends(require_ca_auth)) -> dict:
    if not store.client_exists(client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    return simulate(client_id, payload.issue_keys)

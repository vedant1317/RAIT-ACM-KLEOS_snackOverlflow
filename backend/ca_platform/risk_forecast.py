"""Supplier risk forecasting — rule-based v1 over multi-period issue
history already in ``ca_issues``. No ML; ``risk_score`` is a deterministic,
explainable weighted sum so a CA can see exactly why a vendor is flagged.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from . import store, vendor_scorecard
from .auth import require_ca_auth

router = APIRouter()

_WEIGHTS = {
    "missing_from_2b_repeat": 30,
    "multi_client": 20,
    "high_unresolved": 25,
    "high_frequency": 15,
    "recent_trend_up": 10,
}
_HIGH_UNRESOLVED_THRESHOLD = 5_000.0
_HIGH_FREQUENCY_COUNT = 3


def _forecast_for_vendor(card: dict, vendor_issues: list[dict]) -> dict:
    reason_codes: list[str] = []
    score = 0

    if card["missing_from_2b_count"] >= 2:
        score += _WEIGHTS["missing_from_2b_repeat"]
        reason_codes.append("missing_from_2b_repeat")

    if card["clients_affected"] >= 2:
        score += _WEIGHTS["multi_client"]
        reason_codes.append("multi_client")

    if card["unresolved_amount"] >= _HIGH_UNRESOLVED_THRESHOLD:
        score += _WEIGHTS["high_unresolved"]
        reason_codes.append("high_unresolved")

    if card["issue_count"] >= _HIGH_FREQUENCY_COUNT:
        score += _WEIGHTS["high_frequency"]
        reason_codes.append("high_frequency")

    periods = sorted({i["period"] for i in vendor_issues})
    if len(periods) >= 2:
        recent_count = sum(1 for i in vendor_issues if i["period"] == periods[-1])
        earlier_count = sum(1 for i in vendor_issues if i["period"] == periods[-2])
        if recent_count > earlier_count:
            score += _WEIGHTS["recent_trend_up"]
            reason_codes.append("recent_trend_up")

    score = min(100, score)
    if score >= 60:
        level = "high"
        action = f"Flag {card['vendor_name']} for review before accepting new invoices this period."
    elif score >= 30:
        level = "medium"
        action = f"Send a compliance reminder to {card['vendor_name']} and monitor next period's filing."
    else:
        level = "low"
        action = f"No action needed for {card['vendor_name']} right now."

    return {
        "vendor_gstin": card["vendor_gstin"],
        "vendor_name": card["vendor_name"],
        "risk_score": score,
        "risk_level": level,
        "reason_codes": reason_codes,
        "recommended_action": action,
    }


def _forecast(issues: list[dict]) -> list[dict]:
    by_gstin: dict[str, list[dict]] = {}
    for issue in issues:
        by_gstin.setdefault(issue["vendor_gstin"], []).append(issue)
    cards = {c["vendor_gstin"]: c for c in vendor_scorecard.build_scorecard(issues)}
    forecasts = [_forecast_for_vendor(cards[gstin], vendor_issues) for gstin, vendor_issues in by_gstin.items()]
    forecasts.sort(key=lambda f: f["risk_score"], reverse=True)
    return forecasts


def forecast_for_firm() -> list[dict]:
    return _forecast(store.list_issues())


def forecast_for_client(client_id: str) -> list[dict]:
    return _forecast(store.list_issues(client_id=client_id))


@router.get("/vendors/forecast")
async def vendors_forecast(_user: dict = Depends(require_ca_auth)) -> list[dict]:
    return forecast_for_firm()


@router.get("/clients/{client_id}/vendors/forecast")
async def client_vendors_forecast(client_id: str, _user: dict = Depends(require_ca_auth)) -> list[dict]:
    return forecast_for_client(client_id)

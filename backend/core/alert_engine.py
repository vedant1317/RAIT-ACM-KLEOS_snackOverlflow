"""Event-based alerts for traders/CAs.

Built entirely from state the deterministic engines have already produced
(reconciliation summaries, the ITC recovery tracker, the vendor scorecard,
the static GST timeline) — no new rupee computation happens here, alerts
only react to numbers other modules already settled.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from ..ca_platform import store, vendor_scorecard
from . import gst_timeline
from .period_utils import current_period

_ITC_AT_RISK_THRESHOLD = float(os.environ.get("ALERT_ITC_AT_RISK_THRESHOLD", "5000"))
_ISSUE_STALE_DAYS = int(os.environ.get("ALERT_ISSUE_STALE_DAYS", "14"))
_FILING_DEADLINE_DAYS = int(os.environ.get("ALERT_FILING_DEADLINE_DAYS", "5"))
_LOW_CONFIDENCE_DAYS = int(os.environ.get("ALERT_LOW_CONFIDENCE_DAYS", "3"))
_RISK_JUMP_RATIO = 1.25


def _days_since(iso_timestamp: str) -> float:
    then = datetime.fromisoformat(iso_timestamp)
    if then.tzinfo is None:
        then = then.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - then).total_seconds() / 86400


def _raise(client_id: str, alert_type: str, severity: str, message: str, key: str, **data) -> dict | None:
    if store.find_open_alert(client_id, alert_type, key) is not None:
        return None
    return store.insert_alert(
        {
            "firm_id": store.FIRM_ID,
            "client_id": client_id,
            "type": alert_type,
            "severity": severity,
            "message": message,
            "data": {"key": key, **data},
        }
    )


def evaluate_client(client_id: str) -> list[dict]:
    client = store.get_client(client_id)
    if client is None:
        return []
    raised: list[dict] = []

    history = store.list_reconciliation_runs(client_id, limit=2)
    if history:
        last_run = history[0]
        summary = last_run["summary"]

        if summary["itc_at_risk"] >= _ITC_AT_RISK_THRESHOLD:
            alert = _raise(
                client_id,
                "itc_at_risk_high",
                "high",
                f"{client['name']}: Rs.{summary['itc_at_risk']:,.0f} of ITC is at risk this period.",
                key=f"itc_at_risk:{last_run['period']}",
            )
            if alert:
                raised.append(alert)

        if len(history) == 2:
            previous_risk = history[1]["summary"]["itc_at_risk"]
            current_risk = summary["itc_at_risk"]
            if previous_risk and current_risk > previous_risk * _RISK_JUMP_RATIO:
                alert = _raise(
                    client_id,
                    "risk_changed_after_upload",
                    "medium",
                    f"{client['name']}: ITC at risk jumped from Rs.{previous_risk:,.0f} to "
                    f"Rs.{current_risk:,.0f} after the latest GSTR-2B upload.",
                    key=f"risk_jump:{last_run['run_at']}",
                )
                if alert:
                    raised.append(alert)

    for issue in store.list_issues(client_id=client_id, status="open"):
        age_days = _days_since(issue["first_seen_at"])
        if age_days >= _ISSUE_STALE_DAYS:
            alert = _raise(
                client_id,
                "issue_stale",
                "medium",
                f"{client['name']}: invoice {issue['invoice_number']} ({issue['vendor_name']}) has been "
                f"unresolved for {int(age_days)} days.",
                key=f"stale:{issue['id']}",
            )
            if alert:
                raised.append(alert)

    for invoice in (i for i in store.list_invoices(client_id) if i.get("needs_review")):
        age_days = _days_since(invoice["added_at"])
        if age_days >= _LOW_CONFIDENCE_DAYS:
            alert = _raise(
                client_id,
                "low_confidence_pending",
                "low",
                f"{client['name']}: invoice {invoice.get('invoice_number', '(unknown)')} has needed "
                f"review for {int(age_days)} days.",
                key=f"low_conf:{invoice['id']}",
            )
            if alert:
                raised.append(alert)

    for card in vendor_scorecard.scorecard_for_client(client_id):
        if card["rating"] == "red":
            alert = _raise(
                client_id,
                "vendor_red_rated",
                "high",
                f"{client['name']}: supplier {card['vendor_name']} is red-rated "
                f"(Rs.{card['unresolved_amount']:,.0f} unresolved, {card['clients_affected']} client(s) affected).",
                key=f"vendor_red:{card['vendor_gstin']}",
            )
            if alert:
                raised.append(alert)
        elif card["issue_count"] > 1:
            alert = _raise(
                client_id,
                "vendor_repeat_issue",
                "medium",
                f"{client['name']}: supplier {card['vendor_name']} has triggered {card['issue_count']} "
                "issues — repeat offender.",
                key=f"vendor_repeat:{card['vendor_gstin']}",
            )
            if alert:
                raised.append(alert)

    deadline_events = gst_timeline.upcoming_events(current_period(), client.get("filing_frequency", "monthly"))
    deadline = next((e for e in deadline_events if e["key"] == "filing_deadline"), None)
    if deadline and 0 <= deadline["days_remaining"] <= _FILING_DEADLINE_DAYS:
        alert = _raise(
            client_id,
            "filing_deadline_near",
            "high",
            f"{client['name']}: GSTR-3B filing deadline is in {deadline['days_remaining']} day(s) "
            f"({deadline['due_date']}).",
            key=f"deadline:{deadline['due_date']}",
        )
        if alert:
            raised.append(alert)

    return raised


def evaluate_all() -> list[dict]:
    raised: list[dict] = []
    for client in store.list_clients():
        raised.extend(evaluate_client(client["id"]))
    return raised

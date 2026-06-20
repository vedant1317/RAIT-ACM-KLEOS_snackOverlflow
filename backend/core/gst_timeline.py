"""Static GST compliance calendar — no live GST-portal dependency.

Generates a configurable sequence of compliance events for a filing period
(collect invoices -> upload GSTR-2B -> reconcile -> chase suppliers ->
filing deadline -> review unresolved issues) from well-known statutory due
dates, not a portal fetch.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date


def _add_months(d: date, months: int) -> date:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    day = min(d.day, monthrange(year, month)[1])
    return date(year, month, day)


def _period_start(period: str) -> date:
    year, month = (int(x) for x in period.split("-"))
    return date(year, month, 1)


def _day(d: date, day: int) -> date:
    return d.replace(day=min(day, monthrange(d.year, d.month)[1]))


def events_for_period(period: str, filing_frequency: str = "monthly") -> list[dict]:
    """Standard compliance calendar for one GST period (``YYYY-MM``)."""
    start = _period_start(period)
    next_month = _add_months(start, 1)
    is_monthly = filing_frequency != "quarterly"

    return [
        {
            "key": "collect_invoices",
            "title": "Collect all invoices for the period",
            "due_date": _day(next_month, 5).isoformat(),
        },
        {
            "key": "upload_gstr2b",
            "title": "Download & upload GSTR-2B from the portal",
            "due_date": _day(next_month, 14).isoformat(),
        },
        {
            "key": "reconcile",
            "title": "Run reconciliation against GSTR-2B",
            "due_date": _day(next_month, 16).isoformat(),
        },
        {
            "key": "chase_suppliers",
            "title": "Chase suppliers for missing/mismatched invoices",
            "due_date": _day(next_month, 18).isoformat(),
        },
        {
            "key": "filing_deadline",
            "title": "GSTR-3B filing deadline" if is_monthly else "Quarterly GSTR-3B filing deadline",
            "due_date": _day(next_month, 20 if is_monthly else 22).isoformat(),
        },
        {
            "key": "review_unresolved",
            "title": "Review unresolved issues before next period closes",
            "due_date": _day(next_month, 25).isoformat(),
        },
    ]


def upcoming_events(period: str, filing_frequency: str = "monthly", today: date | None = None) -> list[dict]:
    today = today or date.today()
    out = []
    for event in events_for_period(period, filing_frequency):
        due = date.fromisoformat(event["due_date"])
        out.append({**event, "period": period, "days_remaining": (due - today).days, "is_overdue": due < today})
    return out

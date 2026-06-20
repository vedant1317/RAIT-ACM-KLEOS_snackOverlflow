from __future__ import annotations

from datetime import date

from backend.core import gst_timeline


def test_events_for_monthly_period_have_expected_keys_and_order():
    events = gst_timeline.events_for_period("2026-05", "monthly")
    keys = [e["key"] for e in events]
    assert keys == [
        "collect_invoices",
        "upload_gstr2b",
        "reconcile",
        "chase_suppliers",
        "filing_deadline",
        "review_unresolved",
    ]
    filing = next(e for e in events if e["key"] == "filing_deadline")
    assert filing["due_date"] == "2026-06-20"


def test_quarterly_filing_deadline_differs_from_monthly():
    monthly_deadline = next(e for e in gst_timeline.events_for_period("2026-05", "monthly") if e["key"] == "filing_deadline")
    quarterly_deadline = next(e for e in gst_timeline.events_for_period("2026-05", "quarterly") if e["key"] == "filing_deadline")
    assert monthly_deadline["due_date"] != quarterly_deadline["due_date"]


def test_upcoming_events_marks_overdue_relative_to_today():
    events = gst_timeline.upcoming_events("2020-01", "monthly", today=date(2026, 1, 1))
    assert all(e["is_overdue"] for e in events)
    assert all(e["days_remaining"] < 0 for e in events)

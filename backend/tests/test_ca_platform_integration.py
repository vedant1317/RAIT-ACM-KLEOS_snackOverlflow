"""Integration tests against the real MongoDB instance (the project's only
datastore for the CA platform — there is no JSON-file fallback to test
against anymore). Each test creates its own throwaway, clearly-namespaced
client and tears it down afterwards so this never touches the seeded demo
data. Unlike test_reconciliation.py/test_ca_matching.py, these are not
zero-dependency: ``run_reconcile`` narrates flagged rows via Groq, so a
configured GROQ_API_KEY (with graceful template fallback if it fails) is
exercised here.
"""

from __future__ import annotations

import pytest

from backend.ca_platform import service, simulator, store, vendor_scorecard

_TEST_CLIENT_ID = "test_client_pytest_temp"


@pytest.fixture
def fake_client():
    store.insert_client(
        {
            "id": _TEST_CLIENT_ID,
            "firm_id": "firm_demo",
            "name": "Pytest Temp Client",
            "gstin": "",
            "industry": "",
            "contact_name": "",
            "contact_phone": "",
            "erp_system": "",
            "filing_frequency": "monthly",
            "created_at": store.now(),
        }
    )
    try:
        yield _TEST_CLIENT_ID
    finally:
        db = store.get_db()
        db.ca_clients.delete_one({"_id": _TEST_CLIENT_ID})
        db.ca_invoices.delete_many({"client_id": _TEST_CLIENT_ID})
        db.ca_baselines.delete_many({"client_id": _TEST_CLIENT_ID})
        db.ca_reconciliation_runs.delete_many({"client_id": _TEST_CLIENT_ID})
        db.ca_issues.delete_many({"client_id": _TEST_CLIENT_ID})
        db.ca_audit_logs.delete_many({"client_id": _TEST_CLIENT_ID})


def test_issue_status_lifecycle_survives_a_second_reconciliation_run(fake_client):
    invoices = [
        {
            "vendor_name": "Pytest Vendor",
            "vendor_gstin": "27PYTST1234A1Z5",
            "invoice_number": "PT-1",
            "invoice_date": "2026-05-01",
            "taxable_value": 10000.0,
            "gst_rate": 5.0,  # matches HSN 1006's official rate -> no extra hsn_mismatch issue
            "gst_amount": 500.0,
            "hsn_code": "1006",
        }
    ]
    service.add_invoices(fake_client, invoices, source="manual")

    run = service.run_reconcile(fake_client, language="English")
    assert run["summary"]["missing_in_2b"] == 1  # no baseline uploaded yet

    issues = service.list_issues(client_id=fake_client)
    assert len(issues) == 1
    assert issues[0]["status"] == "open"
    issue_key = issues[0]["id"]

    updated = service.update_issue_status(issue_key, "chasing", "called the vendor", "pytest")
    assert updated["status"] == "chasing"
    assert updated["note"] == "called the vendor"

    service.run_reconcile(fake_client, language="English")
    issues_after = service.list_issues(client_id=fake_client)
    assert issues_after[0]["status"] == "chasing"

    with pytest.raises(ValueError):
        service.update_issue_status(issue_key, "not_a_real_status", "", "pytest")


def test_reconciliation_runs_are_kept_not_overwritten(fake_client):
    invoices = [
        {
            "vendor_name": "Pytest Vendor",
            "vendor_gstin": "27PYTST1234A1Z5",
            "invoice_number": "PT-X",
            "invoice_date": "2026-05-01",
            "taxable_value": 1000.0,
            "gst_rate": 18.0,
            "gst_amount": 180.0,
            "hsn_code": "1006",
        }
    ]
    service.add_invoices(fake_client, invoices, source="manual")
    service.run_reconcile(fake_client, language="English")
    service.run_reconcile(fake_client, language="English")

    history = service.reconciliation_history(fake_client)
    assert len(history) == 2


def test_simulator_resolving_issue_reduces_open_total_and_increases_recovered(fake_client):
    invoices = [
        {
            "vendor_name": "Pytest Vendor",
            "vendor_gstin": "27PYTST1234A1Z5",
            "invoice_number": "PT-2",
            "invoice_date": "2026-05-01",
            "taxable_value": 5000.0,
            "gst_rate": 18.0,
            "gst_amount": 900.0,
            "hsn_code": "1006",
        }
    ]
    service.add_invoices(fake_client, invoices, source="manual")
    service.run_reconcile(fake_client, language="English")
    issue_key = service.list_issues(client_id=fake_client)[0]["id"]

    before = service.issues_summary(client_id=fake_client)
    result = simulator.simulate(fake_client, [issue_key])

    assert result["itc_open_before"] == before["itc_still_open"]
    assert result["itc_open_after"] == pytest.approx(before["itc_still_open"] - 900.0)
    assert result["itc_recovered_after"] == pytest.approx(before["itc_recovered"] + 900.0)
    assert result["itc_open_after"] >= 0


def test_simulator_reports_unknown_issue_keys(fake_client):
    result = simulator.simulate(fake_client, ["not_a_real_issue_key"])
    assert result["issue_keys_not_found"] == ["not_a_real_issue_key"]
    assert result["itc_open_after"] == result["itc_open_before"]


def test_vendor_scorecard_flags_repeat_offender_across_clients():
    issues = [
        {
            "id": "k1",
            "client_id": "synthetic_client_a",
            "vendor_gstin": "27REPEAT0000A1Z5",
            "vendor_name": "Repeat Vendor",
            "invoice_number": "RA-1",
            "type": "missing_from_2b",
            "period": "2026-05",
            "rupee_impact": 6000.0,
            "status": "open",
            "last_seen_at": "2026-05-01T00:00:00+00:00",
        },
        {
            "id": "k2",
            "client_id": "synthetic_client_b",
            "vendor_gstin": "27REPEAT0000A1Z5",
            "vendor_name": "Repeat Vendor",
            "invoice_number": "RB-1",
            "type": "missing_from_2b",
            "period": "2026-05",
            "rupee_impact": 4000.0,
            "status": "open",
            "last_seen_at": "2026-05-02T00:00:00+00:00",
        },
    ]
    cards = vendor_scorecard.build_scorecard(issues)
    assert len(cards) == 1
    card = cards[0]
    assert card["rating"] == "red"
    assert card["clients_affected"] == 2
    assert card["unresolved_amount"] == 10000.0


def test_vendor_scorecard_clean_vendor_rated_green():
    issues = [
        {
            "id": "k3",
            "client_id": "synthetic_client_c",
            "vendor_gstin": "27CLEAN00000A1Z5",
            "vendor_name": "Clean Vendor",
            "invoice_number": "RC-1",
            "type": "hsn_mismatch",
            "period": "2026-05",
            "rupee_impact": 50.0,
            "status": "resolved",
            "last_seen_at": "2026-05-01T00:00:00+00:00",
        }
    ]
    cards = vendor_scorecard.build_scorecard(issues)
    assert cards[0]["rating"] == "green"
    assert cards[0]["unresolved_amount"] == 0.0

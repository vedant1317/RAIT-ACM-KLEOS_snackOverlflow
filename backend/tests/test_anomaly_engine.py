from __future__ import annotations

from backend.core import anomaly_engine


def test_round_number_invoice_flagged():
    inv = {
        "vendor_gstin": "27ABCFA1234A1Z5",
        "invoice_number": "INV-1",
        "vendor_name": "ABC",
        "taxable_value": 10000,
        "gst_rate": 18,
    }
    anomalies = anomaly_engine.check_invoice(inv)
    assert any(a["type"] == "round_number_invoice" for a in anomalies)


def test_clean_invoice_has_no_anomalies():
    inv = {
        "vendor_gstin": "27ABCFA1234A1Z5",
        "invoice_number": "INV-1001",
        "vendor_name": "ABC",
        "taxable_value": 10337,
        "gst_rate": 18,
    }
    assert anomaly_engine.check_invoice(inv) == []


def test_gstin_format_typo_flagged():
    inv = {"vendor_gstin": "NOTAGSTIN", "invoice_number": "INV-1", "vendor_name": "ABC", "taxable_value": 1234, "gst_rate": 18}
    anomalies = anomaly_engine.check_invoice(inv)
    assert any(a["type"] == "gstin_format_typo" for a in anomalies)


def test_non_standard_gst_rate_flagged():
    inv = {"vendor_gstin": "27ABCFA1234A1Z5", "invoice_number": "INV-1", "vendor_name": "ABC", "taxable_value": 1234, "gst_rate": 19.5}
    anomalies = anomaly_engine.check_invoice(inv)
    assert any(a["type"] == "non_standard_gst_rate" for a in anomalies)


def test_similar_invoice_number_detected_within_same_vendor():
    inv_a = {"vendor_gstin": "27ABCFA1234A1Z5", "invoice_number": "INV-1001", "vendor_name": "ABC", "taxable_value": 1234, "gst_rate": 18}
    inv_b = {"vendor_gstin": "27ABCFA1234A1Z5", "invoice_number": "INV-1002", "vendor_name": "ABC", "taxable_value": 1234, "gst_rate": 18}
    anomalies = anomaly_engine.check_invoice(inv_a, siblings=[inv_a, inv_b])
    assert any(a["type"] == "similar_invoice_number" for a in anomalies)


def test_vendor_name_changed_detected_for_same_gstin():
    inv_a = {"vendor_gstin": "27ABCFA1234A1Z5", "invoice_number": "INV-1001", "vendor_name": "ABC Traders", "taxable_value": 1234, "gst_rate": 18}
    inv_b = {"vendor_gstin": "27ABCFA1234A1Z5", "invoice_number": "INV-2002", "vendor_name": "ABC Pvt Ltd", "taxable_value": 1234, "gst_rate": 18}
    anomalies = anomaly_engine.check_invoice(inv_a, siblings=[inv_a, inv_b])
    assert any(a["type"] == "vendor_name_changed" for a in anomalies)


def test_potentially_blocked_credit_flagged_for_known_hsn():
    inv = {
        "vendor_gstin": "27ABCFA1234A1Z5",
        "invoice_number": "INV-1",
        "vendor_name": "ABC",
        "taxable_value": 1234,
        "gst_rate": 28,
        "hsn_code": "8703",
    }
    anomalies = anomaly_engine.check_invoice(inv)
    assert any(a["type"] == "potentially_blocked_credit" for a in anomalies)


def test_group_by_gstin_groups_correctly():
    invoices = [
        {"vendor_gstin": "27AAA0000A1Z5", "invoice_number": "A-1"},
        {"vendor_gstin": "27aaa0000a1z5", "invoice_number": "A-2"},  # same GSTIN, different case
        {"vendor_gstin": "27BBB0000B1Z5", "invoice_number": "B-1"},
        {"vendor_gstin": "", "invoice_number": "NO-GSTIN"},
    ]
    groups = anomaly_engine.group_by_gstin(invoices)
    assert len(groups["27AAA0000A1Z5"]) == 2
    assert len(groups["27BBB0000B1Z5"]) == 1
    assert "" not in groups

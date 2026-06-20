from __future__ import annotations

from backend.core.extraction_service import _assess_confidence, _RawExtraction


def _raw(**overrides) -> _RawExtraction:
    base = dict(
        vendor_name="ABC Traders",
        vendor_gstin="27ABCFA1234A1Z5",
        invoice_number="INV-1001",
        invoice_date="2026-05-01",
        taxable_value=1000.0,
        gst_rate=18.0,
        gst_amount=180.0,
        hsn_code="1006",
    )
    base.update(overrides)
    return _RawExtraction(**base)


def test_clean_extraction_needs_no_review():
    needs_review, reasons = _assess_confidence(_raw())
    assert needs_review is False
    assert reasons == []


def test_invalid_gstin_flagged():
    needs_review, reasons = _assess_confidence(_raw(vendor_gstin="not-a-gstin"))
    assert needs_review is True
    assert any("GSTIN" in r for r in reasons)


def test_blank_invoice_number_flagged():
    needs_review, reasons = _assess_confidence(_raw(invoice_number="  "))
    assert needs_review is True
    assert any("invoice_number" in r for r in reasons)


def test_zero_gst_amount_flagged():
    needs_review, reasons = _assess_confidence(_raw(gst_amount=0))
    assert needs_review is True
    assert any("gst_amount" in r for r in reasons)


def test_missing_hsn_flagged():
    needs_review, reasons = _assess_confidence(_raw(hsn_code=""))
    assert needs_review is True
    assert any("hsn_code" in r for r in reasons)


def test_non_standard_rate_flagged():
    needs_review, reasons = _assess_confidence(_raw(gst_rate=19.5))
    assert needs_review is True
    assert any("gst_rate" in r for r in reasons)


def test_multiple_problems_all_reported():
    needs_review, reasons = _assess_confidence(_raw(vendor_gstin="bad", invoice_number="", gst_amount=0))
    assert needs_review is True
    assert len(reasons) >= 3

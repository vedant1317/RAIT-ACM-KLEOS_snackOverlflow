from __future__ import annotations

_HIGH_IMPACT_THRESHOLD = 5000.0

_IMPACT_CATEGORY = {
    "missing_from_2b": "itc_blocked",
    "duplicate": "wrong_claim_risk",
    "amount_diff": "itc_recoverable",
    "hsn_mismatch": "itc_recoverable",
    "missing_in_books": "book_missing_opportunity",
}

# Best-effort, non-authoritative flags for HSN/SAC codes commonly associated
# with Section 17(5) blocked credits. Always phrased as "may be" — this is
# advisory only; a human must verify the actual business-use facts before
# treating ITC as ineligible.
_BLOCKED_CREDIT_HSN_PREFIXES = {
    "8703": "Motor vehicles for personal transport may have blocked ITC under Section 17(5)(a) unless used "
    "for further supply, passenger transport, or driving training.",
    "9995": "Club, health, and fitness membership services are generally blocked credits under Section 17(5)(b).",
    "9963": "Outdoor catering / food & beverage services are generally blocked credits under Section "
    "17(5)(b) unless it's a statutory employer obligation.",
}


def classify_impact_category(issue_type: str) -> str:
    """Categorise an issue's rupee impact for the recovery dashboards:
    itc_blocked / itc_recoverable / wrong_claim_risk / book_missing_opportunity."""
    return _IMPACT_CATEGORY.get(issue_type, "itc_recoverable")


def severity_for(rupee_impact: float, base_severity: str) -> str:
    """Escalate a base severity when the financial impact alone is large
    enough to warrant urgent attention, regardless of issue type."""
    if rupee_impact >= _HIGH_IMPACT_THRESHOLD:
        return "high"
    return base_severity


def check_blocked_credit(hsn_code: str) -> str | None:
    """Advisory-only flag for HSN/SAC codes commonly associated with
    Section 17(5) blocked credits. Returns ``None`` unless the invoice's own
    HSN code supports the flag — never a blanket assumption."""
    code = str(hsn_code or "").strip()
    for prefix, note in _BLOCKED_CREDIT_HSN_PREFIXES.items():
        if code.startswith(prefix):
            return note
    return None


def missing_from_2b_impact(invoice: dict) -> float:
    """Full ITC on this invoice is blocked until the supplier files it."""
    return float(round(invoice["gst_amount"], 2))


def hsn_mismatch_impact(invoice: dict, official_rate: float) -> float:
    """Rupee gap between GST charged and GST due at the HSN's official rate."""
    correct_gst = float(invoice["taxable_value"]) * float(official_rate) / 100
    return float(round(abs(float(invoice["gst_amount"]) - correct_gst), 2))


def amount_diff_impact(invoice_gst_amount: float, baseline_gst_amount: float) -> float:
    """Rupee gap between what the trader's invoice and the GSTR-2B entry claim."""
    return float(round(abs(float(invoice_gst_amount) - float(baseline_gst_amount)), 2))


def duplicate_impact(invoice: dict) -> float:
    """ITC at risk of being wrongly claimed twice on the same invoice."""
    return float(round(invoice["gst_amount"], 2))

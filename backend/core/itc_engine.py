from __future__ import annotations


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

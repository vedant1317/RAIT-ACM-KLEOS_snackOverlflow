"""Lightweight, deterministic anomaly heuristics layered on top of the
reconciliation engine. These are advisory flags only — they never feed into
the ITC rupee totals, which stay deterministic from the matching engine.
"""

from __future__ import annotations

from typing import Any

from . import itc_engine
from .gstin_utils import is_valid_gstin

_STANDARD_RATES = {0.0, 0.25, 3.0, 5.0, 12.0, 18.0, 28.0}


def _num(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _edit_distance_at_most_one(a: str, b: str) -> bool:
    if a == b:
        return False
    if abs(len(a) - len(b)) > 1:
        return False
    if len(a) == len(b):
        return sum(1 for x, y in zip(a, b) if x != y) == 1
    longer, shorter = (a, b) if len(a) > len(b) else (b, a)
    for i in range(len(longer)):
        if longer[:i] + longer[i + 1 :] == shorter:
            return True
    return False


def group_by_gstin(invoices: list[dict]) -> dict[str, list[dict]]:
    groups: dict[str, list[dict]] = {}
    for inv in invoices:
        gstin = str(inv.get("vendor_gstin", "")).strip().upper()
        if gstin:
            groups.setdefault(gstin, []).append(inv)
    return groups


def check_invoice(invoice: dict, siblings: list[dict] | None = None) -> list[dict]:
    """Return anomaly flags for ``invoice``. ``siblings`` should be the other
    invoices sharing the same ``vendor_gstin`` (see :func:`group_by_gstin`),
    not the whole invoice batch, to keep this check linear in the size of one
    vendor's invoices rather than the whole book.
    """
    anomalies: list[dict] = []
    siblings = siblings or []

    taxable_value = _num(invoice.get("taxable_value"))
    if taxable_value >= 5000 and taxable_value % 1000 == 0:
        anomalies.append(
            {
                "type": "round_number_invoice",
                "message": f"Taxable value Rs.{taxable_value:,.0f} is a suspiciously round number — worth a second look.",
            }
        )

    gstin = str(invoice.get("vendor_gstin", "")).strip().upper()
    if gstin and not is_valid_gstin(gstin):
        anomalies.append(
            {
                "type": "gstin_format_typo",
                "message": f"GSTIN '{gstin}' doesn't match the standard 15-character format — check for a typo.",
            }
        )

    gst_rate = _num(invoice.get("gst_rate"))
    if gst_rate and round(gst_rate, 2) not in _STANDARD_RATES:
        anomalies.append(
            {
                "type": "non_standard_gst_rate",
                "message": f"GST rate {gst_rate}% is not one of the standard slabs (0/0.25/3/5/12/18/28%).",
            }
        )

    blocked_note = itc_engine.check_blocked_credit(invoice.get("hsn_code", ""))
    if blocked_note:
        anomalies.append({"type": "potentially_blocked_credit", "message": blocked_note})

    invoice_number = str(invoice.get("invoice_number", "")).strip().upper()
    vendor_name = str(invoice.get("vendor_name", "")).strip()

    for other in siblings:
        if other is invoice:
            continue
        other_number = str(other.get("invoice_number", "")).strip().upper()
        if other_number and other_number != invoice_number and _edit_distance_at_most_one(invoice_number, other_number):
            anomalies.append(
                {
                    "type": "similar_invoice_number",
                    "message": (
                        f"Invoice number {invoice_number} is suspiciously similar to {other_number} from the "
                        "same supplier — check for a duplicate re-entered with a typo."
                    ),
                }
            )
            break

    for other in siblings:
        other_name = str(other.get("vendor_name", "")).strip()
        if other_name and vendor_name and other_name != vendor_name:
            anomalies.append(
                {
                    "type": "vendor_name_changed",
                    "message": (
                        f"GSTIN {gstin} appears under two different names ('{vendor_name}' and "
                        f"'{other_name}') — confirm which is correct."
                    ),
                }
            )
            break

    return anomalies

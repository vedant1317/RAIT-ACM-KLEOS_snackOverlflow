from __future__ import annotations

import pandas as pd

from ..models.schemas import Mismatch, MismatchType, ReconciliationResult
from . import hsn_lookup, itc_engine, recommendation_engine

MATCH_KEYS = ["vendor_gstin", "invoice_number"]


def reconcile(trader_id: str, invoices: list[dict], baseline: list[dict]) -> ReconciliationResult:
    """Match a trader's invoices against their GSTR-2B baseline and classify
    every mismatch. All matching and arithmetic here is deterministic —
    no AI involved, so every rupee figure is reproducible and auditable.
    """
    inv_df = pd.DataFrame(invoices)
    base_df = pd.DataFrame(baseline)
    hsn_master = hsn_lookup.load_hsn_master()

    mismatches: list[Mismatch] = []

    # Duplicate detection within the trader's own batch (same GSTIN + invoice
    # number submitted more than once).
    is_duplicate = inv_df.duplicated(subset=MATCH_KEYS, keep="first")
    for _, row in inv_df[is_duplicate].iterrows():
        impact = itc_engine.duplicate_impact(row.to_dict())
        mismatches.append(_build_mismatch(MismatchType.DUPLICATE, row, impact, {"note": "duplicate invoice entry"}))

    # Match the de-duplicated invoices against the GSTR-2B baseline.
    merged = inv_df[~is_duplicate].merge(
        base_df,
        on=MATCH_KEYS,
        how="left",
        suffixes=("", "_2b"),
        indicator=True,
    )

    for _, row in merged.iterrows():
        if row["_merge"] == "left_only":
            impact = itc_engine.missing_from_2b_impact(row.to_dict())
            mismatches.append(
                _build_mismatch(MismatchType.MISSING_FROM_2B, row, impact, {"note": "not found in GSTR-2B"})
            )
        else:
            amount_changed = (
                abs(row["gst_amount"] - row["gst_amount_2b"]) > 1e-6
                or abs(row["taxable_value"] - row["taxable_value_2b"]) > 1e-6
            )
            if amount_changed:
                impact = itc_engine.amount_diff_impact(row["gst_amount"], row["gst_amount_2b"])
                mismatches.append(
                    _build_mismatch(
                        MismatchType.AMOUNT_DIFF,
                        row,
                        impact,
                        {
                            "invoice_gst_amount": float(row["gst_amount"]),
                            "gstr2b_gst_amount": float(row["gst_amount_2b"]),
                        },
                    )
                )

        # HSN validation against the official master runs independently of
        # the 2B match outcome.
        hsn_issue = hsn_lookup.check_hsn(row["hsn_code"], row["gst_rate"], hsn_master)
        if hsn_issue:
            official_rate = hsn_issue["official_rate"] if hsn_issue["official_rate"] is not None else row["gst_rate"]
            impact = itc_engine.hsn_mismatch_impact(row.to_dict(), official_rate)
            mismatches.append(_build_mismatch(MismatchType.HSN_MISMATCH, row, impact, hsn_issue))

    total = float(round(sum(m.rupee_impact for m in mismatches), 2))
    return ReconciliationResult(
        trader_id=trader_id,
        total_invoices=len(invoices),
        mismatches=mismatches,
        total_recoverable_or_blocked=total,
    )


def _build_mismatch(mtype: MismatchType, row: pd.Series, impact: float, details: dict) -> Mismatch:
    vendor_name = row["vendor_name"]
    vendor_gstin = row["vendor_gstin"]
    invoice_number = row["invoice_number"]
    return Mismatch(
        type=mtype,
        invoice_number=invoice_number,
        vendor_name=vendor_name,
        vendor_gstin=vendor_gstin,
        rupee_impact=impact,
        details={
            **details,
            "recommendation": recommendation_engine.recommend(mtype, vendor_name, vendor_gstin, invoice_number),
        },
    )

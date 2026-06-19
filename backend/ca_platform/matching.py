"""Invoice mapping / reconciliation for the CA platform.

This is the heart of the CA-firm "invoice manager". It takes a client's book
invoices and their GSTR-2B baseline and produces a full row-by-row mapping:

  * invoice <-> 2B matching on (vendor_gstin, invoice_number)
  * invoice <-> invoice matching to flag DUPLICATES in the books
  * MISSING_IN_2B   - in the books, absent from 2B (supplier hasn't filed -> ITC blocked)
  * MISSING_IN_BOOKS- in 2B, absent from the books (filed by supplier, not recorded)
  * MISMATCH        - matched, but one or more entered details disagree (the
                      "compare when any details entered are wrong" requirement),
                      reported field-by-field
  * HSN issues validated against the official master

All rupee figures come from the deterministic ``backend.core`` engine, never
from an AI model, so every number is reproducible and auditable. This module
is intentionally pandas-free so the CA service runs with only FastAPI present.
"""

from __future__ import annotations

from typing import Any

from ..core import hsn_lookup, itc_engine, recommendation_engine
from ..models.schemas import MismatchType

# Fields whose disagreement counts as a "wrong detail" on a matched invoice.
# money/tax fields are compared numerically; the rest as normalised strings.
_NUMERIC_FIELDS = ("taxable_value", "gst_rate", "gst_amount")
_TEXT_FIELDS = ("invoice_date", "vendor_name", "hsn_code")

_AMOUNT_TOLERANCE = 1e-6


def _key(record: dict) -> tuple[str, str]:
    return (
        str(record.get("vendor_gstin", "")).strip().upper(),
        str(record.get("invoice_number", "")).strip().upper(),
    )


def _num(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _field_diffs(book: dict, twob: dict) -> list[dict]:
    diffs: list[dict] = []
    for field in _NUMERIC_FIELDS:
        if abs(_num(book.get(field)) - _num(twob.get(field))) > _AMOUNT_TOLERANCE:
            diffs.append(
                {"field": field, "book": _num(book.get(field)), "gstr2b": _num(twob.get(field))}
            )
    for field in _TEXT_FIELDS:
        b = str(book.get(field, "")).strip()
        t = str(twob.get(field, "")).strip()
        if b.lower() != t.lower():
            diffs.append({"field": field, "book": b, "gstr2b": t})
    return diffs


def _issue(
    issue_type: str,
    rupee_impact: float,
    message: str,
    recommendation: str,
    severity: str,
    **extra: Any,
) -> dict:
    return {
        "type": issue_type,
        "rupee_impact": float(round(rupee_impact, 2)),
        "message": message,
        "recommendation": recommendation,
        "severity": severity,
        **extra,
    }


def _row(
    book: dict | None,
    twob: dict | None,
    status: str,
    issues: list[dict],
    field_diffs: list[dict] | None = None,
) -> dict:
    src = book or twob or {}
    rupee_impact = float(round(sum(i["rupee_impact"] for i in issues), 2))
    return {
        "invoice_number": src.get("invoice_number", ""),
        "vendor_name": src.get("vendor_name", ""),
        "vendor_gstin": src.get("vendor_gstin", ""),
        "invoice_date": src.get("invoice_date"),
        "status": status,
        "book": book,
        "gstr2b": twob,
        "field_diffs": field_diffs or [],
        "issues": issues,
        "rupee_impact": rupee_impact,
    }


def build_mapping(invoices: list[dict], baseline: list[dict]) -> dict:
    """Return the full mapping table + summary for one client.

    The output ``rows`` list has one entry per reconciliation unit. ``summary``
    carries the counts, total ITC at risk and the GST health score that the
    dashboards render.
    """
    hsn_master = hsn_lookup.load_hsn_master()

    # Index 2B by match key (first wins on the rare 2B-side duplicate).
    twob_by_key: dict[tuple[str, str], dict] = {}
    for record in baseline:
        twob_by_key.setdefault(_key(record), record)

    rows: list[dict] = []
    seen_book_keys: set[tuple[str, str]] = set()
    matched_2b_keys: set[tuple[str, str]] = set()

    for inv in invoices:
        key = _key(inv)
        issues: list[dict] = []

        # --- invoice <-> invoice: duplicate within the client's own books ---
        if key in seen_book_keys:
            issues.append(
                _issue(
                    MismatchType.DUPLICATE.value,
                    itc_engine.duplicate_impact(inv),
                    f"Invoice {inv.get('invoice_number')} appears more than once in the books — "
                    "claiming it twice would be a wrongful ITC claim.",
                    recommendation_engine.recommend(
                        MismatchType.DUPLICATE,
                        inv.get("vendor_name", ""),
                        inv.get("vendor_gstin", ""),
                        inv.get("invoice_number", ""),
                    ),
                    severity="high",
                )
            )
            rows.append(_row(inv, twob_by_key.get(key), "duplicate", issues))
            continue
        seen_book_keys.add(key)

        twob = twob_by_key.get(key)
        field_diffs: list[dict] = []

        # --- HSN validation runs regardless of the 2B match outcome ---
        hsn_issue = hsn_lookup.check_hsn(inv.get("hsn_code"), inv.get("gst_rate"), hsn_master)
        if hsn_issue:
            official_rate = (
                hsn_issue["official_rate"]
                if hsn_issue["official_rate"] is not None
                else _num(inv.get("gst_rate"))
            )
            issues.append(
                _issue(
                    MismatchType.HSN_MISMATCH.value,
                    itc_engine.hsn_mismatch_impact(inv, official_rate),
                    f"HSN code {inv.get('hsn_code')} on invoice {inv.get('invoice_number')} "
                    f"is {'not in' if hsn_issue['reason'] == 'unknown_hsn_code' else 'inconsistent with'} "
                    "the official master.",
                    recommendation_engine.recommend(
                        MismatchType.HSN_MISMATCH,
                        inv.get("vendor_name", ""),
                        inv.get("vendor_gstin", ""),
                        inv.get("invoice_number", ""),
                    ),
                    severity="medium",
                    official_rate=hsn_issue["official_rate"],
                    official_description=hsn_issue["official_description"],
                    reason=hsn_issue["reason"],
                )
            )

        if twob is None:
            # In the books, not filed by the supplier -> ITC blocked.
            issues.append(
                _issue(
                    MismatchType.MISSING_FROM_2B.value,
                    itc_engine.missing_from_2b_impact(inv),
                    f"Invoice {inv.get('invoice_number')} from {inv.get('vendor_name')} is not in "
                    "GSTR-2B — the supplier hasn't filed it, so this ITC is blocked.",
                    recommendation_engine.recommend(
                        MismatchType.MISSING_FROM_2B,
                        inv.get("vendor_name", ""),
                        inv.get("vendor_gstin", ""),
                        inv.get("invoice_number", ""),
                    ),
                    severity="high",
                )
            )
            rows.append(_row(inv, None, "missing_in_2b", issues))
            continue

        matched_2b_keys.add(key)
        field_diffs = _field_diffs(inv, twob)
        money_changed = any(d["field"] in _NUMERIC_FIELDS for d in field_diffs)
        if money_changed:
            issues.append(
                _issue(
                    MismatchType.AMOUNT_DIFF.value,
                    itc_engine.amount_diff_impact(
                        _num(inv.get("gst_amount")), _num(twob.get("gst_amount"))
                    ),
                    f"Details on invoice {inv.get('invoice_number')} don't match what the supplier "
                    "filed in GSTR-2B.",
                    recommendation_engine.recommend(
                        MismatchType.AMOUNT_DIFF,
                        inv.get("vendor_name", ""),
                        inv.get("vendor_gstin", ""),
                        inv.get("invoice_number", ""),
                    ),
                    severity="high",
                )
            )

        if issues:
            status = "mismatch" if (money_changed or field_diffs) else "review"
            # If the only issue is HSN but everything else matches, still flag it.
            rows.append(_row(inv, twob, status if status != "review" else "mismatch", issues, field_diffs))
        else:
            rows.append(_row(inv, twob, "matched", [], field_diffs))

    # --- 2B entries with no matching book invoice (missing from the books) ---
    for key, twob in twob_by_key.items():
        if key in matched_2b_keys or key in seen_book_keys:
            continue
        impact = float(round(_num(twob.get("gst_amount")), 2))
        issues = [
            _issue(
                "missing_in_books",
                impact,
                f"Invoice {twob.get('invoice_number')} from {twob.get('vendor_name')} is in GSTR-2B "
                "but not recorded in the books — either a missing purchase entry or a wrong claim by the supplier.",
                f"Verify invoice {twob.get('invoice_number')} from {twob.get('vendor_name')} "
                f"({twob.get('vendor_gstin')}) and record it, or query the supplier if it isn't yours.",
                severity="medium",
            )
        ]
        rows.append(_row(None, twob, "missing_in_books", issues))

    return {"rows": rows, "summary": _summarise(rows, invoices, baseline)}


def _summarise(rows: list[dict], invoices: list[dict], baseline: list[dict]) -> dict:
    counts = {
        "matched": 0,
        "mismatch": 0,
        "duplicate": 0,
        "missing_in_2b": 0,
        "missing_in_books": 0,
    }
    hsn_issues = 0
    itc_at_risk = 0.0
    itc_blocked = 0.0
    for row in rows:
        counts[row["status"]] = counts.get(row["status"], 0) + 1
        itc_at_risk += row["rupee_impact"]
        for issue in row["issues"]:
            if issue["type"] == MismatchType.HSN_MISMATCH.value:
                hsn_issues += 1
            if issue["type"] in (MismatchType.MISSING_FROM_2B.value, MismatchType.DUPLICATE.value):
                itc_blocked += issue["rupee_impact"]

    total_book_gst = sum(_num(i.get("gst_amount")) for i in invoices) or 1.0
    clean_ratio = counts["matched"] / max(len(invoices), 1)
    risk_ratio = min(itc_at_risk / total_book_gst, 1.0)
    health_score = max(0, min(100, round(100 * (0.5 * clean_ratio + 0.5 * (1 - risk_ratio)))))

    total_issues = (
        counts["mismatch"] + counts["duplicate"] + counts["missing_in_2b"] + counts["missing_in_books"]
    )

    return {
        "total_invoices": len(invoices),
        "total_2b_rows": len(baseline),
        "matched": counts["matched"],
        "mismatches": counts["mismatch"],
        "duplicates": counts["duplicate"],
        "missing_in_2b": counts["missing_in_2b"],
        "missing_in_books": counts["missing_in_books"],
        "hsn_issues": hsn_issues,
        "total_issues": total_issues,
        "itc_at_risk": float(round(itc_at_risk, 2)),
        "itc_blocked": float(round(itc_blocked, 2)),
        "health_score": health_score,
    }

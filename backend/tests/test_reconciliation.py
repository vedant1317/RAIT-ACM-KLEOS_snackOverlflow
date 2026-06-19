from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from backend.core.reconciliation_engine import reconcile
from backend.models.schemas import MismatchType

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load_demo_invoices() -> list[dict]:
    invoices = []
    for path in sorted((DATA_DIR / "demo_invoices").glob("*.json")):
        invoices.append(json.loads(path.read_text()))
    return invoices


def _load_demo_baseline() -> list[dict]:
    df = pd.read_csv(
        DATA_DIR / "demo_gstr2b.csv",
        dtype={"vendor_gstin": str, "invoice_number": str, "hsn_code": str},
    )
    return df.to_dict(orient="records")


def test_seeded_demo_dataset_catches_all_four_mismatch_types():
    invoices = _load_demo_invoices()
    baseline = _load_demo_baseline()

    result = reconcile("demo-trader", invoices, baseline)

    by_type = {m.type: m for m in result.mismatches}
    assert set(by_type.keys()) == {
        MismatchType.MISSING_FROM_2B,
        MismatchType.HSN_MISMATCH,
        MismatchType.AMOUNT_DIFF,
        MismatchType.DUPLICATE,
    }

    assert by_type[MismatchType.MISSING_FROM_2B].invoice_number == "INV-3003"
    assert by_type[MismatchType.MISSING_FROM_2B].rupee_impact == 400.0

    assert by_type[MismatchType.AMOUNT_DIFF].invoice_number == "INV-2002"
    assert by_type[MismatchType.AMOUNT_DIFF].rupee_impact == 90.0

    assert by_type[MismatchType.HSN_MISMATCH].invoice_number == "INV-4004"
    assert by_type[MismatchType.HSN_MISMATCH].rupee_impact == 1300.0

    assert by_type[MismatchType.DUPLICATE].invoice_number == "INV-5005"
    assert by_type[MismatchType.DUPLICATE].rupee_impact == 720.0

    assert result.total_invoices == 6
    assert result.total_recoverable_or_blocked == 400.0 + 90.0 + 1300.0 + 720.0


def test_clean_invoice_produces_no_mismatch():
    invoices = _load_demo_invoices()
    baseline = _load_demo_baseline()

    result = reconcile("demo-trader", invoices, baseline)

    clean_invoice_numbers = {m.invoice_number for m in result.mismatches}
    assert "INV-1001" not in clean_invoice_numbers

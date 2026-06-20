"""Shared invoice/baseline file-upload parsing — used by both the CA admin
router (``router.py``) and the client self-service portal (``client_portal.py``)
so the two never drift apart. PDFs go through the Gemini-based GSTR-2B
parser; CSV/XLSX stay the fast, fully-deterministic path.
"""

from __future__ import annotations

import asyncio
import csv
import io

from fastapi import UploadFile

REQUIRED_COLUMNS = {
    "vendor_gstin",
    "vendor_name",
    "invoice_number",
    "invoice_date",
    "taxable_value",
    "gst_rate",
    "gst_amount",
    "hsn_code",
}
_NUMERIC = {"taxable_value", "gst_rate", "gst_amount"}


def coerce_row(row: dict) -> dict:
    out = dict(row)
    for col in _NUMERIC:
        try:
            out[col] = float(str(out.get(col, "0")).replace(",", "").strip() or 0)
        except ValueError:
            out[col] = 0.0
    for col in ("vendor_gstin", "invoice_number", "hsn_code"):
        out[col] = str(out.get(col, "")).strip()
    return out


def parse_csv_bytes(file_bytes: bytes) -> list[dict]:
    text = file_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
    if missing:
        raise ValueError(f"File is missing columns: {sorted(missing)}")
    return [coerce_row(r) for r in reader]


def parse_spreadsheet(file_bytes: bytes, filename: str) -> list[dict]:
    if filename.lower().endswith(".csv"):
        return parse_csv_bytes(file_bytes)
    # xlsx path: defer to pandas/openpyxl if present.
    try:
        import pandas as pd

        df = pd.read_excel(
            io.BytesIO(file_bytes),
            dtype={c: str for c in ("vendor_gstin", "invoice_number", "hsn_code")},
        )
    except ImportError as exc:  # pragma: no cover
        raise ValueError("Excel parsing needs pandas/openpyxl; upload a CSV instead") from exc
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"File is missing columns: {sorted(missing)}")
    return [coerce_row(r) for r in df.to_dict(orient="records")]


async def read_baseline_records(file: UploadFile) -> list[dict]:
    """GSTR-2B upload: PDF -> Gemini parser, else CSV/XLSX direct parse."""
    file_bytes = await file.read()
    filename = file.filename or ""
    if filename.lower().endswith(".pdf") or file.content_type == "application/pdf":
        from ..core import gstr2b_parser

        # Gemini's sync SDK must not run directly on the event-loop thread.
        return await asyncio.to_thread(gstr2b_parser.parse_gstr2b_pdf, file_bytes)
    return parse_spreadsheet(file_bytes, filename)


async def read_invoice_records(file: UploadFile, erp_config: dict | None) -> list[dict]:
    """Invoice upload: PDF -> Gemini parser, else CSV/XLSX through the
    client's configured ERP column-mapping profile (default generic_csv)."""
    file_bytes = await file.read()
    filename = file.filename or ""
    if filename.lower().endswith(".pdf") or file.content_type == "application/pdf":
        from ..core import gstr2b_parser

        return await asyncio.to_thread(gstr2b_parser.parse_invoice_batch_pdf, file_bytes)

    from . import erp_mapping

    raw_rows = erp_mapping.import_invoice_rows(file_bytes, filename, erp_config)
    missing = REQUIRED_COLUMNS - set(raw_rows[0].keys() if raw_rows else REQUIRED_COLUMNS)
    if missing:
        profile = (erp_config or {}).get("profile", "generic_csv")
        raise ValueError(f"File is missing columns: {sorted(missing)} (after applying ERP profile '{profile}')")
    return [coerce_row(r) for r in raw_rows]

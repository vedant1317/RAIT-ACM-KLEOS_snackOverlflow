"""ERP import profiles & column-mapping for generic invoice ingestion.

Each profile maps a third-party export's column headers to the platform's
canonical 8 invoice fields. These are best-effort default mappings for the
GST/accounting software small Indian businesses commonly use; a client can
override any individual column via ``POST /ca/clients/{id}/erp/config``.
"""

from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from . import store
from .auth import require_ca_auth

router = APIRouter()

CANONICAL_FIELDS = (
    "vendor_name",
    "vendor_gstin",
    "invoice_number",
    "invoice_date",
    "taxable_value",
    "gst_rate",
    "gst_amount",
    "hsn_code",
)

IMPORT_PROFILES: dict[str, dict[str, str]] = {
    "generic_csv": {f: f for f in CANONICAL_FIELDS},
    "tally": {
        "Party Name": "vendor_name",
        "Party GSTIN/UIN": "vendor_gstin",
        "Voucher No": "invoice_number",
        "Date": "invoice_date",
        "Taxable Amt": "taxable_value",
        "GST Rate": "gst_rate",
        "GST Amt": "gst_amount",
        "HSN/SAC": "hsn_code",
    },
    "zoho": {
        "Vendor Name": "vendor_name",
        "Vendor GSTIN": "vendor_gstin",
        "Bill Number": "invoice_number",
        "Bill Date": "invoice_date",
        "Sub Total": "taxable_value",
        "Tax Rate (%)": "gst_rate",
        "Tax Amount": "gst_amount",
        "HSN/SAC Code": "hsn_code",
    },
    "marg": {
        "Supplier Name": "vendor_name",
        "Supplier GSTIN": "vendor_gstin",
        "Bill No": "invoice_number",
        "Bill Date": "invoice_date",
        "Taxable Value": "taxable_value",
        "Tax %": "gst_rate",
        "Tax Amount": "gst_amount",
        "HSN Code": "hsn_code",
    },
    "busy": {
        "A/c Name": "vendor_name",
        "GSTIN": "vendor_gstin",
        "Ref No": "invoice_number",
        "Ref Date": "invoice_date",
        "Taxable Amount": "taxable_value",
        "GST %": "gst_rate",
        "GST Value": "gst_amount",
        "HSN/SAC": "hsn_code",
    },
    "vyapar": {
        "Party": "vendor_name",
        "Party GSTIN": "vendor_gstin",
        "Transaction No": "invoice_number",
        "Transaction Date": "invoice_date",
        "Taxable Amount": "taxable_value",
        "Tax Rate": "gst_rate",
        "Tax Amount": "gst_amount",
        "HSN Code": "hsn_code",
    },
}

_GENERIC_MAP = {f: f for f in CANONICAL_FIELDS}


def apply_mapping(rows: list[dict], column_map: dict[str, str]) -> list[dict]:
    """Rename a raw export's columns to the canonical 8 fields. Source
    columns absent from the map are dropped; canonical fields with no source
    column default to ''."""
    mapped = []
    for row in rows:
        out = {field: "" for field in CANONICAL_FIELDS}
        for source_col, canonical_field in column_map.items():
            if source_col in row and canonical_field in out:
                out[canonical_field] = row[source_col]
        mapped.append(out)
    return mapped


def parse_raw_csv(file_bytes: bytes) -> list[dict]:
    text = file_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    return [dict(row) for row in reader]


def parse_raw_excel(file_bytes: bytes) -> list[dict]:
    import pandas as pd

    df = pd.read_excel(io.BytesIO(file_bytes), dtype=str)
    return df.to_dict(orient="records")


def parse_raw(file_bytes: bytes, filename: str) -> list[dict]:
    if filename.lower().endswith(".csv"):
        return parse_raw_csv(file_bytes)
    return parse_raw_excel(file_bytes)


def resolve_column_map(client_config: dict | None) -> dict[str, str]:
    config = client_config or {}
    base = dict(IMPORT_PROFILES.get(config.get("profile", "generic_csv"), IMPORT_PROFILES["generic_csv"]))
    base.update(config.get("column_overrides") or {})
    return base


def import_invoice_rows(file_bytes: bytes, filename: str, client_config: dict | None) -> list[dict]:
    """Raw parse -> column mapping -> canonical-keyed dict rows (numeric
    coercion/validation is still the caller's job)."""
    raw_rows = parse_raw(file_bytes, filename)
    column_map = resolve_column_map(client_config)
    if column_map == _GENERIC_MAP:
        return raw_rows
    return apply_mapping(raw_rows, column_map)


class ErpConfigIn(BaseModel):
    profile: str = "generic_csv"
    column_overrides: dict[str, str] = {}


@router.get("/clients/{client_id}/erp/config")
async def get_erp_config(client_id: str, _user: dict = Depends(require_ca_auth)) -> dict:
    client = store.get_client(client_id)
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    config = client.get("erp_config") or {"profile": "generic_csv", "column_overrides": {}}
    return {"client_id": client_id, "available_profiles": sorted(IMPORT_PROFILES), **config}


@router.post("/clients/{client_id}/erp/config")
async def set_erp_config(client_id: str, payload: ErpConfigIn, _user: dict = Depends(require_ca_auth)) -> dict:
    if not store.client_exists(client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    if payload.profile not in IMPORT_PROFILES:
        raise HTTPException(status_code=400, detail=f"Unknown profile. Choose from {sorted(IMPORT_PROFILES)}")
    config = {"profile": payload.profile, "column_overrides": payload.column_overrides}
    store.set_client_field(client_id, "erp_config", config)
    store.log_activity(client_id, "erp_config_updated", f"ERP import profile set to {payload.profile}")
    return {"client_id": client_id, **config}


@router.get("/clients/{client_id}/erp/sync-log")
async def get_erp_sync_log(client_id: str, _user: dict = Depends(require_ca_auth)) -> list[dict]:
    if not store.client_exists(client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    return store.list_erp_sync_log(client_id)

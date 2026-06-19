"""FastAPI router for the CA-firm SaaS platform, mounted under /ca."""

from __future__ import annotations

import csv
import io

from fastapi import APIRouter, File, Header, HTTPException, UploadFile
from pydantic import BaseModel

from . import service
from .seed import ensure_seeded

router = APIRouter(prefix="/ca", tags=["ca-platform"])

# Seed demo data on first import so the dashboards are never empty.
ensure_seeded()

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


class ClientCreate(BaseModel):
    name: str
    gstin: str = ""
    industry: str = ""
    contact_name: str = ""
    contact_phone: str = ""
    erp_system: str = ""
    filing_frequency: str = "monthly"


class InvoiceIn(BaseModel):
    vendor_name: str
    vendor_gstin: str
    invoice_number: str
    invoice_date: str
    taxable_value: float
    gst_rate: float
    gst_amount: float
    hsn_code: str


class InvoiceBatch(BaseModel):
    invoices: list[InvoiceIn]


class BaselineIn(BaseModel):
    records: list[InvoiceIn]


def _coerce_row(row: dict) -> dict:
    out = dict(row)
    for col in _NUMERIC:
        try:
            out[col] = float(str(out.get(col, "0")).replace(",", "").strip() or 0)
        except ValueError:
            out[col] = 0.0
    for col in ("vendor_gstin", "invoice_number", "hsn_code"):
        out[col] = str(out.get(col, "")).strip()
    return out


def _parse_csv_bytes(file_bytes: bytes) -> list[dict]:
    text = file_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
    if missing:
        raise ValueError(f"File is missing columns: {sorted(missing)}")
    return [_coerce_row(r) for r in reader]


def _parse_spreadsheet(file_bytes: bytes, filename: str) -> list[dict]:
    if filename.lower().endswith(".csv"):
        return _parse_csv_bytes(file_bytes)
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
    return [_coerce_row(r) for r in df.to_dict(orient="records")]


# --------------------------------------------------------------------------- #
# firm-wide / admin
# --------------------------------------------------------------------------- #
@router.get("/portfolio")
async def get_portfolio() -> dict:
    return service.portfolio()


# --------------------------------------------------------------------------- #
# clients
# --------------------------------------------------------------------------- #
@router.get("/clients")
async def list_clients() -> list[dict]:
    return service.list_clients()


@router.post("/clients", status_code=201)
async def create_client(payload: ClientCreate) -> dict:
    return service.create_client(payload.model_dump())


@router.get("/clients/{client_id}")
async def get_client(client_id: str) -> dict:
    client = service.get_client(client_id)
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


# --------------------------------------------------------------------------- #
# invoices
# --------------------------------------------------------------------------- #
@router.get("/clients/{client_id}/invoices")
async def list_invoices(client_id: str) -> list[dict]:
    invoices = service.get_invoices(client_id)
    if invoices is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return invoices


@router.post("/clients/{client_id}/invoices")
async def add_invoices(client_id: str, batch: InvoiceBatch) -> dict:
    result = service.add_invoices(client_id, [i.model_dump() for i in batch.invoices])
    if result is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return result


@router.post("/clients/{client_id}/invoices/upload")
async def upload_invoices(client_id: str, file: UploadFile = File(...)) -> dict:
    try:
        records = _parse_spreadsheet(await file.read(), file.filename or "")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    result = service.add_invoices(client_id, records, source="import")
    if result is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return result


# --------------------------------------------------------------------------- #
# GSTR-2B baseline
# --------------------------------------------------------------------------- #
@router.post("/clients/{client_id}/baseline")
async def set_baseline(client_id: str, payload: BaselineIn) -> dict:
    result = service.set_baseline(client_id, [r.model_dump() for r in payload.records])
    if result is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return result


@router.post("/clients/{client_id}/baseline/upload")
async def upload_baseline(client_id: str, file: UploadFile = File(...)) -> dict:
    try:
        records = _parse_spreadsheet(await file.read(), file.filename or "")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    result = service.set_baseline(client_id, records)
    if result is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return result


# --------------------------------------------------------------------------- #
# reconciliation
# --------------------------------------------------------------------------- #
@router.get("/clients/{client_id}/reconciliation")
async def get_reconciliation(client_id: str) -> dict:
    result = service.get_reconciliation(client_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return result


@router.post("/clients/{client_id}/reconcile")
async def run_reconcile(client_id: str, language: str = "English") -> dict:
    result = service.run_reconcile(client_id, language=language)
    if result is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return result


# --------------------------------------------------------------------------- #
# ERP integration ("tool on top of the company software")
# --------------------------------------------------------------------------- #
@router.post("/integrations/erp/invoices")
async def erp_ingest(batch: InvoiceBatch, x_api_key: str = Header(...)) -> dict:
    """Endpoint a client's ERP calls to push invoices into the platform.
    Authenticated by the per-client ERP API key issued at onboarding."""
    result = service.ingest_from_erp(x_api_key, [i.model_dump() for i in batch.invoices])
    if result is None:
        raise HTTPException(status_code=401, detail="Invalid ERP API key")
    return result

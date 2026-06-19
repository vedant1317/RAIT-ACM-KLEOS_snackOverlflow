from __future__ import annotations

import io

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile

from ..db.mongo import get_db

router = APIRouter()

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

_STRING_COLUMNS = {"vendor_gstin", "invoice_number", "hsn_code"}


def _parse_spreadsheet(file_bytes: bytes, filename: str) -> pd.DataFrame:
    buffer = io.BytesIO(file_bytes)
    if filename.lower().endswith(".csv"):
        df = pd.read_csv(buffer, dtype={col: str for col in _STRING_COLUMNS})
    else:
        df = pd.read_excel(buffer, dtype={col: str for col in _STRING_COLUMNS})

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"GSTR-2B file is missing columns: {sorted(missing)}")
    return df


@router.post("/2b/upload")
async def upload_baseline(trader_id: str, file: UploadFile = File(...)) -> dict:
    file_bytes = await file.read()
    try:
        df = _parse_spreadsheet(file_bytes, file.filename or "")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    records = df.to_dict(orient="records")
    db = get_db()
    db.baselines.update_one(
        {"trader_id": trader_id},
        {"$set": {"trader_id": trader_id, "records": records}},
        upsert=True,
    )
    return {"trader_id": trader_id, "rows_loaded": len(records)}

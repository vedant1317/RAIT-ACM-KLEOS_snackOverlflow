from __future__ import annotations

import asyncio
import io

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..ca_platform import whatsapp_bridge
from ..ca_platform.auth import require_service_token
from ..core.period_utils import derive_period
from ..db.mongo import get_db

router = APIRouter(dependencies=[Depends(require_service_token)])

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


async def _records_from_upload(file_bytes: bytes, filename: str, content_type: str) -> list[dict]:
    if filename.lower().endswith(".pdf") or content_type == "application/pdf":
        from ..core import gstr2b_parser

        # Gemini's sync SDK must not run directly on the event-loop thread.
        return await asyncio.to_thread(gstr2b_parser.parse_gstr2b_pdf, file_bytes)
    df = _parse_spreadsheet(file_bytes, filename)
    return df.to_dict(orient="records")


@router.post("/2b/upload")
async def upload_baseline(trader_id: str, file: UploadFile = File(...)) -> dict:
    file_bytes = await file.read()
    try:
        records = await _records_from_upload(file_bytes, file.filename or "", file.content_type or "")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    for record in records:
        record.setdefault("period", derive_period(record.get("invoice_date")))

    db = get_db()
    db.baselines.update_one(
        {"trader_id": trader_id},
        {"$set": {"trader_id": trader_id, "records": records}},
        upsert=True,
    )
    whatsapp_bridge.mirror_baseline(trader_id, records)
    needs_review = sum(1 for r in records if r.get("needs_review"))
    return {"trader_id": trader_id, "rows_loaded": len(records), "needs_review": needs_review}

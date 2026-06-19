from __future__ import annotations

import asyncio

from fastapi import APIRouter, File, HTTPException, UploadFile

from ..core import extraction_service
from ..models.schemas import ExtractedInvoice

router = APIRouter()


@router.post("/extract-invoice", response_model=ExtractedInvoice)
async def extract_invoice(file: UploadFile = File(...)) -> ExtractedInvoice:
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    mime_type = file.content_type or "application/octet-stream"
    try:
        # The Gemini SDK's sync client breaks if called directly on the
        # event loop thread (its httpx client gets closed prematurely), so
        # it must run in a worker thread.
        return await asyncio.to_thread(extraction_service.extract_invoice, file_bytes, mime_type)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Extraction failed: {exc}") from exc

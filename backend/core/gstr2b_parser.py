"""GSTR-2B PDF ingestion.

CSV/XLSX stays the fast, fully-deterministic path (see ``ca_platform/router.py``
and ``routers/baseline.py``). A PDF — the actual portal download format most
traders have on hand — is read with the same Gemini Vision model used for
invoice extraction, but with its own schema and a built-in confidence flag
per row, since a multi-page tabular statement is far more likely to need a
human glance than a single invoice photo.
"""

from __future__ import annotations

import json
import os
from typing import Any

from pydantic import BaseModel

from ..models.schemas import ExtractedInvoice

_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")

_PROMPT = (
    "You are reading a GSTR-2B statement for an Indian GST-registered "
    "business — a tabular government return document (downloaded PDF or a "
    "scanned printout), not a single invoice. Extract every invoice-level "
    "row into the given schema with fields: vendor_name, vendor_gstin, "
    "invoice_number, invoice_date (YYYY-MM-DD), taxable_value, gst_rate, "
    "gst_amount, hsn_code. If a row's values are unclear, smudged, or "
    "ambiguous, set needs_review to true and fill review_reason with a short "
    "explanation; otherwise leave needs_review false and review_reason "
    "empty. Do not skip a row just because it looks uncertain — flag it "
    "instead of guessing silently."
)


class GSTR2BRow(ExtractedInvoice):
    needs_review: bool = False
    review_reason: str = ""


class GSTR2BExtraction(BaseModel):
    rows: list[GSTR2BRow]


_client: Any = None


def _get_client() -> Any:
    # Same module-level singleton pattern as extraction_service.py: a
    # throwaway genai.Client() can be garbage-collected mid-request.
    global _client
    if _client is None:
        from google import genai

        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _client


def parse_gstr2b_pdf(file_bytes: bytes) -> list[dict]:
    """Extract GSTR-2B rows from a PDF into the same 8-field shape the
    CSV/XLSX fast path produces, each row additionally tagged with
    ``needs_review``/``review_reason``. Call from a worker thread
    (``asyncio.to_thread``) — this makes a blocking network call."""
    from google.genai import types

    client = _get_client()
    response = client.models.generate_content(
        model=_MODEL,
        contents=[
            types.Part.from_bytes(data=file_bytes, mime_type="application/pdf"),
            _PROMPT,
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=GSTR2BExtraction,
        ),
    )
    data = json.loads(response.text)
    extraction = GSTR2BExtraction.model_validate(data)
    return [row.model_dump(mode="json") for row in extraction.rows]

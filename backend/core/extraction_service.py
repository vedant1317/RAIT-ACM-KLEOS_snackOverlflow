from __future__ import annotations

import json
import os
import time
from datetime import date
from typing import Any

from pydantic import BaseModel

from ..models.schemas import ExtractedInvoice
from . import demo_cache
from .gstin_utils import is_valid_gstin

_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")
_MAX_ATTEMPTS = 3
_STANDARD_RATES = {0.0, 0.25, 3.0, 5.0, 12.0, 18.0, 28.0}


class _RawExtraction(BaseModel):
    """What we ask Gemini to produce — deliberately without needs_review /
    review_reasons. Confidence is assessed deterministically in Python
    afterwards, never self-reported by the model: an extraction step that
    grades its own homework defeats the point of flagging weak reads."""

    vendor_name: str
    vendor_gstin: str
    invoice_number: str
    invoice_date: date
    taxable_value: float
    gst_rate: float
    gst_amount: float
    hsn_code: str


def _assess_confidence(raw: _RawExtraction) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    if not raw.vendor_gstin or not is_valid_gstin(raw.vendor_gstin):
        reasons.append("vendor_gstin doesn't look like a valid 15-character GSTIN")
    if not raw.invoice_number.strip():
        reasons.append("invoice_number is blank")
    if raw.gst_amount <= 0:
        reasons.append("gst_amount is zero or negative")
    if not raw.hsn_code.strip():
        reasons.append("hsn_code is missing")
    if round(raw.gst_rate, 2) not in _STANDARD_RATES:
        reasons.append(f"gst_rate {raw.gst_rate}% is not a standard GST slab")
    if raw.taxable_value <= 0:
        reasons.append("taxable_value is zero or negative")
    return (len(reasons) > 0, reasons)

_PROMPT = (
    "You are reading a photo or PDF of an Indian GST invoice. Extract exactly "
    "these eight fields and return JSON matching the schema: vendor_name, "
    "vendor_gstin, invoice_number, invoice_date (YYYY-MM-DD), taxable_value, "
    "gst_rate, gst_amount, hsn_code. The image may be rotated, blurry, or a "
    "handwritten/printed receipt. Use the tax summary table on the invoice "
    "for the rate/amount fields rather than guessing. If a field is "
    "genuinely unreadable, make your best estimate from context instead of "
    "leaving it blank."
)


_client: Any = None


def _get_client() -> Any:
    # Cached as a module-level singleton (never garbage collected) instead
    # of constructing one per call: a throwaway `genai.Client(...)` with no
    # held reference can be GC'd mid-request — its httpx client gets closed
    # while tenacity's internal retry is still using it — raising
    # "Cannot send a request, as the client has been closed."
    global _client
    if _client is None:
        from google import genai

        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _client


def extract_invoice(file_bytes: bytes, mime_type: str) -> ExtractedInvoice:
    """Read an invoice image/PDF into the 8-field structured schema via
    Gemini Vision. Retries on transient failures, then falls back to a
    pre-extracted demo cache entry (keyed by file hash) if every live
    attempt fails — so a network hiccup on stage can't sink the demo.
    """
    from google.genai import types

    client = _get_client()
    last_error: Exception | None = None
    for attempt in range(_MAX_ATTEMPTS):
        try:
            response = client.models.generate_content(
                model=_MODEL,
                contents=[
                    types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                    _PROMPT,
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=_RawExtraction,
                ),
            )
            data = json.loads(response.text)
            raw = _RawExtraction.model_validate(data)
            needs_review, reasons = _assess_confidence(raw)
            return ExtractedInvoice(**raw.model_dump(), needs_review=needs_review, review_reasons=reasons)
        except Exception as exc:
            last_error = exc
            if attempt < _MAX_ATTEMPTS - 1:
                time.sleep(0.5 * (attempt + 1))

    cached = demo_cache.lookup(file_bytes)
    if cached is not None:
        return ExtractedInvoice.model_validate(cached)
    raise last_error

from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel


class ExtractedInvoice(BaseModel):
    vendor_name: str
    vendor_gstin: str
    invoice_number: str
    invoice_date: date
    taxable_value: float
    gst_rate: float
    gst_amount: float
    hsn_code: str


class MismatchType(str, Enum):
    MISSING_FROM_2B = "missing_from_2b"
    HSN_MISMATCH = "hsn_mismatch"
    AMOUNT_DIFF = "amount_diff"
    DUPLICATE = "duplicate"


class Mismatch(BaseModel):
    type: MismatchType
    invoice_number: str
    vendor_name: str
    vendor_gstin: str
    rupee_impact: float
    details: dict


class ReconciliationResult(BaseModel):
    trader_id: str
    total_invoices: int
    mismatches: list[Mismatch]
    total_recoverable_or_blocked: float

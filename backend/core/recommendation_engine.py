from __future__ import annotations

from ..models.schemas import MismatchType

_TEMPLATES: dict[MismatchType, str] = {
    MismatchType.MISSING_FROM_2B: (
        "Contact supplier {vendor_name} ({vendor_gstin}) and ask them to file "
        "invoice {invoice_number} in their GSTR-1 — it has not been filed yet."
    ),
    MismatchType.HSN_MISMATCH: (
        "Ask supplier {vendor_name} to correct the HSN code on invoice "
        "{invoice_number} and reissue it with the correct GST rate."
    ),
    MismatchType.AMOUNT_DIFF: (
        "Ask supplier {vendor_name} to reconcile the amount on invoice "
        "{invoice_number} — it does not match what they filed in GSTR-2B."
    ),
    MismatchType.DUPLICATE: (
        "Remove the duplicate copy of invoice {invoice_number} from your "
        "records before filing your return."
    ),
}


def recommend(mismatch_type: MismatchType, vendor_name: str, vendor_gstin: str, invoice_number: str) -> str:
    template = _TEMPLATES[mismatch_type]
    return template.format(vendor_name=vendor_name, vendor_gstin=vendor_gstin, invoice_number=invoice_number)

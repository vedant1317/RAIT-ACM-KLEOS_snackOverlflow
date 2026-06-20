"""HSN/SAC categorisation — separates goods vs services and enriches an
invoice with a category, using the expanded HSN master list plus a cheap
prefix fallback for codes the master doesn't carry (SAC/service codes are,
by GST convention, always two digits starting with 99). Official-rate
validation stays in ``hsn_lookup`` and is untouched by this module — this is
purely descriptive enrichment, never used for money math.
"""

from __future__ import annotations

import csv

from . import hsn_lookup

_master_cache: dict[str, dict] | None = None


def _master() -> dict[str, dict]:
    global _master_cache
    if _master_cache is None:
        master: dict[str, dict] = {}
        with open(hsn_lookup.HSN_MASTER_PATH, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                master[row["hsn_code"]] = {
                    "description": row["description"],
                    "gst_rate": float(row["gst_rate"]),
                    "type": row.get("type") or "goods",
                    "category": row.get("category") or "uncategorised",
                }
        _master_cache = master
    return _master_cache


def categorise(hsn_code: str) -> dict:
    """Return ``{"type": "goods"|"services", "category": str, "description": str | None}``
    for an HSN/SAC code — from the master if known, else a cheap prefix
    heuristic (codes starting with ``99`` are SAC/services by convention)."""
    code = str(hsn_code or "").strip()
    entry = _master().get(code)
    if entry:
        return {"type": entry["type"], "category": entry["category"], "description": entry["description"]}
    return {
        "type": "services" if code.startswith("99") else "goods",
        "category": "uncategorised",
        "description": None,
    }

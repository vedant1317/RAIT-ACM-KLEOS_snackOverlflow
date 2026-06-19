from __future__ import annotations

import csv
from pathlib import Path

HSN_MASTER_PATH = Path(__file__).resolve().parent.parent / "data" / "hsn_master.csv"


def load_hsn_master(path: Path = HSN_MASTER_PATH) -> dict[str, dict]:
    master: dict[str, dict] = {}
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            master[row["hsn_code"]] = {
                "description": row["description"],
                "gst_rate": float(row["gst_rate"]),
            }
    return master


def check_hsn(hsn_code: str, charged_gst_rate: float, master: dict[str, dict] | None = None) -> dict | None:
    """Validate an invoice's HSN code against the official master list.

    Returns mismatch details if the code is unknown, or if its official
    rate disagrees with what was actually charged on the invoice.
    Returns None if the HSN code and rate are consistent with the master.
    """
    master = master if master is not None else load_hsn_master()
    entry = master.get(str(hsn_code))
    if entry is None:
        return {"reason": "unknown_hsn_code", "official_rate": None, "official_description": None}
    if abs(entry["gst_rate"] - float(charged_gst_rate)) > 1e-6:
        return {
            "reason": "rate_mismatch",
            "official_rate": entry["gst_rate"],
            "official_description": entry["description"],
        }
    return None

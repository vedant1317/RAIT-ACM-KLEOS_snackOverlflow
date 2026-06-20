"""Shared GSTIN structural validation, used by both anomaly detection and
extraction confidence scoring so the two checks never drift apart."""

from __future__ import annotations


def is_valid_gstin(gstin: str) -> bool:
    gstin = (gstin or "").strip().upper()
    if len(gstin) != 15:
        return False
    if not gstin[0:2].isdigit():
        return False
    if not gstin[2:7].isalpha():
        return False
    if not gstin[7:11].isdigit():
        return False
    if gstin[13] != "Z":
        return False
    return True

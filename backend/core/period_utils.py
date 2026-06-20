"""Helpers for tagging records with a GST filing period (``YYYY-MM``)."""

from __future__ import annotations

import re
from datetime import datetime, timezone

_DATE_RE = re.compile(r"^(\d{4})-(\d{2})")


def current_period() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def derive_period(date_value: object) -> str:
    """Best-effort ``YYYY-MM`` from a date-ish value, falling back to the
    current month if it can't be parsed."""
    text = str(date_value or "")
    match = _DATE_RE.match(text)
    if match:
        return f"{match.group(1)}-{match.group(2)}"
    return current_period()

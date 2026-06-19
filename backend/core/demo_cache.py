from __future__ import annotations

import hashlib
import json
from pathlib import Path

_CACHE_PATH = Path(__file__).resolve().parent.parent / "data" / "demo_extraction_cache.json"


def hash_bytes(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()


def lookup(file_bytes: bytes) -> dict | None:
    """Pre-extracted fallback JSON for the exact rehearsed demo invoice
    images, keyed by sha256 of the file bytes. Populate this once the
    real demo photos are chosen, so a live VLM hiccup on stage can't
    sink the demo. Empty by default.
    """
    if not _CACHE_PATH.exists():
        return None
    cache = json.loads(_CACHE_PATH.read_text())
    return cache.get(hash_bytes(file_bytes))

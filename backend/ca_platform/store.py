"""Tiny JSON-file persistence for the CA platform.

Deliberately not MongoDB: the WhatsApp adapter owns the Mongo-backed trader
sessions, but the CA SaaS is a separate tenant model and we want it to run
out-of-the-box for a demo with zero infra. One process, one file, guarded by a
lock. Swappable for a real database behind the same accessor functions.
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

_STORE_PATH = Path(
    os.environ.get(
        "CA_STORE_PATH", str(Path(__file__).resolve().parent / "data" / "store.json")
    )
)
_LOCK = threading.RLock()


def _empty_state() -> dict[str, Any]:
    return {
        "firm": {
            "id": "firm_demo",
            "name": "Sharma & Associates, Chartered Accountants",
            "plan": "Professional",
            "seats": 8,
        },
        "clients": [],
        "invoices": {},      # client_id -> [invoice dict]
        "baselines": {},     # client_id -> [2b dict]
        "reconciliations": {},  # client_id -> last reconciliation snapshot
        "erp_keys": {},      # api_key -> client_id
        "activity": [],      # firm-wide audit log
    }


def _load() -> dict[str, Any]:
    if _STORE_PATH.exists():
        with open(_STORE_PATH, encoding="utf-8") as f:
            return json.load(f)
    state = _empty_state()
    _save(state)
    return state


def _save(state: dict[str, Any]) -> None:
    _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = _STORE_PATH.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2, default=str)
    tmp.replace(_STORE_PATH)


def read() -> dict[str, Any]:
    with _LOCK:
        return _load()


def mutate(fn) -> Any:
    """Run ``fn(state)`` under the lock and persist. ``fn`` may return a value
    which is passed back to the caller."""
    with _LOCK:
        state = _load()
        result = fn(state)
        _save(state)
        return result


def reset(state: dict[str, Any] | None = None) -> None:
    """Replace the whole store (used by the seeder)."""
    with _LOCK:
        _save(state if state is not None else _empty_state())

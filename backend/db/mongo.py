from __future__ import annotations

import os
from functools import lru_cache

from pymongo import ASCENDING, MongoClient
from pymongo.database import Database


@lru_cache(maxsize=1)
def get_client() -> MongoClient:
    uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
    return MongoClient(uri)


def get_db() -> Database:
    db_name = os.environ.get("MONGODB_DB_NAME", "munshi")
    return get_client()[db_name]


def get_collection(name: str):
    return get_db()[name]


# Index specs for collections introduced by the CA platform's Mongo
# migration. Safe to call repeatedly (create_index is idempotent).
_INDEX_SPECS: dict[str, list[tuple[str, int]] | list[list[tuple[str, int]]]] = {
    "ca_clients": [[("firm_id", ASCENDING)]],
    "ca_invoices": [
        [("client_id", ASCENDING), ("period", ASCENDING)],
        [("client_id", ASCENDING), ("vendor_gstin", ASCENDING), ("invoice_number", ASCENDING)],
    ],
    "ca_baselines": [
        [("client_id", ASCENDING), ("period", ASCENDING)],
        [("client_id", ASCENDING), ("vendor_gstin", ASCENDING), ("invoice_number", ASCENDING)],
    ],
    "ca_reconciliation_runs": [[("client_id", ASCENDING), ("period", ASCENDING)]],
    "ca_issues": [
        [("client_id", ASCENDING)],
        [("vendor_gstin", ASCENDING)],
        [("status", ASCENDING)],
        [("period", ASCENDING)],
    ],
    "ca_alerts": [[("client_id", ASCENDING)], [("acked_at", ASCENDING)]],
    "ca_reminders": [[("client_id", ASCENDING)], [("status", ASCENDING)]],
    "ca_audit_logs": [[("client_id", ASCENDING)], [("at", ASCENDING)]],
    "ca_suppliers": [[("name", ASCENDING)]],
    "ca_users": [[("email", ASCENDING)]],
    "ca_sessions": [[("token_hash", ASCENDING)], [("user_id", ASCENDING)]],
    "ca_client_accounts": [[("email", ASCENDING)]],
    "ca_client_sessions": [[("token_hash", ASCENDING)], [("client_id", ASCENDING)]],
    "baselines": [[("trader_id", ASCENDING)]],
    "invoices": [[("trader_id", ASCENDING)]],
}


def ensure_indexes() -> None:
    db = get_db()
    for collection_name, specs in _INDEX_SPECS.items():
        for spec in specs:
            db[collection_name].create_index(spec)

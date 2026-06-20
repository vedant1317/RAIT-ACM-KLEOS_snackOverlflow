"""MongoDB-backed persistence for the CA platform.

Replaces the original single JSON-file store. Each tenant-scoped collection
is prefixed ``ca_`` to avoid colliding with the WhatsApp/trader-flow's own
``invoices``/``baselines`` collections in the same database (those are keyed
by ``trader_id`` and hold a different shape entirely). Documents use
caller-assigned string ids as the Mongo ``_id`` (no ``ObjectId``), so ids stay
stable, human-debuggable, and round-trip through the API as a plain ``id``
field.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from ..core.period_utils import current_period, derive_period
from ..core.security import generate_token, hash_password, hash_secret
from ..db.mongo import get_db

FIRM_ID = "firm_demo"


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def _public(doc: dict | None) -> dict | None:
    if doc is None:
        return None
    doc = dict(doc)
    doc["id"] = doc.pop("_id")
    return doc


def _public_many(docs: Any) -> list[dict]:
    return [_public(d) for d in docs]


# --------------------------------------------------------------------------- #
# firm
# --------------------------------------------------------------------------- #
def get_firm(firm_id: str = FIRM_ID) -> dict | None:
    return _public(get_db().ca_firms.find_one({"_id": firm_id}))


def upsert_firm(firm: dict) -> dict:
    doc = dict(firm)
    doc["_id"] = doc.pop("id", None) or doc.get("_id") or FIRM_ID
    get_db().ca_firms.update_one({"_id": doc["_id"]}, {"$set": doc}, upsert=True)
    return get_firm(doc["_id"])


# --------------------------------------------------------------------------- #
# users (CA admin auth — bearer token gates /ca/*)
# --------------------------------------------------------------------------- #
def create_user(firm_id: str, name: str, email: str, role: str, raw_token: str, raw_password: str | None = None) -> dict:
    doc = {
        "_id": new_id("usr"),
        "firm_id": firm_id,
        "name": name,
        "email": email.strip().lower(),
        "role": role,
        "token_hash": hash_secret(raw_token),
        "password_hash": hash_password(raw_password) if raw_password else None,
        "created_at": now(),
    }
    get_db().ca_users.insert_one(doc)
    return _public(doc)


def find_user_by_token_hash(token_hash: str) -> dict | None:
    return _public(get_db().ca_users.find_one({"token_hash": token_hash}))


def find_user_by_email(email: str) -> dict | None:
    return _public(get_db().ca_users.find_one({"email": email.strip().lower()}))


def find_user_by_id(user_id: str) -> dict | None:
    return _public(get_db().ca_users.find_one({"_id": user_id}))


def any_user_exists() -> bool:
    return get_db().ca_users.count_documents({}, limit=1) > 0


# --------------------------------------------------------------------------- #
# CA login sessions — issued by POST /ca/login, separate from the static
# CA_ADMIN_TOKEN (which keeps working for direct API/script access).
# --------------------------------------------------------------------------- #
def create_ca_session(user_id: str, ttl_days: int = 7) -> str:
    raw = generate_token("casess")
    get_db().ca_sessions.insert_one(
        {
            "_id": new_id("casess"),
            "user_id": user_id,
            "token_hash": hash_secret(raw),
            "created_at": now(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=ttl_days)).isoformat(),
        }
    )
    return raw


def find_user_by_session_token_hash(token_hash: str) -> dict | None:
    session = get_db().ca_sessions.find_one({"token_hash": token_hash})
    if session is None or session["expires_at"] < now():
        return None
    return find_user_by_id(session["user_id"])


def revoke_ca_session(token_hash: str) -> None:
    get_db().ca_sessions.delete_one({"token_hash": token_hash})


# --------------------------------------------------------------------------- #
# Client-portal accounts & sessions — self-service MSME/trader login, one
# account per CA client, scoped to that client's own data only.
# --------------------------------------------------------------------------- #
def create_client_account(client_id: str, email: str, raw_password: str) -> dict:
    doc = {
        "_id": client_id,
        "client_id": client_id,
        "email": email.strip().lower(),
        "password_hash": hash_password(raw_password),
        "created_at": now(),
    }
    get_db().ca_client_accounts.replace_one({"_id": client_id}, doc, upsert=True)
    return _public(doc)


def get_client_account(client_id: str) -> dict | None:
    return _public(get_db().ca_client_accounts.find_one({"_id": client_id}))


def find_client_account_by_email(email: str) -> dict | None:
    return _public(get_db().ca_client_accounts.find_one({"email": email.strip().lower()}))


def create_client_session(client_id: str, ttl_days: int = 7) -> str:
    raw = generate_token("clisess")
    get_db().ca_client_sessions.insert_one(
        {
            "_id": new_id("clisess"),
            "client_id": client_id,
            "token_hash": hash_secret(raw),
            "created_at": now(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=ttl_days)).isoformat(),
        }
    )
    return raw


def resolve_client_session(token_hash: str) -> str | None:
    session = get_db().ca_client_sessions.find_one({"token_hash": token_hash})
    if session is None or session["expires_at"] < now():
        return None
    return session["client_id"]


def revoke_client_session(token_hash: str) -> None:
    get_db().ca_client_sessions.delete_one({"token_hash": token_hash})


# --------------------------------------------------------------------------- #
# clients
# --------------------------------------------------------------------------- #
def list_clients(firm_id: str = FIRM_ID) -> list[dict]:
    cur = get_db().ca_clients.find({"firm_id": firm_id, "deleted_at": None}).sort("created_at", 1)
    return _public_many(cur)


def get_client(client_id: str) -> dict | None:
    return _public(get_db().ca_clients.find_one({"_id": client_id, "deleted_at": None}))


def client_exists(client_id: str) -> bool:
    return get_db().ca_clients.count_documents({"_id": client_id, "deleted_at": None}, limit=1) > 0


def insert_client(client: dict) -> dict:
    doc = dict(client)
    doc["_id"] = doc.pop("id")
    doc.setdefault("deleted_at", None)
    get_db().ca_clients.insert_one(doc)
    return _public(doc)


def soft_delete_client(client_id: str) -> None:
    get_db().ca_clients.update_one({"_id": client_id}, {"$set": {"deleted_at": now()}})


def set_client_erp_key_display(client_id: str, last4: str) -> None:
    get_db().ca_clients.update_one({"_id": client_id}, {"$set": {"erp_api_key_last4": last4}})


def set_client_field(client_id: str, field: str, value: Any) -> None:
    get_db().ca_clients.update_one({"_id": client_id}, {"$set": {field: value}})


# --------------------------------------------------------------------------- #
# invoices
# --------------------------------------------------------------------------- #
def add_invoices(client_id: str, records: list[dict], source: str = "manual") -> list[dict]:
    db = get_db()
    docs = []
    for record in records:
        doc = dict(record)
        doc["_id"] = new_id("inv")
        doc["client_id"] = client_id
        doc["period"] = doc.get("period") or derive_period(doc.get("invoice_date"))
        doc["source"] = source
        doc["added_at"] = now()
        doc.setdefault("needs_review", False)
        doc.setdefault("review_reasons", [])
        docs.append(doc)
    if docs:
        db.ca_invoices.insert_many(docs)
        for doc in docs:
            upsert_supplier(doc.get("vendor_gstin", ""), doc.get("vendor_name", ""), client_id)
    return _public_many(docs)


def list_invoices(client_id: str, period: str | None = None) -> list[dict]:
    query: dict[str, Any] = {"client_id": client_id}
    if period:
        query["period"] = period
    cur = get_db().ca_invoices.find(query).sort("added_at", 1)
    return _public_many(cur)


def count_invoices(client_id: str) -> int:
    return get_db().ca_invoices.count_documents({"client_id": client_id})


def list_invoice_periods(client_id: str) -> list[str]:
    return sorted(get_db().ca_invoices.distinct("period", {"client_id": client_id}))


def list_invoices_for_firm() -> list[dict]:
    return _public_many(get_db().ca_invoices.find({}))


def existing_invoice_keys(client_id: str) -> set[tuple[str, str]]:
    cur = get_db().ca_invoices.find({"client_id": client_id}, {"vendor_gstin": 1, "invoice_number": 1})
    return {
        (str(d.get("vendor_gstin", "")).strip().upper(), str(d.get("invoice_number", "")).strip().upper())
        for d in cur
    }


def insert_erp_sync_log(entry: dict) -> dict:
    doc = dict(entry)
    doc["_id"] = new_id("erpsync")
    doc["at"] = now()
    get_db().ca_erp_sync_log.insert_one(doc)
    return _public(doc)


def list_erp_sync_log(client_id: str, limit: int = 100) -> list[dict]:
    cur = get_db().ca_erp_sync_log.find({"client_id": client_id}).sort("at", -1).limit(limit)
    return _public_many(cur)


# --------------------------------------------------------------------------- #
# GSTR-2B baselines (re-uploading a period replaces just that period's rows)
# --------------------------------------------------------------------------- #
def set_baseline(client_id: str, records: list[dict], period: str | None = None) -> list[dict]:
    db = get_db()
    docs = []
    for record in records:
        doc = dict(record)
        row_period = period or current_period()
        doc["_id"] = new_id("2b")
        doc["client_id"] = client_id
        doc["period"] = row_period
        doc["uploaded_at"] = now()
        docs.append(doc)
    periods_touched = {d["period"] for d in docs} or {period or current_period()}
    db.ca_baselines.delete_many({"client_id": client_id, "period": {"$in": list(periods_touched)}})
    if docs:
        db.ca_baselines.insert_many(docs)
        for doc in docs:
            upsert_supplier(doc.get("vendor_gstin", ""), doc.get("vendor_name", ""), client_id)
    return _public_many(docs)


def list_baseline(client_id: str, period: str | None = None) -> list[dict]:
    query: dict[str, Any] = {"client_id": client_id}
    if period:
        query["period"] = period
    cur = get_db().ca_baselines.find(query)
    return _public_many(cur)


def count_baseline(client_id: str) -> int:
    return get_db().ca_baselines.count_documents({"client_id": client_id})


def list_baseline_periods(client_id: str) -> list[str]:
    return sorted(get_db().ca_baselines.distinct("period", {"client_id": client_id}))


# --------------------------------------------------------------------------- #
# reconciliation runs — every run kept, never overwritten
# --------------------------------------------------------------------------- #
def save_reconciliation_run(run: dict) -> dict:
    doc = dict(run)
    doc["_id"] = new_id("run")
    get_db().ca_reconciliation_runs.insert_one(doc)
    return _public(doc)


def latest_reconciliation_run(client_id: str, period: str | None = None) -> dict | None:
    query: dict[str, Any] = {"client_id": client_id}
    if period:
        query["period"] = period
    docs = list(get_db().ca_reconciliation_runs.find(query).sort("run_at", -1).limit(1))
    return _public(docs[0]) if docs else None


def list_reconciliation_runs(client_id: str, limit: int = 50) -> list[dict]:
    cur = get_db().ca_reconciliation_runs.find({"client_id": client_id}).sort("run_at", -1).limit(limit)
    return _public_many(cur)


# --------------------------------------------------------------------------- #
# issues — the ITC recovery tracker
# --------------------------------------------------------------------------- #
def upsert_issue(issue: dict) -> dict:
    db = get_db()
    issue_key = issue["issue_key"]
    existing = db.ca_issues.find_one({"_id": issue_key})
    doc = dict(issue)
    doc["_id"] = issue_key
    doc["last_seen_at"] = now()
    if existing:
        doc["first_seen_at"] = existing.get("first_seen_at", doc["last_seen_at"])
        doc["status"] = existing.get("status", "open")
        doc["note"] = existing.get("note", "")
        doc["updated_by"] = existing.get("updated_by")
        doc["updated_at"] = existing.get("updated_at")
    else:
        doc["first_seen_at"] = doc["last_seen_at"]
        doc.setdefault("status", "open")
        doc.setdefault("note", "")
        doc.setdefault("updated_by", None)
        doc.setdefault("updated_at", None)
    db.ca_issues.replace_one({"_id": issue_key}, doc, upsert=True)
    return _public(doc)


def get_issue(issue_key: str) -> dict | None:
    return _public(get_db().ca_issues.find_one({"_id": issue_key}))


def list_issues(
    client_id: str | None = None,
    status: str | None = None,
    vendor_gstin: str | None = None,
    period: str | None = None,
) -> list[dict]:
    query: dict[str, Any] = {}
    if client_id:
        query["client_id"] = client_id
    if status:
        query["status"] = status
    if vendor_gstin:
        query["vendor_gstin"] = vendor_gstin.strip().upper()
    if period:
        query["period"] = period
    cur = get_db().ca_issues.find(query).sort("last_seen_at", -1)
    return _public_many(cur)


def set_issue_status(issue_key: str, status: str, note: str, updated_by: str) -> dict | None:
    result = get_db().ca_issues.find_one_and_update(
        {"_id": issue_key},
        {"$set": {"status": status, "note": note, "updated_by": updated_by, "updated_at": now()}},
        return_document=True,
    )
    return _public(result)


# --------------------------------------------------------------------------- #
# suppliers — cross-client vendor directory
# --------------------------------------------------------------------------- #
def upsert_supplier(gstin: str, name: str, client_id: str) -> None:
    gstin = (gstin or "").strip().upper()
    if not gstin:
        return
    db = get_db()
    existing = db.ca_suppliers.find_one({"_id": gstin})
    timestamp = now()
    if existing is None:
        db.ca_suppliers.insert_one(
            {
                "_id": gstin,
                "name": name,
                "name_history": [{"name": name, "seen_at": timestamp}],
                "client_ids": [client_id],
                "first_seen_at": timestamp,
                "last_seen_at": timestamp,
            }
        )
        return
    update: dict[str, Any] = {"last_seen_at": timestamp}
    ops: dict[str, Any] = {"$set": update, "$addToSet": {"client_ids": client_id}}
    if name and name != existing.get("name"):
        update["name"] = name
        ops["$push"] = {"name_history": {"name": name, "seen_at": timestamp}}
    db.ca_suppliers.update_one({"_id": gstin}, ops)


def get_supplier(gstin: str) -> dict | None:
    return _public(get_db().ca_suppliers.find_one({"_id": (gstin or "").strip().upper()}))


def list_suppliers() -> list[dict]:
    return _public_many(get_db().ca_suppliers.find({}))


# --------------------------------------------------------------------------- #
# alerts
# --------------------------------------------------------------------------- #
def insert_alert(alert: dict) -> dict:
    doc = dict(alert)
    doc["_id"] = new_id("alert")
    doc["created_at"] = now()
    doc.setdefault("acked_at", None)
    doc.setdefault("acked_by", None)
    get_db().ca_alerts.insert_one(doc)
    return _public(doc)


def find_open_alert(client_id: str, alert_type: str, dedupe_key: str) -> dict | None:
    return _public(
        get_db().ca_alerts.find_one(
            {"client_id": client_id, "type": alert_type, "data.key": dedupe_key, "acked_at": None}
        )
    )


def list_alerts(client_id: str | None = None, acked: bool | None = None, firm_id: str | None = None) -> list[dict]:
    query: dict[str, Any] = {}
    if client_id:
        query["client_id"] = client_id
    if firm_id:
        query["firm_id"] = firm_id
    if acked is True:
        query["acked_at"] = {"$ne": None}
    elif acked is False:
        query["acked_at"] = None
    cur = get_db().ca_alerts.find(query).sort("created_at", -1)
    return _public_many(cur)


def ack_alert(alert_id: str, by: str) -> dict | None:
    result = get_db().ca_alerts.find_one_and_update(
        {"_id": alert_id}, {"$set": {"acked_at": now(), "acked_by": by}}, return_document=True
    )
    return _public(result)


# --------------------------------------------------------------------------- #
# reminders
# --------------------------------------------------------------------------- #
def insert_reminder(reminder: dict) -> dict:
    doc = dict(reminder)
    doc["_id"] = new_id("rem")
    doc["created_at"] = now()
    doc.setdefault("status", "pending")
    doc.setdefault("sent_at", None)
    get_db().ca_reminders.insert_one(doc)
    return _public(doc)


def list_reminders(client_id: str | None = None, status: str | None = None) -> list[dict]:
    query: dict[str, Any] = {}
    if client_id:
        query["client_id"] = client_id
    if status:
        query["status"] = status
    cur = get_db().ca_reminders.find(query).sort("created_at", -1)
    return _public_many(cur)


def mark_reminder_sent(reminder_id: str) -> None:
    get_db().ca_reminders.update_one({"_id": reminder_id}, {"$set": {"status": "sent", "sent_at": now()}})


# --------------------------------------------------------------------------- #
# audit / activity log
# --------------------------------------------------------------------------- #
def log_activity(client_id: str | None, kind: str, message: str, actor: str = "system") -> None:
    get_db().ca_audit_logs.insert_one(
        {
            "_id": new_id("act"),
            "client_id": client_id,
            "kind": kind,
            "message": message,
            "actor": actor,
            "at": now(),
        }
    )


def list_activity(client_id: str | None = None, limit: int = 200) -> list[dict]:
    query: dict[str, Any] = {}
    if client_id:
        query["client_id"] = client_id
    cur = get_db().ca_audit_logs.find(query).sort("at", -1).limit(limit)
    return _public_many(cur)


def purge_audit_logs_older_than(days: int) -> int:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    result = get_db().ca_audit_logs.delete_many({"at": {"$lt": cutoff}})
    return result.deleted_count


# --------------------------------------------------------------------------- #
# ERP API keys — hashed at rest, raw value only ever returned at creation
# --------------------------------------------------------------------------- #
def create_erp_key(client_id: str) -> str:
    raw = generate_token("erp")
    get_db().ca_erp_keys.insert_one(
        {
            "_id": new_id("erpkey"),
            "client_id": client_id,
            "key_hash": hash_secret(raw),
            "created_at": now(),
            "revoked_at": None,
        }
    )
    set_client_erp_key_display(client_id, raw[-4:])
    return raw


def resolve_erp_key(raw_key: str) -> str | None:
    doc = get_db().ca_erp_keys.find_one({"key_hash": hash_secret(raw_key), "revoked_at": None})
    return doc["client_id"] if doc else None


def revoke_erp_keys(client_id: str) -> None:
    get_db().ca_erp_keys.update_many({"client_id": client_id, "revoked_at": None}, {"$set": {"revoked_at": now()}})


# --------------------------------------------------------------------------- #
# destructive ops (seeding / demo reset only — never called from a request path)
# --------------------------------------------------------------------------- #
_CA_COLLECTIONS = [
    "ca_clients",
    "ca_invoices",
    "ca_baselines",
    "ca_reconciliation_runs",
    "ca_issues",
    "ca_suppliers",
    "ca_alerts",
    "ca_reminders",
    "ca_audit_logs",
    "ca_erp_keys",
    "ca_erp_sync_log",
    "ca_users",
    "ca_sessions",
    "ca_client_accounts",
    "ca_client_sessions",
]


def wipe_demo_data() -> None:
    db = get_db()
    for name in _CA_COLLECTIONS:
        db[name].delete_many({})

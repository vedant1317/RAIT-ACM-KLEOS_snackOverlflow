"""Seed a demo CA firm with several clients so the dashboards are populated.

``_build_state()`` is kept exactly as the original JSON-store version (same
four clients, same exact rupee figures) because ``tests/test_ca_matching.py``
calls it directly and asserts specific numbers from it — it must stay a pure,
Mongo-free in-memory builder. Everything Mongo-related (the real persistence
path used by the running API) lives in ``ensure_seeded()``/``force_reseed()``,
which write that same baseline data into MongoDB via ``store.py`` and then
layer additional demo data on top: a multi-month client with a repeat-offender
shared vendor, a services-sector client with SAC codes, and a couple of
issue-status examples so the ITC recovery tracker has something to show.
"""

from __future__ import annotations

import os

from ..core.security import generate_token
from . import store

_GST_FIELDS = (
    "vendor_name",
    "vendor_gstin",
    "invoice_number",
    "invoice_date",
    "taxable_value",
    "gst_rate",
    "gst_amount",
    "hsn_code",
)


def _inv(vendor, gstin, number, date, taxable, rate, amount, hsn) -> dict:
    return {
        "vendor_name": vendor,
        "vendor_gstin": gstin,
        "invoice_number": number,
        "invoice_date": date,
        "taxable_value": float(taxable),
        "gst_rate": float(rate),
        "gst_amount": float(amount),
        "hsn_code": str(hsn),
    }


def _only_gst_fields(record: dict) -> dict:
    return {k: record[k] for k in _GST_FIELDS}


def _now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


def _build_state() -> dict:
    """Pure, Mongo-free builder — DO NOT add Mongo calls here. Covered
    directly by tests/test_ca_matching.py with exact expected rupee figures."""
    clients = []
    invoices: dict[str, list] = {}
    baselines: dict[str, list] = {}
    erp_keys: dict[str, str] = {}

    def add_client(cid, name, gstin, industry, contact, phone, erp, books, twob):
        api_key = f"erp_{cid}_live_key"
        clients.append(
            {
                "id": cid,
                "name": name,
                "gstin": gstin,
                "industry": industry,
                "contact_name": contact,
                "contact_phone": phone,
                "erp_system": erp,
                "filing_frequency": "monthly",
                "created_at": _now(),
                "erp_api_key": api_key,
            }
        )
        invoices[cid] = [{**b, "id": f"{cid}_inv_{i}", "source": "erp", "added_at": _now()} for i, b in enumerate(books)]
        baselines[cid] = twob
        erp_keys[api_key] = cid

    # ---- Client A: Verma Kirana — small, mostly clean ---------------------- #
    add_client(
        "cli_verma",
        "Verma Kirana & General Store",
        "27AAAVK1234A1Z5",
        "Retail / Kirana",
        "Ramesh Verma",
        "+91 98200 11122",
        "Vyapar",
        books=[
            _inv("ABC Foods Pvt Ltd", "27ABCFA1234A1Z5", "VK-101", "2026-05-02", 20000, 5, 1000, 1006),
            _inv("ABC Foods Pvt Ltd", "27ABCFA1234A1Z5", "VK-102", "2026-05-05", 8000, 5, 400, "0901"),
            _inv("Sunrise Snacks", "27SUNAB5678B1Z2", "VK-103", "2026-05-09", 10000, 18, 1800, 2106),
            _inv("Kirana Supplies Co", "27KIRSU9090C1Z7", "VK-104", "2026-05-14", 5000, 5, 250, 1006),
        ],
        twob=[
            _inv("ABC Foods Pvt Ltd", "27ABCFA1234A1Z5", "VK-101", "2026-05-02", 20000, 5, 1000, 1006),
            _inv("ABC Foods Pvt Ltd", "27ABCFA1234A1Z5", "VK-102", "2026-05-05", 8000, 5, 400, "0901"),
            _inv("Sunrise Snacks", "27SUNAB5678B1Z2", "VK-103", "2026-05-09", 10000, 18, 1800, 2106),
        ],
    )

    # ---- Client B: Lakshmi Textiles — every issue type -------------------- #
    add_client(
        "cli_lakshmi",
        "Lakshmi Textiles Pvt Ltd",
        "24AAALT5678B1Z2",
        "Manufacturing / Textiles",
        "Anita Shah",
        "+91 99250 33344",
        "Tally Prime",
        books=[
            # HSN mismatch: 6109 is officially 5%, charged at 12%
            _inv("Surat Mills", "24SURMI1111E1Z9", "LT-201", "2026-05-03", 50000, 12, 6000, 6109),
            # amount mismatch vs 2B (book 1500 / 2B 1650)
            _inv("Cotton House", "24COTHO2222F1Z3", "LT-202", "2026-05-06", 30000, 5, 1500, 6109),
            # missing from 2B (supplier hasn't filed)
            _inv("Dye Works", "24DYEWO3333G1Z4", "LT-203", "2026-05-10", 20000, 18, 3600, 3923),
            # unknown HSN code
            _inv("Thread & Co", "24THRCO4444H1Z5", "LT-204", "2026-05-12", 10000, 18, 1800, 9999),
            # duplicate of LT-201
            _inv("Surat Mills", "24SURMI1111E1Z9", "LT-201", "2026-05-03", 50000, 12, 6000, 6109),
        ],
        twob=[
            _inv("Surat Mills", "24SURMI1111E1Z9", "LT-201", "2026-05-03", 50000, 12, 6000, 6109),
            _inv("Cotton House", "24COTHO2222F1Z3", "LT-202", "2026-05-06", 30000, 5, 1650, 6109),
            _inv("Thread & Co", "24THRCO4444H1Z5", "LT-204", "2026-05-12", 10000, 18, 1800, 9999),
            # in 2B but not in the books -> missing-in-books
            _inv("Velvet Traders", "24VELTR5555J1Z6", "LT-299", "2026-05-15", 15000, 5, 750, 6109),
        ],
    )

    # ---- Client C: Patel Pharma — high financial exposure ----------------- #
    add_client(
        "cli_patel",
        "Patel Pharma Distributors",
        "24AAAPP9012C1Z8",
        "Pharma / Distribution",
        "Nikhil Patel",
        "+91 98980 55566",
        "Marg ERP",
        books=[
            _inv("MedSource Labs", "24MEDSO1111K1Z1", "PP-301", "2026-05-04", 100000, 12, 12000, 3004),
            _inv("PharmaCorp", "24PHARM2222L1Z2", "PP-302", "2026-05-07", 40000, 12, 4800, 3004),
            _inv("BioGen Healthcare", "24BIOGE3333M1Z3", "PP-303", "2026-05-11", 25000, 12, 3000, 3004),
        ],
        twob=[
            _inv("PharmaCorp", "24PHARM2222L1Z2", "PP-302", "2026-05-07", 40000, 12, 4800, 3004),
            _inv("BioGen Healthcare", "24BIOGE3333M1Z3", "PP-303", "2026-05-11", 25000, 12, 2700, 3004),
        ],
    )

    # ---- Client D: TechNova — clean ------------------------------------- #
    add_client(
        "cli_technova",
        "TechNova Solutions LLP",
        "29AAATN3456D1Z4",
        "IT / Services",
        "Sofia Dsouza",
        "+91 99000 77788",
        "Zoho Books",
        books=[
            _inv("Dell India", "29DELLI1111N1Z1", "TN-401", "2026-05-08", 200000, 18, 36000, 8471),
            _inv("Apple Distribution", "29APPLE2222O1Z2", "TN-402", "2026-05-13", 150000, 18, 27000, 8517),
        ],
        twob=[
            _inv("Dell India", "29DELLI1111N1Z1", "TN-401", "2026-05-08", 200000, 18, 36000, 8471),
            _inv("Apple Distribution", "29APPLE2222O1Z2", "TN-402", "2026-05-13", 150000, 18, 27000, 8517),
        ],
    )

    activity = [
        {"id": "act_seed_3", "client_id": "cli_patel", "kind": "invoices_added",
         "message": "3 invoice(s) ingested via erp (Marg ERP)", "at": _now()},
        {"id": "act_seed_2", "client_id": "cli_lakshmi", "kind": "baseline_uploaded",
         "message": "GSTR-2B uploaded (4 rows)", "at": _now()},
        {"id": "act_seed_1", "client_id": "cli_verma", "kind": "client_created",
         "message": "Onboarded client Verma Kirana & General Store", "at": _now()},
    ]

    return {
        "firm": {
            "id": "firm_demo",
            "name": "Sharma & Associates, Chartered Accountants",
            "plan": "Professional",
            "seats": 8,
        },
        "clients": clients,
        "invoices": invoices,
        "baselines": baselines,
        "reconciliations": {},
        "erp_keys": erp_keys,
        "activity": activity,
    }


# --------------------------------------------------------------------------- #
# extra demo data layered on top of the baseline four clients (Mongo-only):
# a multi-month client with a repeat-offender shared vendor, and a
# services-sector client exercising SAC codes.
# --------------------------------------------------------------------------- #
def _extra_clients() -> list[dict]:
    return [
        {
            "client": {
                "name": "Global General Traders",
                "gstin": "27AAAGG7890E1Z1",
                "industry": "Retail / Trading",
                "contact_name": "Priya Mehta",
                "contact_phone": "+91 98765 22233",
                "erp_system": "Tally Prime",
                "filing_frequency": "monthly",
            },
            "months": [
                {
                    "period": "2026-03",
                    "books": [
                        _inv("ABC Foods Pvt Ltd", "27ABCFA1234A1Z5", "GT-001", "2026-03-04", 15000, 5, 750, 1006),
                        # repeat offender: same vendor as cli_lakshmi's HSN issue, different client/month
                        _inv("Surat Mills", "24SURMI1111E1Z9", "GT-002", "2026-03-09", 40000, 12, 4800, 6109),
                    ],
                    "twob": [
                        _inv("ABC Foods Pvt Ltd", "27ABCFA1234A1Z5", "GT-001", "2026-03-04", 15000, 5, 750, 1006),
                        _inv("Surat Mills", "24SURMI1111E1Z9", "GT-002", "2026-03-09", 40000, 12, 4800, 6109),
                    ],
                },
                {
                    "period": "2026-04",
                    "books": [
                        _inv("ABC Foods Pvt Ltd", "27ABCFA1234A1Z5", "GT-004", "2026-04-06", 20000, 5, 1000, 1006),
                        # Surat Mills slips again — missing from 2B this time
                        _inv("Surat Mills", "24SURMI1111E1Z9", "GT-005", "2026-04-11", 35000, 12, 4200, 6109),
                    ],
                    "twob": [
                        _inv("ABC Foods Pvt Ltd", "27ABCFA1234A1Z5", "GT-004", "2026-04-06", 20000, 5, 1000, 1006),
                    ],
                },
                {
                    "period": "2026-05",
                    "books": [
                        _inv("ABC Foods Pvt Ltd", "27ABCFA1234A1Z5", "GT-006", "2026-05-05", 18000, 5, 900, 1006),
                        _inv("Velvet Traders", "24VELTR5555J1Z6", "GT-007", "2026-05-09", 12000, 5, 600, 6109),
                    ],
                    "twob": [
                        _inv("ABC Foods Pvt Ltd", "27ABCFA1234A1Z5", "GT-006", "2026-05-05", 18000, 5, 900, 1006),
                        _inv("Velvet Traders", "24VELTR5555J1Z6", "GT-007", "2026-05-09", 12000, 5, 600, 6109),
                    ],
                },
            ],
        },
        {
            "client": {
                "name": "Swift Logistics & Services",
                "gstin": "29AAASL6543F1Z9",
                "industry": "Logistics / Services",
                "contact_name": "Arjun Rao",
                "contact_phone": "+91 90000 44455",
                "erp_system": "Zoho Books",
                "filing_frequency": "monthly",
            },
            "months": [
                {
                    "period": "2026-05",
                    "books": [
                        # SAC (service) codes rather than HSN (goods)
                        _inv("CourierPro Services", "29COURI8888G1Z2", "SL-501", "2026-05-07", 25000, 18, 4500, 9968),
                        _inv("LegalEase Advisors", "29LEGAL9999H1Z3", "SL-502", "2026-05-12", 10000, 18, 1800, 9983),
                    ],
                    "twob": [
                        _inv("CourierPro Services", "29COURI8888G1Z2", "SL-501", "2026-05-07", 25000, 18, 4500, 9968),
                        _inv("LegalEase Advisors", "29LEGAL9999H1Z3", "SL-502", "2026-05-12", 10000, 18, 1800, 9983),
                    ],
                },
            ],
        },
    ]


def _extra_history_for_original_clients() -> dict[str, dict]:
    """One additional, earlier month (April) of real invoice/baseline data
    for each of the four original demo clients, layered on top of their
    May data — purely additive, never touches ``_build_state()``, so
    ``tests/test_ca_matching.py``'s exact asserted figures are untouched.

    This gives every client genuine multi-period reconciliation history
    (so the trend charts have more than one real point) and gives the
    alert engine a real before/after to compare — cli_patel's risk
    deliberately jumps >25% from April to May, which is exactly what
    triggers the "risk changed after upload" alert.
    """
    return {
        "cli_verma": {
            "period": "2026-04",
            "books": [
                _inv("ABC Foods Pvt Ltd", "27ABCFA1234A1Z5", "VK-A1", "2026-04-02", 15000, 5, 750, 1006),
                _inv("Sunrise Snacks", "27SUNAB5678B1Z2", "VK-A2", "2026-04-09", 9000, 18, 1620, 2106),
                _inv("Kirana Supplies Co", "27KIRSU9090C1Z7", "VK-A3", "2026-04-14", 4000, 12, 480, 1006),
            ],
            "twob": [
                _inv("ABC Foods Pvt Ltd", "27ABCFA1234A1Z5", "VK-A1", "2026-04-02", 15000, 5, 750, 1006),
                _inv("Kirana Supplies Co", "27KIRSU9090C1Z7", "VK-A3", "2026-04-14", 4000, 12, 480, 1006),
            ],
        },
        "cli_lakshmi": {
            "period": "2026-04",
            "books": [
                _inv("Surat Mills", "24SURMI1111E1Z9", "LT-A1", "2026-04-03", 40000, 12, 4800, 6109),
                _inv("Cotton House", "24COTHO2222F1Z3", "LT-A2", "2026-04-06", 25000, 5, 1250, 6109),
                _inv("Dye Works", "24DYEWO3333G1Z4", "LT-A3", "2026-04-10", 18000, 18, 3240, 3923),
            ],
            "twob": [
                _inv("Surat Mills", "24SURMI1111E1Z9", "LT-A1", "2026-04-03", 40000, 12, 4800, 6109),
                _inv("Cotton House", "24COTHO2222F1Z3", "LT-A2", "2026-04-06", 25000, 5, 1250, 6109),
            ],
        },
        "cli_patel": {
            "period": "2026-04",
            "books": [
                _inv("MedSource Labs", "24MEDSO1111K1Z1", "PP-A1", "2026-04-04", 80000, 12, 9600, 3004),
                _inv("PharmaCorp", "24PHARM2222L1Z2", "PP-A2", "2026-04-07", 35000, 12, 4200, 3004),
            ],
            "twob": [
                _inv("PharmaCorp", "24PHARM2222L1Z2", "PP-A2", "2026-04-07", 35000, 12, 4200, 3004),
            ],
        },
        "cli_technova": {
            "period": "2026-04",
            "books": [
                _inv("Dell India", "29DELLI1111N1Z1", "TN-A1", "2026-04-08", 180000, 18, 32400, 8471),
                _inv("Apple Distribution", "29APPLE2222O1Z2", "TN-A2", "2026-04-13", 140000, 18, 25200, 8517),
            ],
            "twob": [
                _inv("Dell India", "29DELLI1111N1Z1", "TN-A1", "2026-04-08", 180000, 18, 32400, 8471),
                _inv("Apple Distribution", "29APPLE2222O1Z2", "TN-A2", "2026-04-13", 140000, 18, 25200, 8517),
            ],
        },
    }


def _seed_extra_history_into_mongo() -> None:
    for client_id, month in _extra_history_for_original_clients().items():
        books = [_only_gst_fields(b) for b in month["books"]]
        twob = [_only_gst_fields(b) for b in month["twob"]]
        store.add_invoices(client_id, books, source="import")
        store.set_baseline(client_id, twob, period=month["period"])


def _seed_baseline_clients_into_mongo() -> None:
    state = _build_state()
    store.upsert_firm(state["firm"])
    for client in state["clients"]:
        client_id = client["id"]
        store.insert_client({**client, "id": client_id, "firm_id": state["firm"]["id"]})
        store.create_erp_key(client_id)  # real hashed key; the demo key in _build_state() is display-only
        books = [_only_gst_fields(b) for b in state["invoices"][client_id]]
        twob = [_only_gst_fields(b) for b in state["baselines"][client_id]]
        store.add_invoices(client_id, books, source="erp")
        store.set_baseline(client_id, twob, period="2026-05")
        store.log_activity(client_id, "client_created", f"Onboarded client {client['name']}")
        store.log_activity(client_id, "invoices_added", f"{len(books)} invoice(s) ingested via erp ({client['erp_system']})")
        store.log_activity(client_id, "baseline_uploaded", f"GSTR-2B uploaded ({len(twob)} rows)")


def _seed_extra_clients_into_mongo() -> None:
    for entry in _extra_clients():
        client_id = store.new_id("cli")
        client = {**entry["client"], "id": client_id, "firm_id": store.FIRM_ID, "created_at": store.now()}
        store.insert_client(client)
        store.create_erp_key(client_id)
        for month in entry["months"]:
            books = [_only_gst_fields(b) for b in month["books"]]
            twob = [_only_gst_fields(b) for b in month["twob"]]
            store.add_invoices(client_id, books, source="import")
            store.set_baseline(client_id, twob, period=month["period"])
        store.log_activity(client_id, "client_created", f"Onboarded client {client['name']}")


def _seed_reconciliation_history_and_statuses() -> None:
    """Run reconciliation once per known period (oldest first) for every
    client, so ``ca_reconciliation_runs`` accumulates a real chronological
    trend instead of a single all-time snapshot — then mark a spread of
    issues with non-default statuses (some resolved, some still being
    chased) so the ITC recovery tracker, and the "money unlocked" figure
    in particular, have something real to show instead of zero for every
    client that actually has issues."""
    from . import service

    for client in store.list_clients():
        client_id = client["id"]
        periods = sorted(set(store.list_invoice_periods(client_id)) | set(store.list_baseline_periods(client_id)))
        for period in periods:
            try:
                service.run_reconcile(client_id, language="English", period=period)
            except Exception:
                continue

    _apply_demo_issue_statuses()


def _apply_demo_issue_statuses() -> None:
    """Idempotently stamp known-good demo statuses onto seeded issues.
    Called both after a fresh seed AND on every warm-start so that changes
    to this function take effect without a full wipe."""

    def _mark(client_id: str, invoice_number: str, issue_type: str, status: str, note: str) -> None:
        for issue in store.list_issues(client_id=client_id):
            if issue["invoice_number"] == invoice_number and issue["type"] == issue_type:
                store.set_issue_status(issue["id"], status, note, "seed")

    # Verma: the one open issue from May is already fixed — proves "money
    # unlocked" works even for a mostly-clean client.
    _mark("cli_verma", "VK-104", "missing_from_2b", "resolved", "Kirana Supplies Co re-filed the invoice; ITC recovered.")

    # Lakshmi: one still being chased, one already fixed.
    _mark("cli_lakshmi", "LT-203", "missing_from_2b", "chasing", "Called Dye Works on 18 May, awaiting GSTR-1 filing.")
    # LT-204's HSN code is unrecognised, so it carries zero rupee impact —
    # resolving it cleans up the data-quality flag but doesn't move "money
    # unlocked". LT-201's hsn_mismatch is the real money: resolve that too.
    _mark("cli_lakshmi", "LT-204", "hsn_mismatch", "resolved", "Supplier corrected the HSN code and reissued the invoice.")
    _mark("cli_lakshmi", "LT-201", "hsn_mismatch", "resolved", "Surat Mills agreed to revise the HSN rate on this invoice.")

    # Patel: the big one is still in progress, the smaller one is already
    # recovered.
    _mark("cli_patel", "PP-301", "missing_from_2b", "chasing", "Follow-up email sent to MedSource Labs.")
    _mark("cli_patel", "PP-303", "amount_diff", "resolved", "BioGen Healthcare corrected the GST amount on resubmission.")

    for client in store.list_clients():
        if client["name"] == "Global General Traders":
            _mark(client["id"], "GT-002", "hsn_mismatch", "resolved", "Surat Mills corrected the HSN code for this invoice.")


_DEMO_CLIENT_PASSWORD = os.environ.get("DEMO_CLIENT_PASSWORD", "demo1234")
_DEMO_ADMIN_PASSWORD = os.environ.get("CA_ADMIN_PASSWORD", "admin1234")


def ensure_seeded() -> None:
    """Seed only if the store has no clients yet."""
    if store.list_clients():
        _ensure_demo_admin_user()
        _ensure_demo_client_portal_accounts()
        _apply_demo_issue_statuses()  # re-apply on every warm-start
        return
    _seed_baseline_clients_into_mongo()
    _seed_extra_history_into_mongo()
    _seed_extra_clients_into_mongo()
    _seed_reconciliation_history_and_statuses()
    _ensure_demo_admin_user()
    _ensure_demo_client_portal_accounts()
    _run_post_seed_hooks()


def force_reseed() -> None:
    store.wipe_demo_data()
    _seed_baseline_clients_into_mongo()
    _seed_extra_history_into_mongo()
    _seed_extra_clients_into_mongo()
    _seed_reconciliation_history_and_statuses()
    _ensure_demo_admin_user()
    _ensure_demo_client_portal_accounts()
    _run_post_seed_hooks()


def _ensure_demo_admin_user() -> None:
    if store.any_user_exists():
        return
    raw_token = os.environ.get("CA_ADMIN_TOKEN") or generate_token("ca")
    store.create_user(
        store.FIRM_ID,
        "Demo Admin",
        "admin@sharma-associates.example",
        "admin",
        raw_token,
        raw_password=_DEMO_ADMIN_PASSWORD,
    )
    print(
        "\n[ca_platform.seed] CA admin login for the frontend:\n"
        "  email:    admin@sharma-associates.example\n"
        f"  password: {_DEMO_ADMIN_PASSWORD}\n"
    )
    if not os.environ.get("CA_ADMIN_TOKEN"):
        print(
            "[ca_platform.seed] No CA_ADMIN_TOKEN set — generated a demo admin "
            f"bearer token for direct /ca/* API access:\n  {raw_token}\n"
            "Set CA_ADMIN_TOKEN in backend/.env to keep this stable across restarts.\n"
        )


def _ensure_demo_client_portal_accounts() -> None:
    """Give every seeded client a self-service login so the frontend's
    'Client Mode' has real demo credentials to log in with."""
    created = []
    for client in store.list_clients():
        if store.get_client_account(client["id"]) is not None:
            continue
        email = f"{client['id']}@demo.munshi.local"
        store.create_client_account(client["id"], email, _DEMO_CLIENT_PASSWORD)
        created.append((client["name"], email))
    if created:
        lines = "\n".join(f"  {name}: {email} / {_DEMO_CLIENT_PASSWORD}" for name, email in created)
        print(f"\n[ca_platform.seed] Client portal logins (password is the same for all demo clients):\n{lines}\n")


def _run_post_seed_hooks() -> None:
    """Best-effort: light up alerts/reminders examples once those modules
    exist, without making seeding depend on their build order."""
    try:
        from ..core import alert_engine

        alert_engine.evaluate_all()
    except Exception:
        pass

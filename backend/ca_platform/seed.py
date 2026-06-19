"""Seed a demo CA firm with several clients so the dashboards are populated.

Each client's books + GSTR-2B are crafted to exercise every mapping outcome:
matched, duplicate, missing-in-2B, missing-in-books, amount/detail mismatch,
and HSN issues — so the invoice manager always has something concrete to show.
"""

from __future__ import annotations

from datetime import datetime, timezone

from . import store


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


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_state() -> dict:
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


def ensure_seeded() -> None:
    """Seed only if the store has no clients yet."""
    state = store.read()
    if state.get("clients"):
        return
    store.reset(_build_state())


def force_reseed() -> None:
    store.reset(_build_state())

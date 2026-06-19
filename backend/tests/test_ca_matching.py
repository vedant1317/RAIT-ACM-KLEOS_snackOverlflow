from __future__ import annotations

from backend.ca_platform import matching
from backend.ca_platform.seed import _build_state


def _client(state, cid):
    return matching.build_mapping(state["invoices"][cid], state["baselines"][cid])


def test_lakshmi_catches_every_mapping_outcome():
    state = _build_state()
    m = _client(state, "cli_lakshmi")
    s = m["summary"]

    # Every outcome the CA invoice manager is meant to surface.
    assert s["duplicates"] == 1
    assert s["missing_in_2b"] == 1
    assert s["missing_in_books"] == 1
    assert s["hsn_issues"] == 2  # 6109 charged at 12% + unknown 9999
    assert s["mismatches"] >= 2

    by_status = {}
    for row in m["rows"]:
        by_status.setdefault(row["status"], []).append(row)

    # The amount mismatch is reported field-by-field.
    cotton = next(r for r in by_status["mismatch"] if r["invoice_number"] == "LT-202")
    assert any(d["field"] == "gst_amount" for d in cotton["field_diffs"])

    # A 2B row absent from the books is flagged in the reverse direction.
    assert any(r["invoice_number"] == "LT-299" for r in by_status["missing_in_books"])


def test_clean_client_scores_full_health():
    state = _build_state()
    s = _client(state, "cli_technova")["summary"]
    assert s["total_issues"] == 0
    assert s["health_score"] == 100


def test_itc_amounts_are_deterministic():
    state = _build_state()
    s = _client(state, "cli_patel")["summary"]
    # PP-301 fully blocked (12000) + PP-303 amount diff (3000-2700=300)
    assert s["itc_at_risk"] == 12300.0
    assert s["missing_in_2b"] == 1

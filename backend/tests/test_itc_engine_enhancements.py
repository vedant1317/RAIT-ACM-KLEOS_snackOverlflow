from __future__ import annotations

from backend.core import itc_engine


def test_classify_impact_category():
    assert itc_engine.classify_impact_category("missing_from_2b") == "itc_blocked"
    assert itc_engine.classify_impact_category("duplicate") == "wrong_claim_risk"
    assert itc_engine.classify_impact_category("amount_diff") == "itc_recoverable"
    assert itc_engine.classify_impact_category("hsn_mismatch") == "itc_recoverable"
    assert itc_engine.classify_impact_category("missing_in_books") == "book_missing_opportunity"


def test_severity_escalates_for_high_impact_regardless_of_base():
    assert itc_engine.severity_for(100, "medium") == "medium"
    assert itc_engine.severity_for(6000, "medium") == "high"
    assert itc_engine.severity_for(100, "high") == "high"


def test_check_blocked_credit_only_flags_known_codes():
    assert itc_engine.check_blocked_credit("8703") is not None
    assert itc_engine.check_blocked_credit("1006") is None
    assert itc_engine.check_blocked_credit("") is None
    assert itc_engine.check_blocked_credit(None) is None

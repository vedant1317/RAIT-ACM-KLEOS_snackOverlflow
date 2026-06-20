from __future__ import annotations

from backend.core import hsn_category


def test_known_goods_code_categorised():
    info = hsn_category.categorise("1006")
    assert info["type"] == "goods"
    assert info["category"] == "food_grains"


def test_known_service_code_categorised():
    info = hsn_category.categorise("9983")
    assert info["type"] == "services"
    assert info["category"] == "professional_services"


def test_unknown_goods_like_code_falls_back_to_prefix_heuristic():
    guess = hsn_category.categorise("12345")
    assert guess["type"] == "goods"
    assert guess["category"] == "uncategorised"


def test_unknown_sac_like_code_falls_back_to_services():
    guess = hsn_category.categorise("9999")
    assert guess["type"] == "services"
    assert guess["category"] == "uncategorised"

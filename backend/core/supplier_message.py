"""Deterministic supplier follow-up message drafts, with optional Groq
polish. The rupee figures and facts always come from an already-computed
issue — Groq, when available, only rephrases the same facts more politely;
it never invents or changes a number.
"""

from __future__ import annotations

import os

_TEMPLATES = {
    "en": (
        "Dear {vendor_name}, regarding invoice {invoice_number}: {plain_problem} "
        "This is affecting Rs.{rupee_impact:,.2f} of our input tax credit. {ask} Thank you."
    ),
    "hi": (
        "Namaste {vendor_name}, bill {invoice_number} ke baare mein: {plain_problem} "
        "Iski wajah se humara Rs.{rupee_impact:,.2f} ka ITC atka hua hai. {ask} Dhanyavaad."
    ),
    "mr": (
        "Namaskar {vendor_name}, bill {invoice_number} sambandhi: {plain_problem} "
        "Yamule amcha Rs.{rupee_impact:,.2f} cha ITC adkun rahila aahe. {ask} Dhanyavaad."
    ),
}


def _fallback_ask(recommendation: str) -> str:
    """``recommendation`` is written as CA-facing advice ("Ask supplier X to
    ..."), not a sentence addressed to the supplier — only used when an
    issue has no ``action_card.supplier_message_hint`` (e.g. older data)."""
    if not recommendation:
        return "Could you please look into this and let us know?"
    action = recommendation[0].lower() + recommendation[1:]
    return f"Could you please {action}"


def draft_message(issue: dict, language: str = "en") -> str:
    """Build a forwardable supplier message from an already-computed issue
    dict (as produced by ``ca_platform.matching``). Deterministic — no AI
    required for the v1 draft. Prefers the issue's own
    ``action_card.supplier_message_hint`` (already phrased as a message to
    the supplier) over the CA-facing ``recommendation`` text."""
    lang = language if language in _TEMPLATES else "en"
    action_card = issue.get("action_card") or {}
    ask = action_card.get("supplier_message_hint") or _fallback_ask(issue.get("recommendation", ""))
    template = _TEMPLATES[lang]
    return template.format(
        vendor_name=issue.get("vendor_name", "Supplier"),
        invoice_number=issue.get("invoice_number", ""),
        plain_problem=issue.get("message", ""),
        rupee_impact=issue.get("rupee_impact", 0.0),
        ask=ask,
    )


def polish_with_groq(draft: str, language: str = "en") -> str:
    """Optional politeness pass over the deterministic draft. Falls back to
    the draft unchanged if Groq is unavailable, so the message is always
    forwardable even without it."""
    _language_names = {"en": "English", "hi": "Hindi", "mr": "Marathi"}
    try:
        from groq import Groq

        client = Groq(api_key=os.environ["GROQ_API_KEY"])
        response = client.chat.completions.create(
            model=os.environ.get("GROQ_EXPLAIN_MODEL", "llama-3.3-70b-versatile"),
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Rewrite this GST-supplier follow-up message in polite, natural "
                        f"{_language_names.get(language, 'English')}. Keep every number, invoice "
                        "number, and vendor name exactly as given. Keep it short — 2-4 sentences."
                    ),
                },
                {"role": "user", "content": draft},
            ],
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return draft

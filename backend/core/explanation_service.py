from __future__ import annotations

import json
import os

from groq import Groq

from ..models.schemas import Mismatch

_MODEL = os.environ.get("GROQ_EXPLAIN_MODEL", "llama-3.3-70b-versatile")

_EXPLAIN_SYSTEM_PROMPT = (
    "You are Munshi, a friendly GST assistant for a small Indian trader. "
    "You will be given pre-computed facts about a GST compliance issue — "
    "never invent or recalculate any rupee figure, only restate the numbers "
    "you are given. Explain in simple, warm {language}: what is wrong, why "
    "it matters in money terms, and what to do next. Always mention the "
    "invoice number. Keep it to 2-3 short sentences. Avoid technical jargon "
    "like 'HSN mismatch' or 'reconciliation' — speak like you're talking to "
    "a shopkeeper, not a compliance officer."
)

_HEADLINE_SYSTEM_PROMPT = (
    "You are Munshi, a GST assistant. Write ONE short, encouraging headline "
    "in {language} telling the trader the exact rupee amount they can "
    "recover this month. Use the number given exactly, do not change it. "
    "Keep it under 20 words."
)


def _client() -> Groq:
    return Groq(api_key=os.environ["GROQ_API_KEY"])


def _fallback_explanation(mismatch: Mismatch) -> str:
    """Plain-template narration used if the Groq call fails. The rupee
    figure and recommendation always reach the trader even if the LLM
    phrasing layer is unavailable.
    """
    return (
        f"Invoice {mismatch.invoice_number} ({mismatch.vendor_name}): "
        f"Rs.{mismatch.rupee_impact} at risk. {mismatch.details.get('recommendation', '')}"
    )


def _fallback_headline(total_recoverable: float) -> str:
    return f"You can recover Rs.{total_recoverable} this month."


def explain_mismatch(mismatch: Mismatch, language: str = "Hindi") -> str:
    facts = {
        "type": mismatch.type.value,
        "invoice_number": mismatch.invoice_number,
        "vendor_name": mismatch.vendor_name,
        "rupee_impact": mismatch.rupee_impact,
        "recommendation": mismatch.details.get("recommendation"),
    }
    try:
        response = _client().chat.completions.create(
            model=_MODEL,
            messages=[
                {"role": "system", "content": _EXPLAIN_SYSTEM_PROMPT.format(language=language)},
                {"role": "user", "content": json.dumps(facts, ensure_ascii=False)},
            ],
            temperature=0.4,
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return _fallback_explanation(mismatch)


def summary_headline(total_recoverable: float, language: str = "Hindi") -> str:
    try:
        response = _client().chat.completions.create(
            model=_MODEL,
            messages=[
                {"role": "system", "content": _HEADLINE_SYSTEM_PROMPT.format(language=language)},
                {"role": "user", "content": f"Recoverable amount: Rs.{total_recoverable}"},
            ],
            temperature=0.4,
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return _fallback_headline(total_recoverable)

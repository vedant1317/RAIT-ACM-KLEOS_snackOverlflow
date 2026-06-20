"""Mirrors WhatsApp trader-flow activity into the CA platform.

The WhatsApp bot and the CA platform were built as two independent
pipelines with separate storage (``db.invoices``/``db.baselines`` keyed by
``trader_id`` vs. ``ca_invoices``/``ca_baselines`` keyed by ``client_id``).
For a live demo where a trader uploads real bills over WhatsApp and a CA
watches them land in the dashboard, the two need to be the same data.

This module is the bridge: whenever a CA client's ``contact_phone`` matches
the WhatsApp number messaging the bot, every trader-flow write
(confirm/confirm-batch/baseline upload/reconcile) is mirrored into that
client's CA-platform records too — reusing ``ca_platform.service``, so
there is exactly one reconciliation/issue-tracking implementation, not two.

Matching is opt-in: if no client's contact_phone matches, nothing happens
and the trader-flow behaves exactly as it always has.
"""

from __future__ import annotations

import logging
import re

from . import service, store

logger = logging.getLogger("munshi.whatsapp_bridge")


def _normalise_phone(phone: str | None) -> str:
    digits = re.sub(r"\D", "", phone or "")
    return digits[-10:] if len(digits) >= 10 else digits


def find_client_by_phone(phone: str) -> dict | None:
    target = _normalise_phone(phone)
    if not target:
        return None
    for client in store.list_clients():
        if _normalise_phone(client.get("contact_phone")) == target:
            return client
    return None


def mirror_invoice(trader_id: str, invoice: dict) -> None:
    client = find_client_by_phone(trader_id)
    if client is None:
        return
    try:
        service.add_invoices(client["id"], [invoice], source="whatsapp")
    except Exception:
        logger.exception("Failed to mirror invoice into client %s", client["id"])


def mirror_invoices_batch(trader_id: str, invoices: list[dict]) -> None:
    if not invoices:
        return
    client = find_client_by_phone(trader_id)
    if client is None:
        return
    try:
        service.add_invoices(client["id"], invoices, source="whatsapp")
    except Exception:
        logger.exception("Failed to mirror invoice batch into client %s", client["id"])


def mirror_baseline(trader_id: str, records: list[dict], period: str | None = None) -> None:
    client = find_client_by_phone(trader_id)
    if client is None:
        return
    resolved_period = period or (records[0].get("period") if records else None)
    try:
        service.set_baseline(client["id"], records, period=resolved_period)
    except Exception:
        logger.exception("Failed to mirror baseline into client %s", client["id"])


def mirror_reconcile(trader_id: str, language: str = "English") -> None:
    client = find_client_by_phone(trader_id)
    if client is None:
        return
    try:
        service.run_reconcile(client["id"], language=language)
    except Exception:
        logger.exception("Failed to mirror reconciliation into client %s", client["id"])

"""Auth dependencies for the CA platform.

Three trust boundaries:

* ``require_ca_auth`` — gates every ``/ca/*`` admin/dashboard route behind a
  bearer token. Accepts either the static ``ca_users.token_hash`` (for
  direct API/script access, e.g. ``CA_ADMIN_TOKEN``) or a session token
  issued by ``POST /ca/login`` (for the human-facing frontend login). There
  is no public unauthenticated CA API.
* ``require_client_auth`` — gates ``/client/*`` self-service routes behind a
  session token issued by ``POST /client/login``, scoped to exactly one CA
  client's own data.
* ``require_service_token`` — gates the trader-facing compliance-brain
  routes (``/extract-invoice``, ``/2b/upload``, ``/invoices/*``,
  ``/reconcile/*``, ``/traders/*``) that only the WhatsApp adapter should
  call, via a shared ``X-Service-Token`` secret. If ``SERVICE_TOKEN`` is
  unset the check is skipped (local dev without touching .env), but a
  warning is logged once.
"""

from __future__ import annotations

import logging
import os

from fastapi import Header, HTTPException

from ..core.security import constant_time_eq, hash_secret
from . import store

logger = logging.getLogger("munshi.auth")
_warned_no_service_token = False


async def require_ca_auth(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    raw_token = authorization.split(" ", 1)[1].strip()
    token_hash = hash_secret(raw_token)
    user = store.find_user_by_token_hash(token_hash) or store.find_user_by_session_token_hash(token_hash)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or revoked token")
    return user


async def require_client_auth(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    raw_token = authorization.split(" ", 1)[1].strip()
    client_id = store.resolve_client_session(hash_secret(raw_token))
    if client_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    client = store.get_client(client_id)
    if client is None:
        raise HTTPException(status_code=401, detail="Client account no longer exists")
    return client


async def require_service_token(x_service_token: str | None = Header(default=None)) -> None:
    global _warned_no_service_token
    expected = os.environ.get("SERVICE_TOKEN", "")
    if not expected:
        if not _warned_no_service_token:
            logger.warning("SERVICE_TOKEN is not set — trader-facing routes are unauthenticated.")
            _warned_no_service_token = True
        return
    if not constant_time_eq(x_service_token, expected):
        raise HTTPException(status_code=401, detail="Invalid service token")

"""Shared security primitives: secret hashing, token generation, PII masking.

Tokens and API keys handled here are high-entropy random strings (not
user-chosen passwords), so a single SHA-256 pass with a server-side pepper is
an appropriate, dependency-light way to avoid storing them in the clear —
this is not a password-hashing KDF and must not be used for human passwords.

Human-chosen passwords (CA login, client-portal login) use bcrypt instead —
a slow, salted KDF designed for low-entropy secrets.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets

import bcrypt

_PEPPER = os.environ.get("SECURITY_PEPPER", "munshi-dev-pepper-change-me")


def hash_secret(raw: str) -> str:
    return hashlib.sha256((_PEPPER + raw).encode("utf-8")).hexdigest()


def verify_secret(raw: str, hashed: str) -> bool:
    return hmac.compare_digest(hash_secret(raw), hashed)


def constant_time_eq(a: str | None, b: str | None) -> bool:
    return hmac.compare_digest(a or "", b or "")


def generate_token(prefix: str = "tok") -> str:
    return f"{prefix}_{secrets.token_hex(24)}"


def hash_password(raw_password: str) -> str:
    return bcrypt.hashpw(raw_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(raw_password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(raw_password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def generate_password(length: int = 10) -> str:
    """A short, demo-friendly random password (alphanumeric) — used when
    the CA doesn't supply one explicitly, shown once at account creation."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def mask_gstin(gstin: str | None) -> str:
    g = (gstin or "").strip()
    if len(g) <= 6:
        return "*" * len(g)
    return g[:2] + "*" * (len(g) - 6) + g[-4:]


def mask_phone(phone: str | None) -> str:
    digits = "".join(c for c in (phone or "") if c.isdigit())
    if len(digits) <= 4:
        return "*" * len(digits)
    return "*" * (len(digits) - 4) + digits[-4:]

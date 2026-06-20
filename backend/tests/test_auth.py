"""Integration tests for the CA login and client-portal login subsystems.
Like test_ca_platform_integration.py, these touch the real MongoDB instance
but only ever through a throwaway, clearly-namespaced client that cleans up
after itself.
"""

from __future__ import annotations

import pytest

from backend.core.security import hash_password, verify_password
from backend.ca_platform import store

_TEST_CLIENT_ID = "test_client_pytest_auth"
_TEST_USER_EMAIL = "pytest-admin@example.test"


@pytest.fixture
def fake_client():
    store.insert_client(
        {
            "id": _TEST_CLIENT_ID,
            "firm_id": "firm_demo",
            "name": "Pytest Auth Client",
            "gstin": "",
            "industry": "",
            "contact_name": "",
            "contact_phone": "",
            "erp_system": "",
            "filing_frequency": "monthly",
            "created_at": store.now(),
        }
    )
    try:
        yield _TEST_CLIENT_ID
    finally:
        db = store.get_db()
        db.ca_clients.delete_one({"_id": _TEST_CLIENT_ID})
        db.ca_client_accounts.delete_one({"_id": _TEST_CLIENT_ID})
        db.ca_client_sessions.delete_many({"client_id": _TEST_CLIENT_ID})


@pytest.fixture
def fake_user():
    user = store.create_user("firm_demo", "Pytest Admin", _TEST_USER_EMAIL, "admin", "pytest_raw_token", raw_password="pytest_pw_123")
    try:
        yield user
    finally:
        db = store.get_db()
        db.ca_users.delete_one({"_id": user["id"]})
        db.ca_sessions.delete_many({"user_id": user["id"]})


def test_password_hash_roundtrip():
    hashed = hash_password("correct-password")
    assert verify_password("correct-password", hashed)
    assert not verify_password("wrong-password", hashed)


def test_ca_session_created_and_resolved_and_revoked(fake_user):
    token = store.create_ca_session(fake_user["id"])
    from backend.core.security import hash_secret

    resolved = store.find_user_by_session_token_hash(hash_secret(token))
    assert resolved is not None
    assert resolved["id"] == fake_user["id"]

    store.revoke_ca_session(hash_secret(token))
    assert store.find_user_by_session_token_hash(hash_secret(token)) is None


def test_client_account_login_round_trip(fake_client):
    store.create_client_account(fake_client, "owner@pytest.example", "client-pw-456")

    account = store.find_client_account_by_email("owner@pytest.example")
    assert account is not None
    assert account["client_id"] == fake_client
    assert verify_password("client-pw-456", account["password_hash"])
    assert not verify_password("wrong", account["password_hash"])


def test_client_session_scoped_to_one_client(fake_client):
    store.create_client_account(fake_client, "owner2@pytest.example", "client-pw-789")
    account = store.find_client_account_by_email("owner2@pytest.example")
    token = store.create_client_session(account["client_id"])

    from backend.core.security import hash_secret

    assert store.resolve_client_session(hash_secret(token)) == fake_client
    assert store.resolve_client_session(hash_secret("not-a-real-token")) is None

    store.revoke_client_session(hash_secret(token))
    assert store.resolve_client_session(hash_secret(token)) is None


def test_recreating_account_replaces_previous_password(fake_client):
    store.create_client_account(fake_client, "owner3@pytest.example", "first-password")
    store.create_client_account(fake_client, "owner3@pytest.example", "second-password")

    account = store.get_client_account(fake_client)
    assert not verify_password("first-password", account["password_hash"])
    assert verify_password("second-password", account["password_hash"])

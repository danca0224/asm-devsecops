"""
Pruebas unitarias — Autenticación JWT
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from datetime import timedelta

from app.auth.jwt import create_access_token, verify_password, hash_password


def test_hash_and_verify_password():
    password = "TestPassword123!"
    hashed = hash_password(password)
    assert verify_password(password, hashed)
    assert not verify_password("WrongPassword", hashed)


def test_create_access_token():
    data = {"sub": "testuser", "role": "user"}
    token = create_access_token(data, expires_delta=timedelta(minutes=30))
    assert isinstance(token, str)
    assert len(token) > 0


def test_create_access_token_with_role():
    data = {"sub": "admin", "role": "admin"}
    token = create_access_token(data)
    from jose import jwt
    import os
    # Decode without verification for structure test
    payload = jwt.decode(token, options={"verify_signature": False})
    assert payload["sub"] == "admin"
    assert payload["role"] == "admin"
    assert "exp" in payload

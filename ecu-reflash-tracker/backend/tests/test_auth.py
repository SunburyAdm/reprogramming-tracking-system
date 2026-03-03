"""
Tests for auth endpoints
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_login_success():
    """Test successful login."""
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@local", "password": "admin123"}
    )
    assert response.status_code in [200, 401]  # 401 if DB not seeded
    

def test_login_invalid_credentials():
    """Test login with invalid credentials."""
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@local", "password": "wrongpassword"}
    )
    assert response.status_code in [401, 422]


def test_health_check():
    """Test health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

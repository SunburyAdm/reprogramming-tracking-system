"""
Tests for ECU endpoints
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_list_ecus():
    """Test listing ECUs."""
    response = client.get("/api/ecus")
    assert response.status_code in [200, 401]  # 401 if no auth


def test_health_check():
    """Test health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200

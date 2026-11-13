"""Health and version endpoint tests, plus the error envelope contract."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import APP_VERSION
from app.main import create_app
from app.schemas.common import API_VERSION

from .conftest import PREFIX


def test_health(client):
    response = client.get(f"{PREFIX}/health")
    assert response.status_code == 200
    body = response.json()
    assert body == {"status": "ok", "version": APP_VERSION}


def test_legacy_unprefixed_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_version(client):
    response = client.get(f"{PREFIX}/version")
    assert response.status_code == 200
    body = response.json()
    assert body["api_version"] == API_VERSION
    assert body["build"] == APP_VERSION


def test_unknown_route_uses_error_envelope(client):
    response = client.get(f"{PREFIX}/definitely-not-a-route")
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "not_found"
    assert body["error"]["message"]
    assert body["error"]["details"] == []
    request_id = body["error"]["request_id"]
    assert request_id
    assert response.headers["X-Request-ID"] == request_id


def test_unhandled_error_uses_error_envelope(settings):
    app = create_app(settings)

    @app.get("/api/v1/boom", include_in_schema=False)
    def boom():  # pragma: no cover - route only exists for this test
        raise RuntimeError("boom")

    with TestClient(app, raise_server_exceptions=False) as test_client:
        response = test_client.get(f"{PREFIX}/boom")

    assert response.status_code == 500
    body = response.json()
    assert body["error"]["code"] == "internal_error"
    assert body["error"]["message"]
    assert response.headers["X-Request-ID"] == body["error"]["request_id"]


def test_validation_error_envelope(client):
    response = client.post(f"{PREFIX}/projects", json={})
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["details"]
    assert all(
        detail["message"] for detail in body["error"]["details"]
    )
    assert body["error"]["request_id"]


def test_validation_error_for_invalid_path_uuid(client):
    response = client.get(f"{PREFIX}/projects/not-a-uuid")
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    fields = {detail["field"] for detail in body["error"]["details"]}
    assert "project_id" in fields
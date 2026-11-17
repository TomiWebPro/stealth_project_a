"""OpenAPI / route-surface guard test (integration contract for all agents).

Locks the properties the live frontend transport and generated clients rely on:
every API route lives under ``/api/v1``, operation IDs are unique and stable,
and the error envelope applies uniformly. A sibling adding a router cannot
silently break the surface this guard protects.
"""

from __future__ import annotations

from collections import Counter
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import create_app
from app.schemas.common import API_PREFIX

HTTP_METHODS = {"get", "post", "put", "patch", "delete"}


def _client():
    from app.config import Settings

    return TestClient(create_app(Settings()))


def test_openapi_generates_with_unique_operation_ids():
    with _client() as client:
        schema = client.get("/openapi.json")
        assert schema.status_code == 200
        document = schema.json()
    operations = [
        operation.get("operationId")
        for methods in document["paths"].values()
        for method, operation in methods.items()
        if method in HTTP_METHODS
    ]
    assert all(operations), "Every operation must have an operationId."
    duplicates = {name: count for name, count in Counter(operations).items() if count > 1}
    assert not duplicates, f"Duplicate operationIds: {duplicates}"


def test_api_routes_are_prefixed():
    """Only the documented legacy health probe may live outside the prefix."""
    with _client() as client:
        document = client.get("/openapi.json").json()
    unprefixed = [
        path
        for path in document["paths"]
        if not path.startswith(API_PREFIX) and "/openapi.json" not in path
    ]
    assert unprefixed == [], f"Routes outside {API_PREFIX}: {unprefixed}"


def test_error_envelope_on_every_not_found_route():
    """A representative miss on each resource family uses the shared envelope."""
    with _client() as client:
        paths = [
            f"{API_PREFIX}/projects/{uuid4()}",
            f"{API_PREFIX}/assets/{uuid4()}",
            f"{API_PREFIX}/jobs/{uuid4()}",
            f"{API_PREFIX}/providers/missing",
            f"{API_PREFIX}/orgs/{uuid4()}",
            f"{API_PREFIX}/extensions/{uuid4()}",
            f"{API_PREFIX}/orchestration/runs/{uuid4()}",
        ]
        for path in paths:
            response = client.get(path)
            assert response.status_code == 404, path
            body = response.json()
            assert set(body) == {"error"}, path
            error = body["error"]
            assert error["code"] and error["message"], path
            assert "request_id" in error, path
            assert response.headers.get("X-Request-ID"), path

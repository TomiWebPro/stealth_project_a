"""Cross-cutting API robustness tests (C1).

Covers the shared error envelope, request-id propagation, the dev-local auth
headers, query pagination bounds, and behaviour under a burst of submissions.
These exercise stable endpoints only, so they are safe to run alongside work
in flight on newer routers.
"""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX

T2I = {"operation_id": "text-to-image", "schema_version": "1.0.0"}


def _project(client, name="Error Path Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _submit(client, project_id, **overrides):
    payload = {**T2I, "project_id": project_id, **overrides}
    return client.post(f"{PREFIX}/jobs", json=payload)


# --- Shared error envelope ---------------------------------------------------


def test_unknown_route_uses_error_envelope(client):
    response = client.get(f"{PREFIX}/does-not-exist")
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "not_found"
    assert isinstance(error["message"], str) and error["message"]
    assert error["details"] == []
    assert error["request_id"]


def test_domain_404_uses_error_envelope(client):
    response = client.get(f"{PREFIX}/projects/{uuid4()}")
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "project_not_found"
    assert error["request_id"]


def test_validation_error_lists_field_details(client):
    response = client.post(f"{PREFIX}/projects", json={"name": ""})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert any(detail["field"] == "name" for detail in error["details"])


def test_method_not_allowed_uses_error_envelope(client):
    response = client.patch(f"{PREFIX}/health")
    assert response.status_code == 405
    assert response.json()["error"]["code"] == "method_not_allowed"


def test_error_envelope_on_arbitrary_status_uses_http_error_code(client):
    # 405 is mapped through _HTTP_ERROR_CODES, not the generic http_error path.
    response = client.patch(f"{PREFIX}/health")
    assert response.json()["error"]["code"] in {"method_not_allowed", "http_error"}


# --- Request id --------------------------------------------------------------


def test_request_id_header_is_returned(client):
    response = client.get(f"{PREFIX}/health")
    assert response.headers.get("X-Request-ID")


def test_request_id_is_echoed_and_in_error_body(client):
    request_id = "test-request-123"
    response = client.get(
        f"{PREFIX}/projects/{uuid4()}", headers={"X-Request-ID": request_id}
    )
    assert response.status_code == 404
    assert response.headers["X-Request-ID"] == request_id
    assert response.json()["error"]["request_id"] == request_id


# --- Dev-local auth headers --------------------------------------------------


def test_created_by_follows_user_id_header(client):
    project = _project(client)
    user_id = uuid4()
    response = client.post(
        f"{PREFIX}/jobs",
        json={**T2I, "project_id": project["id"]},
        headers={"X-User-Id": str(user_id)},
    )
    assert response.status_code == 201
    assert response.json()["created_by"] == str(user_id)


def test_org_id_follows_org_header(client):
    org_id = uuid4()
    response = client.post(
        f"{PREFIX}/projects",
        json={"name": "Org Scoped"},
        headers={"X-Org-Id": str(org_id)},
    )
    assert response.status_code == 201
    assert response.json()["org_id"] == str(org_id)


def test_invalid_user_id_header_is_rejected(client):
    project = _project(client)
    response = client.post(
        f"{PREFIX}/jobs",
        json={**T2I, "project_id": project["id"]},
        headers={"X-User-Id": "not-a-uuid"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


# --- Pagination bounds -------------------------------------------------------


def test_job_limit_bounds_are_enforced(client):
    for bad_limit in (0, -1, 201):
        response = client.get(f"{PREFIX}/jobs", params={"limit": bad_limit})
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"


def test_job_limit_truncates_results(client):
    project = _project(client)
    for _ in range(5):
        assert _submit(client, project["id"]).status_code == 201
    assert len(client.get(f"{PREFIX}/jobs", params={"limit": 2}).json()) == 2


def test_conversation_limit_bounds_are_enforced(client):
    project = _project(client)
    conversation = client.post(
        f"{PREFIX}/projects/{project['id']}/conversations",
        json={"title": "Thread"},
    ).json()
    response = client.get(
        f"{PREFIX}/conversations/{conversation['id']}/messages",
        params={"limit": 1001},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


# --- Burst stability ---------------------------------------------------------


def test_burst_submissions_get_unique_ids_and_persist(client):
    project = _project(client)
    ids = set()
    for _ in range(20):
        response = _submit(client, project["id"])
        assert response.status_code == 201
        ids.add(response.json()["id"])
    assert len(ids) == 20
    listed = client.get(
        f"{PREFIX}/jobs", params={"project_id": project["id"], "limit": 200}
    ).json()
    assert {job["id"] for job in listed} == ids

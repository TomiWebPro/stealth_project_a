"""Project CRUD tests."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX


def _create_project(client, name="Alpha", description=None, headers=None):
    payload = {"name": name}
    if description is not None:
        payload["description"] = description
    return client.post(f"{PREFIX}/projects", json=payload, headers=headers or {})


def test_create_and_get_project(client, settings):
    response = _create_project(client, name="Campaign One", description="A test project")
    assert response.status_code == 201
    project = response.json()
    assert project["name"] == "Campaign One"
    assert project["description"] == "A test project"
    assert project["org_id"] == str(settings.default_org_id)
    assert project["created_by"] == str(settings.default_user_id)
    assert project["archived"] is False
    assert project["created_at"] and project["updated_at"]

    fetched = client.get(f"{PREFIX}/projects/{project['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == project


def test_create_project_uses_x_user_id(client):
    user_id = str(uuid4())
    response = _create_project(client, name="Mine", headers={"X-User-Id": user_id})
    assert response.status_code == 201
    assert response.json()["created_by"] == user_id


def test_list_projects(client):
    _create_project(client, name="First")
    _create_project(client, name="Second")
    response = client.get(f"{PREFIX}/projects")
    assert response.status_code == 200
    names = [project["name"] for project in response.json()]
    assert sorted(names) == ["First", "Second"]


def test_list_projects_filters_by_org(client, settings):
    _create_project(client, name="Visible")
    other_org = str(uuid4())
    response = client.get(f"{PREFIX}/projects", params={"org_id": other_org})
    assert response.status_code == 200
    assert response.json() == []
    response = client.get(
        f"{PREFIX}/projects", params={"org_id": str(settings.default_org_id)}
    )
    assert [project["name"] for project in response.json()] == ["Visible"]


def test_get_missing_project(client):
    response = client.get(f"{PREFIX}/projects/{uuid4()}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "project_not_found"


def test_update_project(client):
    project_id = _create_project(client).json()["id"]

    response = client.patch(
        f"{PREFIX}/projects/{project_id}",
        json={"name": "Renamed", "description": "Updated description"},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["name"] == "Renamed"
    assert updated["description"] == "Updated description"

    response = client.patch(
        f"{PREFIX}/projects/{project_id}", json={"description": None}
    )
    assert response.status_code == 200
    assert response.json()["description"] is None


def test_update_project_name_null_rejected(client):
    project_id = _create_project(client).json()["id"]
    response = client.patch(
        f"{PREFIX}/projects/{project_id}", json={"name": None}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_update_project_archived_null_rejected(client):
    project_id = _create_project(client).json()["id"]
    response = client.patch(
        f"{PREFIX}/projects/{project_id}", json={"archived": None}
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "invalid_request"
    assert body["error"]["details"] == [
        {"field": "archived", "message": "archived must be a boolean or omitted"}
    ]


def test_update_missing_project(client):
    response = client.patch(
        f"{PREFIX}/projects/{uuid4()}", json={"name": "Nope"}
    )
    assert response.status_code == 404


def test_archive_project_is_soft_delete(client):
    project_id = _create_project(client).json()["id"]

    response = client.delete(f"{PREFIX}/projects/{project_id}")
    assert response.status_code == 204

    project = client.get(f"{PREFIX}/projects/{project_id}").json()
    assert project["archived"] is True

    listed = next(
        entry
        for entry in client.get(f"{PREFIX}/projects").json()
        if entry["id"] == project_id
    )
    assert listed["archived"] is True


def test_archive_is_idempotent(client):
    project_id = _create_project(client).json()["id"]
    assert client.delete(f"{PREFIX}/projects/{project_id}").status_code == 204
    assert client.delete(f"{PREFIX}/projects/{project_id}").status_code == 204
    assert client.get(f"{PREFIX}/projects/{project_id}").json()["archived"] is True


def test_update_can_archive_and_restore(client):
    project_id = _create_project(client).json()["id"]

    archived = client.patch(
        f"{PREFIX}/projects/{project_id}", json={"archived": True}
    )
    assert archived.status_code == 200
    assert archived.json()["archived"] is True

    restored = client.patch(
        f"{PREFIX}/projects/{project_id}", json={"archived": False}
    )
    assert restored.status_code == 200
    assert restored.json()["archived"] is False


def test_archive_missing_project(client):
    response = client.delete(f"{PREFIX}/projects/{uuid4()}")
    assert response.status_code == 404
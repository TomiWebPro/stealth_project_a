"""Authoritative asset tag facet endpoint tests (success and failure paths)."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX


def _project(client, name="Tag Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _asset(client, project_id, name, **extra):
    payload = {
        "project_id": project_id,
        "type": "image",
        "name": name,
        "storage": {
            "backend": "local",
            "key": f"Output/{name}.png",
            "size_bytes": 0,
            "content_type": "image/png",
        },
        **extra,
    }
    response = client.post(f"{PREFIX}/assets/register", json=payload)
    assert response.status_code == 201
    return response.json()


def _index(client, **params):
    return client.get(f"{PREFIX}/tags", params=params)


def test_tags_are_authoritative_counted_and_sorted(client):
    project = _project(client)
    _asset(client, project["id"], "A", tags=["hero", "approved", "hero"])
    _asset(client, project["id"], "B", tags=["hero", "concept"])
    _asset(client, project["id"], "C", tags=[])

    response = _index(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    assert set(response.json()) == {"tags", "total"}

    body = response.json()
    assert body["total"] == 3
    assert body["tags"] == [
        {"name": "hero", "count": 2},
        {"name": "approved", "count": 1},
        {"name": "concept", "count": 1},
    ]

    # Duplicate tags on a single asset count once; an asset without tags is skipped.
    assert sum(facet["count"] for facet in body["tags"]) == 4


def test_tags_exclude_deleted_assets(client):
    project = _project(client)
    keep = _asset(client, project["id"], "Keep", tags=["kept", "shared"])
    gone = _asset(client, project["id"], "Gone", tags=["removed", "shared"])

    deleted = client.delete(f"{PREFIX}/assets/{gone['id']}")
    assert deleted.status_code == 204
    assert client.get(f"{PREFIX}/assets/{keep['id']}").status_code == 200

    body = _index(client).json()
    assert body["total"] == 2
    assert [facet["name"] for facet in body["tags"]] == ["kept", "shared"]
    assert all(facet["count"] == 1 for facet in body["tags"])


def test_tags_project_scope_prefix_and_limit(client):
    first = _project(client, "First")
    second = _project(client, "Second")
    _asset(client, first["id"], "A", tags=["character-hero", "character-villain", "scene"])
    _asset(client, first["id"], "B", tags=["character-hero", "prop"])
    _asset(client, second["id"], "C", tags=["other"])

    workspace = _index(client).json()
    assert workspace["total"] == 5

    scoped = _index(client, project_id=first["id"]).json()
    assert scoped["total"] == 4
    assert {facet["name"] for facet in scoped["tags"]} == {
        "character-hero",
        "character-villain",
        "scene",
        "prop",
    }

    # Prefix matching is case-insensitive and applied before counting.
    prefixed = _index(client, prefix="CHARACTER").json()
    assert prefixed["total"] == 2
    assert [facet["name"] for facet in prefixed["tags"]] == [
        "character-hero",
        "character-villain",
    ]

    no_match = _index(client, prefix="zzz").json()
    assert no_match == {"tags": [], "total": 0}

    limited = _index(client, limit=2).json()
    assert len(limited["tags"]) == 2
    assert limited["total"] == 5


def test_tags_empty_workspace_has_empty_index(client):
    response = _index(client)
    assert response.status_code == 200
    assert response.json() == {"tags": [], "total": 0}


def test_tags_unknown_project_uses_error_envelope(client):
    response = _index(client, project_id=uuid4())
    assert response.status_code == 404
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == "project_not_found"
    assert body["error"]["message"]
    assert body["error"]["request_id"] == response.headers["X-Request-ID"]


def test_tags_reject_invalid_filters(client):
    for params in (
        {"limit": 0},
        {"limit": 201},
        {"project_id": "not-a-uuid"},
        {"prefix": ""},
    ):
        response = _index(client, **params)
        assert response.status_code == 422, params
        assert response.json()["error"]["code"] == "validation_error"

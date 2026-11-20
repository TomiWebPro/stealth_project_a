"""Authoritative single-tag overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from uuid import uuid4

from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {"tag", "project_id", "project_name", "counts", "recent_assets", "generated_at"}
_COUNT_KEYS = {"tagged_assets", "tagged_projects", "scope_assets"}
_ASSET_KEYS = {
    "asset_id",
    "project_id",
    "project_name",
    "type",
    "name",
    "status",
    "version",
    "size_bytes",
    "created_at",
    "updated_at",
}


def _overview(client, tag, **params):
    return client.get(f"{PREFIX}/tags/{tag}/overview", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Tag Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _asset(client, project_id, name="Asset", tags=None):
    response = client.post(
        f"{PREFIX}/assets/register",
        json={
            "project_id": project_id,
            "type": "image",
            "name": name,
            "storage": {"key": f"{name}.png", "size_bytes": 16, "content_type": "image/png"},
            "tags": tags if tags is not None else [],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_overview_of_single_tag(client):
    _clear(client)
    project = _project(client, "Single")
    asset = _asset(client, project["id"], "Hero", ["hero", "keyart"])

    response = _overview(client, "hero")
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["tag"] == "hero"
    assert body["project_id"] is None
    assert body["project_name"] is None
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"] == {
        "tagged_assets": 1,
        "tagged_projects": 1,
        "scope_assets": 1,
    }
    assert len(body["recent_assets"]) == 1
    assert set(body["recent_assets"][0]) == _ASSET_KEYS
    assert body["recent_assets"][0]["asset_id"] == asset["id"]
    assert body["recent_assets"][0]["project_name"] == "Single"
    assert body["generated_at"]


def test_overview_scopes_counts_and_echoes_project(client):
    _clear(client)
    alpha = _project(client, "Alpha")["id"]
    beta = _project(client, "Beta")["id"]
    a1 = _asset(client, alpha, "A1", ["hero"])["id"]
    _asset(client, alpha, "A2", ["filler"])  # in-scope but not tagged
    b1 = _asset(client, beta, "B1", ["hero"])["id"]

    workspace = _overview(client, "hero").json()
    assert workspace["counts"] == {
        "tagged_assets": 2,
        "tagged_projects": 2,
        "scope_assets": 3,
    }
    assert {item["asset_id"] for item in workspace["recent_assets"]} == {a1, b1}

    scoped = _overview(client, "hero", project_id=alpha).json()
    assert scoped["project_id"] == alpha
    assert scoped["project_name"] == "Alpha"
    assert scoped["counts"] == {
        "tagged_assets": 1,
        "tagged_projects": 1,
        "scope_assets": 2,
    }
    assert [item["asset_id"] for item in scoped["recent_assets"]] == [a1]
    assert all(item["project_name"] == "Alpha" for item in scoped["recent_assets"])


def test_overview_recent_assets_newest_first_and_bounded(client):
    _clear(client)
    project_id = _project(client, "Order")["id"]
    for index in range(4):
        _asset(client, project_id, f"Asset {index}", ["hero"])

    full = _overview(client, "hero", recent_limit=50).json()["recent_assets"]
    assert len(full) == 4
    # Sorted newest-first with a deterministic id tie-break, same as /assets/feed.
    assert full == sorted(
        full, key=lambda item: (item["created_at"], item["asset_id"]), reverse=True
    )

    bounded = _overview(client, "hero", recent_limit=2).json()
    assert bounded["counts"]["tagged_assets"] == 4  # counts not bounded by the page
    assert bounded["recent_assets"] == full[:2]


def test_overview_excludes_deleted_and_matches_case_sensitively(client):
    _clear(client)
    project_id = _project(client, "Filtered")["id"]
    live = _asset(client, project_id, "Live", ["hero"])["id"]
    other_case = _asset(client, project_id, "OtherCase", ["HERO"])["id"]
    deleted = _asset(client, project_id, "Deleted", ["hero"])["id"]
    client.delete(f"{PREFIX}/assets/{deleted}")

    body = _overview(client, "hero").json()
    assert body["counts"] == {
        "tagged_assets": 1,
        "tagged_projects": 1,
        "scope_assets": 2,
    }
    assert [item["asset_id"] for item in body["recent_assets"]] == [live]
    assert other_case not in [item["asset_id"] for item in body["recent_assets"]]


def test_overview_joins_project_names_with_orphan_fallback(client):
    _clear(client)
    project = _project(client, "Joined")
    _asset(client, project["id"], "Orphan", ["hero"])
    assert _overview(client, "hero").json()["recent_assets"][0]["project_name"] == "Joined"

    client.app.state.store.delete(Collections.PROJECTS, project["id"])
    body = _overview(client, "hero").json()
    assert body["recent_assets"][0]["project_name"] == "Unknown project"
    assert body["counts"]["tagged_projects"] == 1  # still counted via asset.project_id


def test_overview_count_agrees_with_tag_facet(client):
    _clear(client)
    alpha = _project(client, "Alpha")["id"]
    beta = _project(client, "Beta")["id"]
    _asset(client, alpha, "A1", ["hero", "hero"])  # duplicate tag counted once
    _asset(client, beta, "B1", ["hero"])

    facet = next(
        facet
        for facet in client.get(f"{PREFIX}/tags").json()["tags"]
        if facet["name"] == "hero"
    )
    assert _overview(client, "hero").json()["counts"]["tagged_assets"] == facet["count"]

    scoped_facet = client.get(f"{PREFIX}/tags", params={"project_id": alpha}).json()
    alpha_facet = next(f for f in scoped_facet["tags"] if f["name"] == "hero")
    assert (
        _overview(client, "hero", project_id=alpha).json()["counts"]["tagged_assets"]
        == alpha_facet["count"]
    )


def test_unknown_tag_uses_shared_404_envelope(client):
    _clear(client)
    response = _overview(client, "missing")
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "tag_not_found"
    assert error["request_id"]


def test_unknown_project_uses_shared_404_envelope(client):
    _clear(client)
    response = _overview(client, "hero", project_id=uuid4())
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "project_not_found"


def test_malformed_project_id_uses_shared_422_envelope(client):
    _clear(client)
    response = _overview(client, "hero", project_id="not-a-uuid")
    assert response.status_code == 422
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "validation_error"


def test_invalid_recent_limit_uses_shared_422_envelope(client):
    _clear(client)
    project_id = _project(client, "Limits")["id"]
    _asset(client, project_id, "Limited", ["hero"])
    for limit in (0, 51):
        response = _overview(client, "hero", recent_limit=limit)
        assert response.status_code == 422
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"

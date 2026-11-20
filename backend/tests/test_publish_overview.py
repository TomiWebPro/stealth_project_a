"""Authoritative single publish-receipt overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from uuid import uuid4

from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {
    "asset_id",
    "asset_name",
    "asset_type",
    "project_id",
    "project_name",
    "version",
    "size_bytes",
    "published_at",
    "counts",
    "recent_siblings",
    "generated_at",
}
_COUNT_KEYS = {"project_published", "project_bytes", "total_published"}
_SIBLING_KEYS = {
    "asset_id",
    "asset_name",
    "asset_type",
    "project_id",
    "project_name",
    "version",
    "size_bytes",
    "published_at",
}


def _overview(client, asset_id, **params):
    return client.get(f"{PREFIX}/publishes/{asset_id}/overview", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Overview Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _storage(key="asset.png"):
    return {"key": key, "size_bytes": 16, "content_type": "image/png"}


def _asset(client, project_id, name="Asset", asset_type="image"):
    response = client.post(
        f"{PREFIX}/assets/register",
        json={
            "project_id": project_id,
            "type": asset_type,
            "name": name,
            "storage": _storage(),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _receipt(*, version=1, size_bytes=100, published_at="2026-01-01T00:00:00"):
    return {
        "version": version,
        "version_folder": f"Ver_{version:03d}",
        "size_bytes": size_bytes,
        "published_at": published_at,
        "checksum_sha256": "deadbeef",
    }


def _publish(client, asset_id, receipt=None):
    response = client.patch(
        f"{PREFIX}/assets/{asset_id}",
        json={"metadata": {"publish_receipt": receipt if receipt is not None else _receipt()}},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_overview_of_single_publish(client):
    _clear(client)
    project = _project(client, "Single")
    asset = _asset(client, project["id"], "Hero", "image")
    _publish(client, asset["id"], _receipt(version=2, size_bytes=250))

    response = _overview(client, asset["id"])
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["asset_id"] == asset["id"]
    assert body["asset_name"] == "Hero"
    assert body["asset_type"] == "image"
    assert body["project_id"] == project["id"]
    assert body["project_name"] == "Single"
    assert body["version"] == 2
    assert body["size_bytes"] == 250
    assert body["published_at"] == "2026-01-01T00:00:00"
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"] == {
        "project_published": 1,
        "project_bytes": 250,
        "total_published": 1,
    }
    assert len(body["recent_siblings"]) == 1
    assert set(body["recent_siblings"][0]) == _SIBLING_KEYS
    assert body["recent_siblings"][0]["asset_id"] == asset["id"]
    assert body["generated_at"]


def test_overview_counts_scope_project_and_workspace(client):
    _clear(client)
    alpha = _project(client, "Alpha")["id"]
    beta = _project(client, "Beta")["id"]
    a1 = _asset(client, alpha, "A1")["id"]
    a2 = _asset(client, alpha, "A2")["id"]
    b1 = _asset(client, beta, "B1")["id"]
    _publish(client, a1, _receipt(size_bytes=100))
    _publish(client, a2, _receipt(size_bytes=200))
    _publish(client, b1, _receipt(size_bytes=50))

    body = _overview(client, a1).json()
    assert body["counts"] == {
        "project_published": 2,
        "project_bytes": 300,
        "total_published": 3,
    }
    # Siblings are project-scoped: only the two Alpha publications appear.
    assert {item["asset_id"] for item in body["recent_siblings"]} == {a1, a2}
    assert all(item["project_name"] == "Alpha" for item in body["recent_siblings"])

    beta_body = _overview(client, b1).json()
    assert beta_body["counts"] == {
        "project_published": 1,
        "project_bytes": 50,
        "total_published": 3,
    }
    assert [item["asset_id"] for item in beta_body["recent_siblings"]] == [b1]


def test_overview_recent_siblings_newest_first_and_bounded(client):
    _clear(client)
    project_id = _project(client, "Siblings")["id"]
    ids = []
    for index in range(4):
        asset_id = _asset(client, project_id, f"Asset {index}")["id"]
        ids.append(asset_id)
        _publish(
            client,
            asset_id,
            _receipt(size_bytes=10, published_at=f"2026-01-0{index + 1}T00:00:00"),
        )

    full = _overview(client, ids[0]).json()
    assert [item["asset_id"] for item in full["recent_siblings"]] == list(reversed(ids))

    bounded = _overview(client, ids[0], recent_limit=2).json()
    assert bounded["counts"]["total_published"] == 4  # count not bounded by the page
    assert [item["asset_id"] for item in bounded["recent_siblings"]] == list(reversed(ids))[:2]


def test_overview_siblings_use_deterministic_asset_id_tie_break(client):
    _clear(client)
    project_id = _project(client, "Ties")["id"]
    ids = []
    for index in range(2):
        asset_id = _asset(client, project_id, f"Tie {index}")["id"]
        ids.append(asset_id)
        _publish(client, asset_id, _receipt(published_at="2026-01-01T00:00:00"))

    body = _overview(client, ids[0]).json()
    assert [item["asset_id"] for item in body["recent_siblings"]] == sorted(ids, reverse=True)


def test_overview_excludes_unpublished_malformed_and_deleted_siblings(client):
    _clear(client)
    project_id = _project(client, "Filtered")["id"]
    good = _asset(client, project_id, "Good")["id"]
    unpublished = _asset(client, project_id, "Unpublished")["id"]
    malformed = _asset(client, project_id, "Malformed")["id"]
    deleted = _asset(client, project_id, "Deleted")["id"]
    _publish(client, good, _receipt(size_bytes=42))
    _publish(client, malformed, _receipt(version=0))  # version < 1 is invalid
    _publish(client, deleted, _receipt(size_bytes=999))
    client.delete(f"{PREFIX}/assets/{deleted}")

    body = _overview(client, good).json()
    assert body["counts"] == {
        "project_published": 1,
        "project_bytes": 42,
        "total_published": 1,
    }
    assert [item["asset_id"] for item in body["recent_siblings"]] == [good]
    assert unpublished not in [item["asset_id"] for item in body["recent_siblings"]]


def test_overview_joins_project_name_with_orphan_fallback(client):
    _clear(client)
    project = _project(client, "Joined")
    asset_id = _asset(client, project["id"], "Orphan")["id"]
    _publish(client, asset_id)
    assert _overview(client, asset_id).json()["project_name"] == "Joined"

    # Remove the project so the joined name falls back while the asset stays.
    client.app.state.store.delete(Collections.PROJECTS, project["id"])
    body = _overview(client, asset_id).json()
    assert body["project_name"] == "Unknown project"
    assert body["recent_siblings"][0]["project_name"] == "Unknown project"


def test_overview_totals_agree_with_publish_stats(client):
    _clear(client)
    alpha = _project(client, "Alpha")["id"]
    beta = _project(client, "Beta")["id"]
    a1 = _asset(client, alpha, "A1")["id"]
    _asset(client, alpha, "A2")["id"]
    b1 = _asset(client, beta, "B1")["id"]
    _publish(client, a1, _receipt(size_bytes=11))
    _publish(client, b1, _receipt(size_bytes=22))

    body = _overview(client, a1).json()
    stats = client.get(f"{PREFIX}/publishes/stats").json()
    scoped = client.get(f"{PREFIX}/publishes/stats", params={"project_id": alpha}).json()
    assert body["counts"]["total_published"] == stats["total_published"] == 2
    assert body["counts"]["project_published"] == scoped["total_published"] == 1
    assert body["counts"]["project_bytes"] == scoped["total_bytes"] == 11


def test_unknown_asset_uses_shared_404_envelope(client):
    _clear(client)
    response = _overview(client, uuid4())
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "asset_not_found"
    assert error["request_id"]


def test_unpublished_asset_uses_shared_404_envelope(client):
    _clear(client)
    project_id = _project(client, "Unpublished")["id"]
    asset_id = _asset(client, project_id, "No receipt")["id"]
    response = _overview(client, asset_id)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "publish_not_found"


def test_malformed_receipt_uses_shared_404_envelope(client):
    _clear(client)
    project_id = _project(client, "Malformed")["id"]
    asset_id = _asset(client, project_id, "Bad receipt")["id"]
    _publish(client, asset_id, _receipt(size_bytes=-1))
    response = _overview(client, asset_id)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "publish_not_found"


def test_deleted_published_asset_uses_shared_404_envelope(client):
    _clear(client)
    project_id = _project(client, "Deleted")["id"]
    asset_id = _asset(client, project_id, "Gone")["id"]
    _publish(client, asset_id)
    client.delete(f"{PREFIX}/assets/{asset_id}")
    response = _overview(client, asset_id)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "publish_not_found"


def test_malformed_asset_id_uses_shared_422_envelope(client):
    _clear(client)
    response = _overview(client, "not-a-uuid")
    assert response.status_code == 422
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "validation_error"


def test_invalid_recent_limit_uses_shared_422_envelope(client):
    _clear(client)
    project_id = _project(client, "Limits")["id"]
    asset_id = _asset(client, project_id, "Limited")["id"]
    _publish(client, asset_id)
    for limit in (0, 51):
        response = _overview(client, asset_id, recent_limit=limit)
        assert response.status_code == 422
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"

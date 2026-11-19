"""Authoritative publish statistics endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {
    "total_published",
    "total_bytes",
    "by_version",
    "by_project",
    "newest_published_at",
    "generated_at",
}


def _stats(client, **params):
    return client.get(f"{PREFIX}/publishes/stats", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Publish Stats Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _storage(key="asset.png"):
    return {"key": key, "size_bytes": 16, "content_type": "image/png"}


def _asset(client, project_id, name="Asset"):
    response = client.post(
        f"{PREFIX}/assets/register",
        json={
            "project_id": project_id,
            "type": "image",
            "name": name,
            "storage": _storage(),
        },
    )
    assert response.status_code == 201
    return response.json()


def _receipt(*, version=1, size_bytes=100, published_at="2026-01-01T00:00:00"):
    return {
        "asset_id": str(uuid4()),
        "project_id": str(uuid4()),
        "version": version,
        "version_folder": f"Ver_{version:03d}",
        "comment": "release",
        "thumbnail": None,
        "published_by": str(uuid4()),
        "published_at": published_at,
        "source_key": "asset.png",
        "published_path": "Projects/Default/Assets/Char/asset/Ver_001/Dataset/Publish/asset_v001.png",
        "checksum_sha256": "deadbeef",
        "size_bytes": size_bytes,
    }


def _publish(client, asset_id, receipt=None):
    response = client.patch(
        f"{PREFIX}/assets/{asset_id}",
        json={"metadata": {"publish_receipt": receipt if receipt is not None else _receipt()}},
    )
    assert response.status_code == 200
    return response.json()


def test_publish_stats_empty_store_is_zero_filled(client):
    _clear(client)

    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total_published"] == 0
    assert body["total_bytes"] == 0
    assert body["by_version"] == []
    assert body["by_project"] == []
    assert body["newest_published_at"] is None
    assert body["generated_at"]


def test_publish_stats_derives_totals_breakdowns_and_recency(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]

    a = _asset(client, p1, "A")["id"]
    b = _asset(client, p1, "B")["id"]
    c = _asset(client, p2, "C")["id"]

    # P1: A published at v1 (100 bytes), B published at v2 (250 bytes).
    _publish(client, a, _receipt(version=1, size_bytes=100, published_at="2026-01-01T00:00:00"))
    _publish(client, b, _receipt(version=2, size_bytes=250, published_at="2026-03-01T00:00:00"))
    # P2: C published at v2 (50 bytes).
    _publish(client, c, _receipt(version=2, size_bytes=50, published_at="2026-02-01T00:00:00"))
    # A second asset in P1 is registered but never published.
    _asset(client, p1, "Unpublished")

    body = _stats(client).json()
    assert body["total_published"] == 3
    assert body["total_bytes"] == 400

    # by_version is ordered by ascending version number.
    assert body["by_version"] == [
        {"version": 1, "count": 1},
        {"version": 2, "count": 2},
    ]

    # by_project is ordered by descending published count then project id:
    # P1 has 2 publishes (350 bytes), P2 has 1 (50 bytes).
    assert [entry["project_id"] for entry in body["by_project"]] == [p1, p2]
    assert body["by_project"][0] == {"project_id": p1, "published": 2, "bytes": 350}
    assert body["by_project"][1] == {"project_id": p2, "published": 1, "bytes": 50}

    assert datetime.fromisoformat(body["newest_published_at"]) == datetime(2026, 3, 1)


def test_publish_stats_project_scope_counts_only_scoped_publishes(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]

    _publish(client, _asset(client, p1, "A")["id"], _receipt(version=1, size_bytes=10))
    _publish(client, _asset(client, p1, "B")["id"], _receipt(version=3, size_bytes=20))
    _publish(client, _asset(client, p2, "C")["id"], _receipt(version=1, size_bytes=30))

    scoped = _stats(client, project_id=p1).json()
    assert scoped["total_published"] == 2
    assert scoped["total_bytes"] == 30
    assert scoped["by_version"] == [
        {"version": 1, "count": 1},
        {"version": 3, "count": 1},
    ]
    assert [entry["project_id"] for entry in scoped["by_project"]] == [p1]

    global_body = _stats(client).json()
    assert global_body["total_published"] == 3
    assert global_body["total_bytes"] == 60


def test_publish_stats_unknown_and_malformed_project(client):
    _clear(client)

    missing = _stats(client, project_id=uuid4())
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "project_not_found"
    assert missing.headers["X-Request-ID"]

    malformed = _stats(client, project_id="not-a-uuid")
    assert malformed.status_code == 422
    error = malformed.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == malformed.headers["X-Request-ID"]


def test_publish_stats_is_derived_live_and_excludes_deleted_and_bad_receipts(client):
    _clear(client)
    p = _project(client)["id"]
    keep = _asset(client, p, "Keep")["id"]
    drop = _asset(client, p, "Drop")["id"]
    bad = _asset(client, p, "Bad")["id"]
    unpublished = _asset(client, p, "Never")["id"]

    _publish(client, keep, _receipt(version=1, size_bytes=100))
    _publish(client, drop, _receipt(version=2, size_bytes=200))
    _publish(client, bad, {"version": "oops", "size_bytes": 999, "published_at": "nope"})

    before = _stats(client).json()
    assert before["total_published"] == 2
    assert before["total_bytes"] == 300
    assert unpublished

    # Soft-deleting an asset removes its publish from the snapshot, keeping
    # totals consistent with by_project and by_version.
    deleted = client.delete(f"{PREFIX}/assets/{drop}")
    assert deleted.status_code == 204
    after_delete = _stats(client).json()
    assert after_delete["total_published"] == 1
    assert after_delete["total_bytes"] == 100
    assert after_delete["by_version"] == [{"version": 1, "count": 1}]
    assert sum(entry["published"] for entry in after_delete["by_project"]) == 1

    # Removing the last published asset empties every view.
    store = client.app.state.store
    store.delete(Collections.ASSETS, str(keep))
    after = _stats(client).json()
    assert after["total_published"] == 0
    assert after["total_bytes"] == 0
    assert after["by_version"] == []
    assert after["by_project"] == []
    assert after["newest_published_at"] is None


def test_publish_stats_tie_break_is_deterministic(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]

    # Equal publish counts: the project-id tie-break decides the order.
    _publish(client, _asset(client, p2, "C")["id"], _receipt(version=1, size_bytes=5))
    _publish(client, _asset(client, p1, "A")["id"], _receipt(version=2, size_bytes=7))

    body = _stats(client).json()
    assert [entry["project_id"] for entry in body["by_project"]] == sorted(
        [p1, p2], key=str
    )

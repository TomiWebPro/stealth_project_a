"""Authoritative downstream asset impact endpoint tests (success + failure)."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX


def _project(client, name="Impact Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _asset(client, project_id, name, parent_ids=None):
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
        "parent_asset_ids": parent_ids or [],
    }
    response = client.post(f"{PREFIX}/assets/register", json=payload)
    assert response.status_code == 201
    return response.json()


def _impact(client, asset_id, **params):
    return client.get(f"{PREFIX}/assets/{asset_id}/impact", params=params)


def _by_depth(body):
    groups: dict[int, set[str]] = {}
    for node in body["descendants"]:
        groups.setdefault(node["depth"], set()).add(node["asset_id"])
    return groups


def test_impact_is_authoritative_transitive_and_depth_labeled(client):
    project = _project(client)
    root = _asset(client, project["id"], "root")
    child = _asset(client, project["id"], "child", [root["id"]])
    grandchild = _asset(client, project["id"], "grandchild", [child["id"]])
    other_child = _asset(client, project["id"], "other-child", [root["id"]])

    response = _impact(client, root["id"])
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    assert set(response.json()) == {"root_asset_id", "descendants", "total"}

    body = response.json()
    assert body["root_asset_id"] == root["id"]
    assert body["total"] == 3
    assert len(body["descendants"]) == 3
    assert root["id"] not in {node["asset_id"] for node in body["descendants"]}
    assert _by_depth(body) == {
        1: {child["id"], other_child["id"]},
        2: {grandchild["id"]},
    }
    assert all(node["relationship"] == "derived_from" for node in body["descendants"])

    # A leaf has a well-formed, empty impact (never an error).
    leaf = _impact(client, grandchild["id"])
    assert leaf.status_code == 200
    assert leaf.json() == {
        "root_asset_id": grandchild["id"],
        "descendants": [],
        "total": 0,
    }


def test_impact_excludes_deleted_assets_and_their_subtree(client):
    project = _project(client)
    root = _asset(client, project["id"], "root")
    child = _asset(client, project["id"], "child", [root["id"]])
    grandchild = _asset(client, project["id"], "grandchild", [child["id"]])
    kept = _asset(client, project["id"], "kept", [root["id"]])

    deleted = client.delete(f"{PREFIX}/assets/{child['id']}")
    assert deleted.status_code == 204

    body = _impact(client, root["id"]).json()
    ids = {node["asset_id"] for node in body["descendants"]}
    assert ids == {kept["id"]}
    assert child["id"] not in ids
    assert grandchild["id"] not in ids  # subtree beyond a deleted node is skipped
    assert body["total"] == 1


def test_impact_max_depth_bounds_traversal(client):
    project = _project(client)
    root = _asset(client, project["id"], "root")
    child = _asset(client, project["id"], "child", [root["id"]])
    grandchild = _asset(client, project["id"], "grandchild", [child["id"]])

    shallow = _impact(client, root["id"], max_depth=1).json()
    assert {node["asset_id"] for node in shallow["descendants"]} == {child["id"]}
    assert shallow["total"] == 1

    deep = _impact(client, root["id"], max_depth=5).json()
    assert {node["asset_id"] for node in deep["descendants"]} == {
        child["id"],
        grandchild["id"],
    }
    assert deep["total"] == 2


def test_impact_is_cycle_safe(client):
    """A cyclic relationship graph terminates and never duplicates a node."""
    from uuid import uuid4

    from app.schemas.asset import AssetRelationship
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    project = _project(client)
    a = _asset(client, project["id"], "a")
    b = _asset(client, project["id"], "b", [a["id"]])  # b derived_from a

    # Add the back-edge a derived_from b so the graph has a cycle. The walk must
    # not loop forever or list the root twice.
    client.app.state.store.put(
        Collections.ASSET_RELATIONSHIPS,
        str(uuid4()),
        AssetRelationship(
            id=uuid4(),
            from_asset_id=a["id"],
            to_asset_id=b["id"],
            type="derived_from",
            created_at=utcnow(),
        ).model_dump(mode="json"),
    )

    body = _impact(client, a["id"]).json()
    assert body["total"] == 1
    assert {node["asset_id"] for node in body["descendants"]} == {b["id"]}
    assert len(body["descendants"]) == len({n["asset_id"] for n in body["descendants"]})


def test_impact_unknown_asset_uses_error_envelope(client):
    response = _impact(client, uuid4())
    assert response.status_code == 404
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == "asset_not_found"
    assert body["error"]["message"]
    assert body["error"]["request_id"] == response.headers["X-Request-ID"]


def test_impact_rejects_invalid_max_depth(client):
    project = _project(client)
    root = _asset(client, project["id"], "root")
    for value in (0, 21):  # outside ge=1, le=20
        response = _impact(client, root["id"], max_depth=value)
        assert response.status_code == 422, value
        assert response.json()["error"]["code"] == "validation_error"

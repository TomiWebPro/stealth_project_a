"""Authoritative single lineage-relationship overview tests (success + failure)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from app.schemas.asset import AssetRelationship
from app.schemas.common import utcnow
from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {
    "id",
    "from_asset_id",
    "to_asset_id",
    "from_asset_name",
    "to_asset_name",
    "from_asset_type",
    "to_asset_type",
    "project_id",
    "project_name",
    "type",
    "created_at",
    "counts",
    "recent_relationships",
    "generated_at",
}
_COUNT_KEYS = {
    "source_upstream",
    "source_downstream",
    "source_types",
    "project_relationships",
}
_ITEM_KEYS = {
    "id",
    "from_asset_id",
    "to_asset_id",
    "from_asset_name",
    "to_asset_name",
    "project_id",
    "project_name",
    "type",
    "created_at",
}


def _overview(client, relationship_id, **params):
    return client.get(f"{PREFIX}/lineage/{relationship_id}/overview", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Lineage Overview Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _asset(client, project_id, name, *, asset_type="image"):
    response = client.post(
        f"{PREFIX}/assets/register",
        json={
            "project_id": project_id,
            "type": asset_type,
            "name": name,
            "storage": {
                "backend": "local",
                "key": f"Output/{name}.png",
                "size_bytes": 16,
                "content_type": "image/png",
            },
        },
    )
    assert response.status_code == 201
    return response.json()


def _link(client, from_id, to_id, rel_type="derived_from", *, age_seconds=0):
    """Put a typed relationship directly in the authoritative store."""
    rel = AssetRelationship(
        id=uuid4(),
        from_asset_id=from_id,
        to_asset_id=to_id,
        type=rel_type,
        created_at=utcnow() - timedelta(seconds=age_seconds),
    )
    client.app.state.store.put(
        Collections.ASSET_RELATIONSHIPS,
        str(rel.id),
        rel.model_dump(mode="json"),
    )
    return rel


def test_overview_of_simple_relationship(client):
    _clear(client)
    project = _project(client, "Simple")
    source = _asset(client, project["id"], "child")
    parent = _asset(client, project["id"], "parent")
    link = _link(client, source["id"], parent["id"], "derived_from")

    response = _overview(client, link.id)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["id"] == str(link.id)
    assert body["from_asset_id"] == source["id"]
    assert body["to_asset_id"] == parent["id"]
    assert body["from_asset_name"] == "child"
    assert body["to_asset_name"] == "parent"
    assert body["from_asset_type"] == "image"
    assert body["to_asset_type"] == "image"
    assert body["project_id"] == project["id"]
    assert body["project_name"] == "Simple"
    assert body["type"] == "derived_from"
    assert body["created_at"]
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"] == {
        "source_upstream": 0,
        "source_downstream": 1,
        "source_types": 1,
        "project_relationships": 1,
    }
    assert len(body["recent_relationships"]) == 1
    assert set(body["recent_relationships"][0]) == _ITEM_KEYS
    assert body["recent_relationships"][0]["id"] == str(link.id)
    assert body["generated_at"]


def test_counts_reuse_canonical_relationship_set(client):
    _clear(client)
    project_a = _project(client, "Project A")["id"]
    project_b = _project(client, "Project B")["id"]
    source = _asset(client, project_a, "source")
    p1 = _asset(client, project_a, "parent-1")
    p2 = _asset(client, project_a, "parent-2")
    child_1 = _asset(client, project_a, "child-1")
    child_2 = _asset(client, project_a, "child-2")
    other_source = _asset(client, project_b, "other-source")
    other_target = _asset(client, project_b, "other-target")

    # Two upstream links into the source (with two different types).
    _link(client, p1["id"], source["id"], "derived_from", age_seconds=100)
    _link(client, p2["id"], source["id"], "variant_of", age_seconds=90)
    # Two downstream links out of the source; the target is one of them.
    target = _link(client, source["id"], child_1["id"], "derived_from", age_seconds=10)
    sibling = _link(client, source["id"], child_2["id"], "related_to", age_seconds=5)
    # A link in another project must not leak into project_relationships.
    _link(client, other_source["id"], other_target["id"], "derived_from")

    body = _overview(client, target.id).json()
    assert body["counts"] == {
        "source_upstream": 2,
        "source_downstream": 2,
        "source_types": 3,  # derived_from, variant_of, related_to
        "project_relationships": 4,
    }
    # Siblings are only the source's downstream links, newest-first (sibling is
    # newer than target). The other project's link and the upstream links are excluded.
    assert [item["id"] for item in body["recent_relationships"]] == [
        str(sibling.id),
        str(target.id),
    ]


def test_counts_never_bounded_by_recent_limit_and_newest_first(client):
    _clear(client)
    from app.schemas.common import utcnow
    from datetime import timedelta as _td

    now = utcnow()
    project = _project(client, "Paged")["id"]
    source = _asset(client, project, "source")
    links = []
    for i in range(4):
        target = _asset(client, project, f"child-{i}")
        rel = AssetRelationship(
            id=uuid4(),
            from_asset_id=source["id"],
            to_asset_id=target["id"],
            type="derived_from",
            created_at=now + _td(seconds=i),
        )
        client.app.state.store.put(
            Collections.ASSET_RELATIONSHIPS,
            str(rel.id),
            rel.model_dump(mode="json"),
        )
        links.append(rel)

    full = _overview(client, links[0].id).json()
    assert full["counts"]["source_downstream"] == 4
    assert [item["id"] for item in full["recent_relationships"]] == [
        str(rel.id) for rel in reversed(links)
    ]

    bounded = _overview(client, links[0].id, recent_limit=2).json()
    assert bounded["counts"] == full["counts"]
    assert [item["id"] for item in bounded["recent_relationships"]] == [
        str(rel.id) for rel in list(reversed(links))[:2]
    ]


def test_unknown_target_asset_uses_unknown_fallback(client):
    _clear(client)
    project = _project(client, "Ghost Target")["id"]
    source = _asset(client, project, "source")
    link = _link(client, source["id"], uuid4(), "derived_from")

    body = _overview(client, link.id).json()
    assert body["to_asset_name"] == "Unknown asset"
    assert body["to_asset_type"] is None
    assert body["recent_relationships"][0]["to_asset_name"] == "Unknown asset"


def test_orphan_project_uses_unknown_fallback(client):
    _clear(client)
    from app.schemas.asset import Asset

    source_id = uuid4()
    source = Asset(
        id=source_id,
        project_id=uuid4(),
        type="image",
        name="Orphan source",
        creator_id=uuid4(),
        storage={
            "backend": "local",
            "key": "Output/orphan.png",
            "size_bytes": 16,
            "content_type": "image/png",
        },
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    client.app.state.store.put(
        Collections.ASSETS, str(source.id), source.model_dump(mode="json")
    )
    link = _link(client, source.id, uuid4(), "derived_from")

    body = _overview(client, link.id).json()
    assert body["project_name"] == "Unknown project"
    assert body["recent_relationships"][0]["project_name"] == "Unknown project"


def test_soft_deleted_source_is_not_found(client):
    _clear(client)
    project = _project(client, "Deleted")["id"]
    source = _asset(client, project, "source")
    target = _asset(client, project, "target")
    link = _link(client, source["id"], target["id"], "derived_from")

    # Mark the source as deleted in the authoritative store.
    stored = client.app.state.store.get(Collections.ASSETS, source["id"])
    stored["status"] = "deleted"
    client.app.state.store.put(Collections.ASSETS, source["id"], stored)

    response = _overview(client, link.id)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "relationship_not_found"


def test_unknown_relationship_uses_shared_404_envelope(client):
    _clear(client)
    response = _overview(client, uuid4())
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "relationship_not_found"
    assert error["request_id"]


def test_malformed_relationship_id_uses_shared_422_envelope(client):
    response = client.get(f"{PREFIX}/lineage/not-a-uuid/overview")
    assert response.status_code == 422
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "validation_error"


def test_invalid_recent_limit_uses_shared_422_envelope(client):
    _clear(client)
    project = _project(client, "Limits")["id"]
    source = _asset(client, project, "source")
    target = _asset(client, project, "target")
    link = _link(client, source["id"], target["id"], "derived_from")
    for limit in (0, 51):
        response = _overview(client, link.id, recent_limit=limit)
        assert response.status_code == 422
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"

"""Authoritative pipeline-feed endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_KEYS = {"items", "total", "generated_at"}
_ITEM_KEYS = {
    "chain_id",
    "project_id",
    "project_name",
    "kind",
    "job_count",
    "asset_count",
    "created_by",
    "created_at",
}


def _feed(client, **params):
    return client.get(f"{PREFIX}/pipelines/feed", params=params)


def _clear(client):
    client.app.state.store.clear()


def _seed_project(client, name="P", project_id=None):
    from app.schemas.auth import Project
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    now = utcnow()
    project = Project(
        id=project_id or uuid4(),
        org_id=uuid4(),
        name=name,
        created_by=uuid4(),
        created_at=now,
        updated_at=now,
    )
    client.app.state.store.put(
        Collections.PROJECTS, str(project.id), project.model_dump(mode="json")
    )
    return project


def _seed_training(client, project_id, *, created_at=None, created_by=None):
    from app.schemas.common import utcnow
    from app.storage.base import Collections
    from app.training import LoraChain

    chain = LoraChain(
        id=uuid4(),
        project_id=project_id,
        dataset_asset_id=uuid4(),
        config_asset_id=uuid4(),
        lora_asset_id=uuid4(),
        job_ids=[uuid4(), uuid4()],
        yaml="job: x",
        config_hash="abc",
        created_at=created_at or utcnow(),
        created_by=created_by or uuid4(),
    )
    client.app.state.store.put(
        Collections.TRAINING_CHAINS, str(chain.id), chain.model_dump(mode="json")
    )
    return chain


def _seed_shot(client, project_id, *, created_at=None, created_by=None):
    from app.schemas.common import utcnow
    from app.shots import ShotChain
    from app.storage.base import Collections

    chain = ShotChain(
        id=uuid4(),
        project_id=project_id,
        shot_token="s01_c01",
        job_id=uuid4(),
        video_asset_id=uuid4(),
        mounted_loras=[],
        operation_id="flf2v",
        created_at=created_at or utcnow(),
        created_by=created_by or uuid4(),
    )
    client.app.state.store.put(
        Collections.SHOT_CHAINS, str(chain.id), chain.model_dump(mode="json")
    )
    return chain


def _seed_splat(client, project_id, *, created_at=None, created_by=None):
    from app.schemas.common import utcnow
    from app.splat import SplatChain
    from app.storage.base import Collections

    chain = SplatChain(
        id=uuid4(),
        project_id=project_id,
        scene_asset_id=uuid4(),
        model_asset_id=uuid4(),
        splat_asset_id=uuid4(),
        job_ids=[uuid4(), uuid4()],
        camera_path=[],
        smoke=True,
        created_at=created_at or utcnow(),
        created_by=created_by or uuid4(),
    )
    client.app.state.store.put(
        Collections.SPLAT_CHAINS, str(chain.id), chain.model_dump(mode="json")
    )
    return chain


def _sorted_desc(items):
    return items == sorted(
        items,
        key=lambda item: (item["created_at"], item["chain_id"]),
        reverse=True,
    )


def test_pipeline_feed_empty_store_is_zero_filled(client):
    _clear(client)

    response = _feed(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["items"] == []
    assert body["generated_at"]


def test_pipeline_feed_is_newest_first_with_projected_chain_fields(client):
    from app.schemas.common import utcnow

    _clear(client)
    now = utcnow()
    alpha = _seed_project(client, "Alpha")
    beta = _seed_project(client, "Beta")

    old = _seed_training(client, alpha.id, created_at=now - timedelta(hours=3))
    mid = _seed_shot(client, alpha.id, created_at=now - timedelta(hours=1))
    newest = _seed_splat(client, beta.id, created_at=now)

    body = _feed(client).json()
    assert set(body) == _KEYS
    assert body["total"] == 3
    items = body["items"]
    assert len(items) == 3
    assert _sorted_desc(items)
    assert [item["chain_id"] for item in items] == [
        str(newest.id),
        str(mid.id),
        str(old.id),
    ]

    by_id = {item["chain_id"]: item for item in items}
    assert set(by_id) == {str(old.id), str(mid.id), str(newest.id)}
    assert set(by_id[str(old.id)]) == _ITEM_KEYS
    # training: 2 jobs (job_ids) + 3 assets (dataset/config/lora)
    assert by_id[str(old.id)]["kind"] == "training"
    assert by_id[str(old.id)]["job_count"] == 2
    assert by_id[str(old.id)]["asset_count"] == 3
    assert by_id[str(old.id)]["project_name"] == "Alpha"
    assert by_id[str(old.id)]["created_by"] == str(old.created_by)
    # shot: 1 job (job_id) + 1 asset (video_asset_id)
    assert by_id[str(mid.id)]["kind"] == "shot"
    assert by_id[str(mid.id)]["job_count"] == 1
    assert by_id[str(mid.id)]["asset_count"] == 1
    assert by_id[str(mid.id)]["project_name"] == "Alpha"
    # splat: 2 jobs (job_ids) + 3 assets (scene/model/splat)
    assert by_id[str(newest.id)]["kind"] == "splat"
    assert by_id[str(newest.id)]["job_count"] == 2
    assert by_id[str(newest.id)]["asset_count"] == 3
    assert by_id[str(newest.id)]["project_name"] == "Beta"


def test_pipeline_feed_tie_break_is_deterministic(client):
    from app.schemas.common import utcnow

    _clear(client)
    same_time = utcnow()
    a = _seed_shot(client, uuid4(), created_at=same_time)
    b = _seed_shot(client, uuid4(), created_at=same_time)

    body = _feed(client).json()
    expected = sorted([str(a.id), str(b.id)], reverse=True)
    assert [item["chain_id"] for item in body["items"]] == expected
    assert _sorted_desc(body["items"])


def test_pipeline_feed_keeps_orphan_chain_with_fallback_project_name(client):
    _clear(client)
    chain = _seed_shot(client, uuid4())  # no project document written

    body = _feed(client).json()
    assert body["total"] == 1
    assert body["items"][0]["project_name"] == "Unknown project"
    assert body["items"][0]["chain_id"] == str(chain.id)


def test_pipeline_feed_project_scope_filters_and_errors(client):
    from app.schemas.common import utcnow

    _clear(client)
    now = utcnow()
    p1 = _seed_project(client, "P1")
    p2 = _seed_project(client, "P2")
    _seed_training(client, p1.id, created_at=now - timedelta(hours=1))
    _seed_shot(client, p1.id, created_at=now - timedelta(hours=2))
    _seed_splat(client, p2.id, created_at=now)

    scoped = _feed(client, project_id=p1.id)
    assert scoped.status_code == 200
    body = scoped.json()
    assert body["total"] == 2
    assert {item["project_id"] for item in body["items"]} == {str(p1.id)}
    assert {item["kind"] for item in body["items"]} == {"training", "shot"}

    missing = _feed(client, project_id=uuid4())
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "project_not_found"
    assert missing.headers["X-Request-ID"]

    malformed = _feed(client, project_id="not-a-uuid")
    assert malformed.status_code == 422
    error = malformed.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == malformed.headers["X-Request-ID"]


def test_pipeline_feed_kind_filter_and_invalid_kind(client):
    _clear(client)
    project = _seed_project(client)
    _seed_training(client, project.id)
    _seed_shot(client, project.id)
    _seed_splat(client, project.id)

    for kind in ("training", "shot", "splat"):
        response = _feed(client, kind=kind)
        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 1
        assert {item["kind"] for item in body["items"]} == {kind}

    invalid = _feed(client, kind="render")
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "validation_error"


def test_pipeline_feed_limit_page_total_unchanged_and_bounds(client):
    from app.schemas.common import utcnow

    _clear(client)
    project = _seed_project(client)
    for offset in range(4):
        _seed_shot(client, project.id, created_at=utcnow() - timedelta(hours=offset))

    full = _feed(client).json()
    assert full["total"] == 4
    assert len(full["items"]) == 4

    paged = _feed(client, limit=2).json()
    assert paged["total"] == 4  # counted before the page
    assert len(paged["items"]) == 2
    assert paged["items"] == full["items"][:2]

    for bad_limit in (0, 201):
        response = _feed(client, limit=bad_limit)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"


def test_pipeline_feed_is_derived_live_from_the_store(client):
    _clear(client)
    assert _feed(client).json()["total"] == 0

    project = _seed_project(client, "Live")
    chain = _seed_splat(client, project.id)
    body = _feed(client).json()
    assert body["total"] == 1
    assert body["items"][0]["chain_id"] == str(chain.id)
    assert body["items"][0]["project_name"] == "Live"

"""Authoritative production-pipeline statistics endpoint tests (success + failure)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_KEYS = {
    "total_chains",
    "total_jobs",
    "total_assets",
    "by_kind",
    "by_project",
    "newest_chain_at",
    "generated_at",
}
_KINDS = [
    {"kind": "training", "chains": 0, "jobs": 0, "assets": 0},
    {"kind": "shot", "chains": 0, "jobs": 0, "assets": 0},
    {"kind": "splat", "chains": 0, "jobs": 0, "assets": 0},
]


def _stats(client, **params):
    return client.get(f"{PREFIX}/pipelines/stats", params=params)


def _clear(client):
    client.app.state.store.clear()


def _seed_project(client, project_id=None):
    from app.schemas.auth import Project
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    now = utcnow()
    project = Project(
        id=project_id or uuid4(),
        org_id=uuid4(),
        name="P",
        created_by=uuid4(),
        created_at=now,
        updated_at=now,
    )
    client.app.state.store.put(
        Collections.PROJECTS, str(project.id), project.model_dump(mode="json")
    )
    return project


def _seed_training(client, project_id, *, created_at=None):
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
        created_by=uuid4(),
    )
    client.app.state.store.put(
        Collections.TRAINING_CHAINS, str(chain.id), chain.model_dump(mode="json")
    )
    return chain


def _seed_shot(client, project_id, *, created_at=None):
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
        created_by=uuid4(),
    )
    client.app.state.store.put(
        Collections.SHOT_CHAINS, str(chain.id), chain.model_dump(mode="json")
    )
    return chain


def _seed_splat(client, project_id, *, created_at=None):
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
        created_by=uuid4(),
    )
    client.app.state.store.put(
        Collections.SPLAT_CHAINS, str(chain.id), chain.model_dump(mode="json")
    )
    return chain


def test_pipeline_stats_empty_store_is_zero_filled(client):
    _clear(client)

    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total_chains"] == 0
    assert body["total_jobs"] == 0
    assert body["total_assets"] == 0
    assert body["by_kind"] == _KINDS
    assert body["by_project"] == []
    assert body["newest_chain_at"] is None
    assert body["generated_at"]


def test_pipeline_stats_derives_totals_breakdowns_and_recency(client):
    from app.schemas.common import utcnow

    _clear(client)
    now = utcnow()
    p1, p2 = uuid4(), uuid4()

    old = _seed_training(client, p1, created_at=now - timedelta(hours=3))
    _seed_shot(client, p1, created_at=now - timedelta(hours=2))
    newest = _seed_splat(client, p2, created_at=now)

    body = _stats(client).json()
    # training (3 assets/2 jobs), shot (1/1), splat (3/2)
    assert body["total_chains"] == 3
    assert body["total_jobs"] == 5
    assert body["total_assets"] == 7
    assert body["by_kind"] == [
        {"kind": "training", "chains": 1, "jobs": 2, "assets": 3},
        {"kind": "shot", "chains": 1, "jobs": 1, "assets": 1},
        {"kind": "splat", "chains": 1, "jobs": 2, "assets": 3},
    ]
    # p1 (2 chains) before p2 (1 chain).
    assert body["by_project"] == [
        {"project_id": str(p1), "chains": 2},
        {"project_id": str(p2), "chains": 1},
    ]
    assert body["newest_chain_at"] == newest.created_at.isoformat().replace("+00:00", "Z")
    assert old.created_at < newest.created_at


def test_pipeline_stats_project_scope_unknown_and_malformed(client):
    _clear(client)
    p1 = _seed_project(client).id
    p2 = _seed_project(client).id
    _seed_training(client, p1)
    _seed_shot(client, p1)
    _seed_splat(client, p2)

    scoped = _stats(client, project_id=p1)
    assert scoped.status_code == 200
    body = scoped.json()
    assert body["total_chains"] == 2
    assert body["by_kind"] == [
        {"kind": "training", "chains": 1, "jobs": 2, "assets": 3},
        {"kind": "shot", "chains": 1, "jobs": 1, "assets": 1},
        {"kind": "splat", "chains": 0, "jobs": 0, "assets": 0},
    ]
    assert body["by_project"] == [{"project_id": str(p1), "chains": 2}]

    # Unknown-but-well-formed project uses the shared 404 envelope (the project
    # does not exist), matching the other project-scoped routers.
    missing = _stats(client, project_id=uuid4())
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "project_not_found"
    assert missing.headers["X-Request-ID"]

    malformed = _stats(client, project_id="not-a-uuid")
    assert malformed.status_code == 422
    error = malformed.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == malformed.headers["X-Request-ID"]


def test_pipeline_stats_by_project_tie_break_is_deterministic(client):
    _clear(client)
    # Two projects with the same chain count must be ordered by project id.
    low, high = uuid4(), uuid4()
    if low > high:
        low, high = high, low
    _seed_shot(client, high)
    _seed_shot(client, low)

    body = _stats(client).json()
    assert body["by_project"] == [
        {"project_id": str(low), "chains": 1},
        {"project_id": str(high), "chains": 1},
    ]


def test_pipeline_stats_is_derived_live_from_the_store(client):
    from app.storage.base import Collections

    _clear(client)
    assert _stats(client).json()["total_chains"] == 0

    chain = _seed_shot(client, uuid4())
    first = _stats(client).json()
    assert first["total_chains"] == 1
    assert first["by_kind"][1] == {"kind": "shot", "chains": 1, "jobs": 1, "assets": 1}

    client.app.state.store.delete(Collections.SHOT_CHAINS, str(chain.id))
    second = _stats(client).json()
    assert second["total_chains"] == 0
    assert second["by_kind"] == _KINDS
    assert second["newest_chain_at"] is None

"""Authoritative single-pipeline-chain overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_KEYS = {
    "chain_id",
    "project_id",
    "project_name",
    "kind",
    "created_by",
    "created_at",
    "counts",
    "recent_jobs",
    "recent_assets",
    "generated_at",
}
_COUNT_KEYS = {"jobs", "assets"}
_JOB_KEYS = {"job_id", "operation_id", "status", "created_at"}
_ASSET_KEYS = {"asset_id", "name", "asset_type", "created_at"}


def _overview(client, chain_id, **params):
    return client.get(f"{PREFIX}/pipelines/{chain_id}/overview", params=params)


def _store(client):
    return client.app.state.store


def _seed_project(client, name="Overview Pipeline"):
    from app.schemas.auth import Project
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    now = utcnow()
    project = Project(
        id=uuid4(),
        org_id=uuid4(),
        name=name,
        created_by=uuid4(),
        created_at=now,
        updated_at=now,
    )
    _store(client).put(
        Collections.PROJECTS, str(project.id), project.model_dump(mode="json")
    )
    return project


def _seed_job(client, project_id, *, created_at=None, operation_id="dataset-prep", status="queued"):
    from app.schemas.common import utcnow
    from app.schemas.operation import Job
    from app.storage.base import Collections

    job = Job(
        id=uuid4(),
        project_id=project_id,
        operation_id=operation_id,
        schema_version="1.0.0",
        status=status,
        created_by=uuid4(),
        created_at=created_at or utcnow(),
    )
    _store(client).put(Collections.JOBS, str(job.id), job.model_dump(mode="json"))
    return job


def _seed_asset(client, project_id, *, created_at=None, name="asset", asset_type="image", status="ready"):
    from app.schemas.asset import Asset, StorageRef
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    now = created_at or utcnow()
    asset = Asset(
        id=uuid4(),
        project_id=project_id,
        type=asset_type,
        name=name,
        status=status,
        creator_id=uuid4(),
        storage=StorageRef(backend="local", key=f"seed/{uuid4()}", size_bytes=0, content_type="application/octet-stream"),
        created_at=now,
        updated_at=now,
    )
    _store(client).put(Collections.ASSETS, str(asset.id), asset.model_dump(mode="json"))
    return asset


def _seed_training(client, project_id, *, job_ids=None, asset_ids=None, created_at=None, created_by=None):
    from app.schemas.common import utcnow
    from app.storage.base import Collections
    from app.training import LoraChain

    ids = list(asset_ids or [])
    while len(ids) < 3:
        ids.append(uuid4())
    chain = LoraChain(
        id=uuid4(),
        project_id=project_id,
        dataset_asset_id=ids[0],
        config_asset_id=ids[1],
        lora_asset_id=ids[2],
        job_ids=job_ids if job_ids is not None else [uuid4(), uuid4()],
        yaml="job: x",
        config_hash="abc",
        created_at=created_at or utcnow(),
        created_by=created_by or uuid4(),
    )
    _store(client).put(
        Collections.TRAINING_CHAINS, str(chain.id), chain.model_dump(mode="json")
    )
    return chain


def _seed_shot(client, project_id, *, job_id=None, asset_id=None, created_at=None):
    from app.schemas.common import utcnow
    from app.shots import ShotChain
    from app.storage.base import Collections

    chain = ShotChain(
        id=uuid4(),
        project_id=project_id,
        shot_token="s01_c01",
        job_id=job_id or uuid4(),
        video_asset_id=asset_id or uuid4(),
        mounted_loras=[],
        operation_id="flf2v",
        created_at=created_at or utcnow(),
        created_by=uuid4(),
    )
    _store(client).put(
        Collections.SHOT_CHAINS, str(chain.id), chain.model_dump(mode="json")
    )
    return chain


def _seed_splat(client, project_id, *, job_ids=None, asset_ids=None):
    from app.schemas.common import utcnow
    from app.splat import SplatChain
    from app.storage.base import Collections

    ids = asset_ids or [uuid4(), uuid4(), uuid4()]
    chain = SplatChain(
        id=uuid4(),
        project_id=project_id,
        scene_asset_id=ids[0],
        model_asset_id=ids[1],
        splat_asset_id=ids[2],
        job_ids=job_ids if job_ids is not None else [uuid4(), uuid4()],
        camera_path=[],
        smoke=True,
        created_at=utcnow(),
        created_by=uuid4(),
    )
    _store(client).put(
        Collections.SPLAT_CHAINS, str(chain.id), chain.model_dump(mode="json")
    )
    return chain


def test_unknown_chain_uses_shared_404_envelope(client):
    response = _overview(client, uuid4())
    assert response.status_code == 404
    assert set(response.json()) == {"error"}
    error = response.json()["error"]
    assert error["code"] == "chain_not_found"
    assert error["message"] and error["request_id"]
    assert response.headers.get("X-Request-ID")


def test_malformed_id_and_invalid_limit_use_shared_422_envelope(client):
    for params in (None, {"recent_limit": 0}, {"recent_limit": 51}):
        path = f"{PREFIX}/pipelines/not-a-uuid/overview"
        response = client.get(path, params=params or {})
        assert response.status_code == 422
        assert set(response.json()) == {"error"}
        assert response.json()["error"]["code"] == "validation_error"
        assert response.headers.get("X-Request-ID")

    chain = _seed_training(client, _seed_project(client).id)
    for bad_limit in (0, 51):
        response = _overview(client, chain.id, recent_limit=bad_limit)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"


def test_training_chain_overview_shape_and_counts(client):
    project = _seed_project(client, "Training Project")
    job_ids = [uuid4(), uuid4()]
    asset_ids = [uuid4(), uuid4(), uuid4()]
    chain = _seed_training(client, project.id, job_ids=job_ids, asset_ids=asset_ids)

    response = _overview(client, chain.id)
    assert response.status_code == 200
    body = response.json()
    assert set(body) == _KEYS
    assert body["chain_id"] == str(chain.id)
    assert body["project_id"] == str(project.id)
    assert body["project_name"] == project.name
    assert body["kind"] == "training"
    assert body["created_by"] == str(chain.created_by)
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"] == {"jobs": 2, "assets": 3}
    assert response.headers.get("X-Request-ID")


def test_shot_and_splat_chain_kinds_and_single_job_counts(client):
    project = _seed_project(client)
    shot = _seed_shot(client, project.id)
    shot_body = _overview(client, shot.id).json()
    assert shot_body["kind"] == "shot"
    assert shot_body["counts"] == {"jobs": 1, "assets": 1}

    splat = _seed_splat(client, project.id)
    splat_body = _overview(client, splat.id).json()
    assert splat_body["kind"] == "splat"
    assert splat_body["counts"] == {"jobs": 2, "assets": 3}


def test_recent_jobs_and_assets_are_newest_first_and_bounded(client):
    from app.schemas.common import utcnow

    project = _seed_project(client)
    base = utcnow()
    jobs = [
        _seed_job(client, project.id, created_at=base + timedelta(seconds=i), operation_id=f"op-{i}")
        for i in range(3)
    ]
    assets = [
        _seed_asset(client, project.id, created_at=base + timedelta(seconds=i), name=f"asset-{i}")
        for i in range(3)
    ]
    chain = _seed_training(
        client,
        project.id,
        job_ids=[job.id for job in jobs],
        asset_ids=[asset.id for asset in assets],
    )

    response = _overview(client, chain.id, recent_limit=2)
    assert response.status_code == 200
    body = response.json()
    assert len(body["recent_jobs"]) == 2
    assert len(body["recent_assets"]) == 2
    # counts describe the whole chain, never the bounded page
    assert body["counts"] == {"jobs": 3, "assets": 3}
    assert set(body["recent_jobs"][0]) == _JOB_KEYS
    assert set(body["recent_assets"][0]) == _ASSET_KEYS
    assert [entry["operation_id"] for entry in body["recent_jobs"]] == ["op-2", "op-1"]
    assert [entry["name"] for entry in body["recent_assets"]] == ["asset-2", "asset-1"]


def test_orphan_and_deleted_links_are_skipped_but_counts_kept(client):
    from app.schemas.common import utcnow

    project = _seed_project(client)
    live_job = _seed_job(client, project.id, created_at=utcnow() + timedelta(seconds=1))
    live_asset = _seed_asset(client, project.id, created_at=utcnow() + timedelta(seconds=1))
    deleted_asset = _seed_asset(
        client, project.id, created_at=utcnow() + timedelta(seconds=2), status="deleted"
    )
    chain = _seed_training(
        client,
        project.id,
        job_ids=[uuid4(), live_job.id],  # one orphan job id
        asset_ids=[uuid4(), live_asset.id, deleted_asset.id],  # orphan + deleted
    )

    body = _overview(client, chain.id).json()
    assert body["counts"] == {"jobs": 2, "assets": 3}
    assert [entry["job_id"] for entry in body["recent_jobs"]] == [str(live_job.id)]
    assert [entry["asset_id"] for entry in body["recent_assets"]] == [str(live_asset.id)]


def test_missing_project_falls_back_to_stable_name(client):
    chain = _seed_training(client, uuid4())  # no project written to the store
    body = _overview(client, chain.id).json()
    assert body["project_name"] == "Unknown project"


def test_recent_limit_boundaries(client):
    from app.schemas.common import utcnow

    project = _seed_project(client)
    base = utcnow()
    jobs = [_seed_job(client, project.id, created_at=base + timedelta(seconds=i)) for i in range(2)]
    assets = [_seed_asset(client, project.id, created_at=base + timedelta(seconds=i)) for i in range(2)]
    chain = _seed_training(
        client,
        project.id,
        job_ids=[job.id for job in jobs],
        asset_ids=[asset.id for asset in assets],
    )
    tight = _overview(client, chain.id, recent_limit=1)
    assert tight.status_code == 200
    assert len(tight.json()["recent_jobs"]) == 1
    assert len(tight.json()["recent_assets"]) == 1

    wide = _overview(client, chain.id, recent_limit=50)
    assert wide.status_code == 200
    assert len(wide.json()["recent_jobs"]) == 2
    assert len(wide.json()["recent_assets"]) == 2
    # counts are never bounded by the page (the third chain asset id is an orphan)
    assert wide.json()["counts"] == {"jobs": 2, "assets": 3}

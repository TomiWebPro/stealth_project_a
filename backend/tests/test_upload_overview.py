"""Authoritative single-upload-ticket overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_KEYS = {
    "upload_id",
    "project_id",
    "project_name",
    "filename",
    "content_type",
    "status",
    "declared_size",
    "size_bytes",
    "bytes_remaining",
    "progress",
    "expired",
    "created_at",
    "expires_at",
    "counts",
    "generated_at",
}
_COUNT_KEYS = {"project_tickets", "project_completed", "project_bytes_uploaded"}
_BYTES = b"\x89PNG\r\n\x1a\n" + b"0" * 120


def _overview(client, upload_id, **params):
    return client.get(f"{PREFIX}/uploads/{upload_id}/overview", params=params)


def _store(client):
    return client.app.state.store


def _seed_project(client, name="Overview Project"):
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


def _seed_ticket(
    client,
    project_id,
    *,
    status="pending",
    declared_size=128,
    size_bytes=0,
    created_at=None,
    expires_at=None,
    filename="shot.png",
):
    from app.repositories.uploads import UploadRecord
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    now = created_at or utcnow()
    record = UploadRecord(
        upload_id=uuid4(),
        project_id=project_id,
        filename=filename,
        content_type="image/png",
        declared_size=declared_size,
        size_bytes=size_bytes,
        status=status,
        created_at=now,
        expires_at=expires_at or (now + timedelta(minutes=15)),
    )
    _store(client).put(
        Collections.UPLOADS, str(record.upload_id), record.model_dump(mode="json")
    )
    return record


def test_unknown_upload_uses_shared_404_envelope(client):
    response = _overview(client, uuid4())
    assert response.status_code == 404
    assert set(response.json()) == {"error"}
    error = response.json()["error"]
    assert error["code"] == "upload_not_found"
    assert error["request_id"]
    assert response.headers["X-Request-ID"]


def test_malformed_upload_id_uses_shared_422_envelope(client):
    response = _overview(client, "not-a-uuid")
    assert response.status_code == 422
    assert set(response.json()) == {"error"}
    assert response.json()["error"]["code"] == "validation_error"
    assert response.headers["X-Request-ID"]


def test_pending_ticket_overview_shape_and_identity(client):
    project = _seed_project(client, "Hero Project")
    record = _seed_ticket(client, project.id, declared_size=512)

    response = _overview(client, record.upload_id)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["upload_id"] == str(record.upload_id)
    assert body["project_id"] == str(project.id)
    assert body["project_name"] == "Hero Project"
    assert body["filename"] == "shot.png"
    assert body["content_type"] == "image/png"
    assert body["status"] == "pending"
    assert body["declared_size"] == 512
    assert body["size_bytes"] == 0
    assert body["bytes_remaining"] == 512
    assert body["progress"] == 0.0
    assert body["expired"] is False
    assert body["created_at"] and body["expires_at"]
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"]["project_tickets"] == 1
    assert body["counts"]["project_completed"] == 0
    assert body["counts"]["project_bytes_uploaded"] == 0
    assert body["generated_at"]


def test_complete_ticket_progress_and_project_counts(client):
    project = _seed_project(client)
    complete = _seed_ticket(
        client, project.id, status="complete", declared_size=128, size_bytes=128
    )
    _seed_ticket(client, project.id, declared_size=64)

    body = _overview(client, complete.upload_id).json()
    assert body["status"] == "complete"
    assert body["declared_size"] == 128
    assert body["size_bytes"] == 128
    assert body["bytes_remaining"] == 0
    assert body["progress"] == 1.0
    assert body["counts"] == {
        "project_tickets": 2,
        "project_completed": 1,
        "project_bytes_uploaded": 128,
    }


def test_partially_uploaded_ticket_derives_remaining_and_progress(client):
    project = _seed_project(client)
    record = _seed_ticket(client, project.id, declared_size=200, size_bytes=50)

    body = _overview(client, record.upload_id).json()
    assert body["bytes_remaining"] == 150
    assert body["progress"] == 0.25
    assert body["status"] == "pending"


def test_counts_match_upload_stats_project_bucket(client):
    project = _seed_project(client)
    other = _seed_project(client, "Other Project")
    complete = _seed_ticket(
        client, project.id, status="complete", declared_size=128, size_bytes=128
    )
    _seed_ticket(client, project.id, declared_size=64)
    _seed_ticket(
        client, other.id, status="complete", declared_size=256, size_bytes=256
    )

    overview = _overview(client, complete.upload_id).json()
    stats = client.get(f"{PREFIX}/uploads/stats").json()
    bucket = next(
        entry for entry in stats["by_project"] if entry["project_id"] == str(project.id)
    )
    assert overview["counts"] == {
        "project_tickets": bucket["total"],
        "project_completed": bucket["completed"],
        "project_bytes_uploaded": bucket["bytes_uploaded"],
    }


def test_orphan_project_uses_stable_unknown_name(client):
    record = _seed_ticket(client, uuid4())  # no project document seeded

    body = _overview(client, record.upload_id).json()
    assert body["project_name"] == "Unknown project"
    assert body["counts"]["project_tickets"] == 1


def test_expired_ticket_flag_uses_authoritative_clock(client):
    project = _seed_project(client)
    now = client.app.state.repositories.uploads.clock()
    fresh = _seed_ticket(client, project.id, expires_at=now + timedelta(minutes=5))
    expired = _seed_ticket(client, project.id, expires_at=now - timedelta(minutes=5))

    assert _overview(client, fresh.upload_id).json()["expired"] is False
    assert _overview(client, expired.upload_id).json()["expired"] is True


def test_overview_reflects_live_store_after_upload_completion(client):
    project = client.post(f"{PREFIX}/projects", json={"name": "Live Project"}).json()
    ticket = client.post(
        f"{PREFIX}/uploads",
        json={
            "project_id": project["id"],
            "filename": "frame.png",
            "content_type": "image/png",
            "size_bytes": 128,
        },
    ).json()

    before = _overview(client, ticket["upload_id"]).json()
    assert before["status"] == "pending"
    assert before["size_bytes"] == 0

    assert client.put(ticket["url"], content=_BYTES).status_code == 204

    after = _overview(client, ticket["upload_id"]).json()
    assert after["status"] == "complete"
    assert after["size_bytes"] == len(_BYTES)
    assert after["bytes_remaining"] == 128 - len(_BYTES)
    assert after["progress"] == len(_BYTES) / 128
    assert after["counts"] == {
        "project_tickets": 1,
        "project_completed": 1,
        "project_bytes_uploaded": len(_BYTES),
    }

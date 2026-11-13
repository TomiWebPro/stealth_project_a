"""Upload ticket and dev-local upload storage tests."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

import pytest

from app.errors import GoneError
from app.repositories.projects import ProjectRepository
from app.repositories.uploads import UploadRepository
from app.schemas.asset import UploadRequest
from app.schemas.auth import ProjectCreate
from app.schemas.common import utcnow
from app.storage.memory import InMemoryStore

from .conftest import PREFIX

_IMAGE_BYTES = b"\x89PNG\r\n\x1a\n" + b"0" * 512


def _create_project(client):
    response = client.post(f"{PREFIX}/projects", json={"name": "Upload Project"})
    assert response.status_code == 201
    return response.json()


def _create_upload_ticket(client):
    project = _create_project(client)
    response = client.post(
        f"{PREFIX}/uploads",
        json={
            "project_id": project["id"],
            "filename": "portrait.png",
            "content_type": "image/png",
            "size_bytes": len(_IMAGE_BYTES),
        },
    )
    assert response.status_code == 201
    return project, response.json()


def test_create_upload_ticket(client):
    _, ticket = _create_upload_ticket(client)
    assert ticket["upload_id"]
    assert ticket["url"].startswith("http")
    assert ticket["method"] == "PUT"
    assert ticket["headers"] == {"Content-Type": "image/png"}
    assert ticket["expires_at"]
    return None


def test_upload_put_and_download_roundtrip(client):
    _, ticket = _create_upload_ticket(client)

    response = client.put(
        ticket["url"],
        content=_IMAGE_BYTES,
        headers={"Content-Type": "image/png"},
    )
    assert response.status_code == 204

    download = client.get(
        f"{PREFIX}/uploads/{ticket['upload_id']}/content"
    )
    assert download.status_code == 200
    assert download.content == _IMAGE_BYTES
    assert download.headers["content-type"] == "image/png"


def test_upload_rejects_second_completion(client):
    _, ticket = _create_upload_ticket(client)
    response = client.put(ticket["url"], content=_IMAGE_BYTES)
    assert response.status_code == 204
    second = client.put(ticket["url"], content=_IMAGE_BYTES)
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "upload_already_complete"


def test_empty_upload_rejected(client):
    _, ticket = _create_upload_ticket(client)
    response = client.put(ticket["url"], content=b"")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_upload_content_unavailable_before_completion(client):
    _, ticket = _create_upload_ticket(client)
    response = client.get(f"{PREFIX}/uploads/{ticket['upload_id']}/content")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "upload_content_unavailable"


def test_upload_over_configured_limit_rejected(client):
    _, ticket = _create_upload_ticket(client)
    client.app.state.settings.max_upload_bytes = 4

    response = client.put(ticket["url"], content=_IMAGE_BYTES)
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "payload_too_large"

    # The partial file is removed, so the upload never becomes downloadable.
    assert client.get(f"{PREFIX}/uploads/{ticket['upload_id']}/content").status_code == 404


def test_expired_ticket_is_not_writable(tmp_path):
    store = InMemoryStore()
    projects = ProjectRepository(store)
    project = projects.create(
        ProjectCreate(name="Expiry"), org_id=uuid4(), user_id=uuid4()
    )

    now = utcnow()
    uploads = UploadRepository(
        store, projects, upload_dir=tmp_path / "uploads", clock=lambda: now
    )
    upload_id = uuid4()
    uploads.create_ticket(
        UploadRequest(
            project_id=project.id,
            filename="later.png",
            content_type="image/png",
            size_bytes=4,
        ),
        upload_id=upload_id,
        url="http://test/api/v1/uploads/x",
    )

    record = uploads.get_record_or_raise(upload_id)
    assert uploads.ensure_writable(record) is None

    expired = UploadRepository(
        store,
        projects,
        upload_dir=tmp_path / "uploads",
        clock=lambda: now + timedelta(minutes=16),
    )
    with pytest.raises(GoneError):
        expired.ensure_writable(record)


def test_upload_to_missing_project(client):
    from uuid import uuid4

    response = client.post(
        f"{PREFIX}/uploads",
        json={
            "project_id": str(uuid4()),
            "filename": "x.png",
            "content_type": "image/png",
            "size_bytes": 10,
        },
    )
    assert response.status_code == 404


def test_upload_to_archived_project_rejected(client):
    project = _create_project(client)
    client.delete(f"{PREFIX}/projects/{project['id']}")
    response = client.post(
        f"{PREFIX}/uploads",
        json={
            "project_id": project["id"],
            "filename": "x.png",
            "content_type": "image/png",
            "size_bytes": 10,
        },
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "project_archived"


def test_missing_upload_content(client):
    from uuid import uuid4

    response = client.get(f"{PREFIX}/uploads/{uuid4()}/content")
    assert response.status_code == 404
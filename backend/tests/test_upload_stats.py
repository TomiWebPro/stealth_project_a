"""Authoritative upload statistics endpoint tests (success + failure)."""

from __future__ import annotations

from uuid import uuid4

from app.repositories.uploads import UploadRecord
from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {
    "total_tickets",
    "pending",
    "completed",
    "bytes_uploaded",
    "by_status",
    "by_project",
    "newest_upload_at",
    "generated_at",
}


def _stats(client, **params):
    return client.get(f"{PREFIX}/uploads/stats", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Upload Stats Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _ticket(client, project_id, filename="asset.png", size=16):
    response = client.post(
        f"{PREFIX}/uploads",
        json={
            "project_id": project_id,
            "filename": filename,
            "content_type": "image/png",
            "size_bytes": size,
        },
    )
    assert response.status_code == 201
    return response.json()


def _complete(client, ticket, content=b"0123456789abcdef"):
    response = client.put(ticket["url"], content=content)
    assert response.status_code == 204


def _records(client):
    return [
        UploadRecord.model_validate(doc)
        for doc in client.app.state.store.all(Collections.UPLOADS)
    ]


def test_upload_stats_empty_store_is_zero_filled(client):
    _clear(client)

    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total_tickets"] == 0
    assert body["pending"] == 0
    assert body["completed"] == 0
    assert body["bytes_uploaded"] == 0
    assert body["by_status"] == [
        {"status": "pending", "count": 0},
        {"status": "complete", "count": 0},
    ]
    assert body["by_project"] == []
    assert body["newest_upload_at"] is None
    assert body["generated_at"]


def test_upload_stats_derives_counts_bytes_by_project_and_recency(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]

    t1 = _ticket(client, p1, "a.png", size=4)
    t2 = _ticket(client, p1, "b.png", size=8)
    t3 = _ticket(client, p2, "c.png", size=16)
    # Two completed tickets with distinct actual byte counts; one left pending.
    _complete(client, t1, content=b"1234")  # 4 bytes
    _complete(client, t3, content=b"0123456789abcdef")  # 16 bytes

    body = _stats(client).json()
    assert body["total_tickets"] == 3
    assert body["pending"] == 1
    assert body["completed"] == 2
    assert body["bytes_uploaded"] == 20
    assert body["by_status"] == [
        {"status": "pending", "count": 1},
        {"status": "complete", "count": 2},
    ]

    # by_project: P1 has 2 tickets (4 bytes complete), P2 has 1 (16 bytes),
    # ordered by descending ticket count then project id.
    assert [entry["project_id"] for entry in body["by_project"]] == [p1, p2]
    assert body["by_project"][0] == {
        "project_id": p1,
        "total": 2,
        "completed": 1,
        "bytes_uploaded": 4,
    }
    assert body["by_project"][1] == {
        "project_id": p2,
        "total": 1,
        "completed": 1,
        "bytes_uploaded": 16,
    }

    # Recency is the newest ticket creation time in the authoritative store.
    expected_newest = max(
        record.model_dump(mode="json")["created_at"] for record in _records(client)
    )
    assert body["newest_upload_at"] == expected_newest


def test_upload_stats_project_scope_counts_only_scoped_tickets(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]

    _ticket(client, p1, "a.png")
    _ticket(client, p1, "b.png")
    _ticket(client, p2, "c.png")

    scoped = _stats(client, project_id=p1).json()
    assert scoped["total_tickets"] == 2
    assert scoped["pending"] == 2
    assert [entry["project_id"] for entry in scoped["by_project"]] == [p1]

    global_body = _stats(client).json()
    assert global_body["total_tickets"] == 3


def test_upload_stats_unknown_and_malformed_project(client):
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


def test_upload_stats_is_derived_live_from_the_store(client):
    _clear(client)
    p = _project(client)["id"]

    before = _stats(client).json()
    assert before["total_tickets"] == 0

    ticket = _ticket(client, p, "new.png")
    after_create = _stats(client).json()
    assert after_create["total_tickets"] == 1
    assert after_create["pending"] == 1
    assert after_create["bytes_uploaded"] == 0

    _complete(client, ticket, content=b"0123456789abcdef")
    after_complete = _stats(client).json()
    assert after_complete["completed"] == 1
    assert after_complete["bytes_uploaded"] == 16

    client.app.state.store.delete(Collections.UPLOADS, ticket["upload_id"])
    after_delete = _stats(client).json()
    assert after_delete["total_tickets"] == 0
    assert after_delete["by_project"] == []

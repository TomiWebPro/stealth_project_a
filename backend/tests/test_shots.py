"""Shot generation, LoRA auto-mounting and frame validation tests."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX


def _project(client, archived=False):
    response = client.post(f"{PREFIX}/projects", json={"name": "Shot Project"})
    assert response.status_code == 201
    project = response.json()
    if archived:
        client.delete(f"{PREFIX}/projects/{project['id']}")
    return project


def _asset(client, project_id, asset_type, name, metadata=None):
    payload = {
        "project_id": project_id,
        "type": asset_type,
        "name": name,
        "storage": {
            "backend": "local",
            "key": f"{name}-{uuid4()}.bin",
            "size_bytes": 0,
            "content_type": "application/octet-stream",
        },
    }
    created = client.post(f"{PREFIX}/assets/register", json=payload)
    assert created.status_code == 201
    asset = created.json()
    if metadata:
        client.patch(f"{PREFIX}/assets/{asset['id']}", json={"metadata": metadata})
    return asset


def _chain(client, project_id, first, last=None, **overrides):
    payload = {
        "project_id": project_id,
        "first_frame_id": first,
        "last_frame_id": last,
        "sequence": "s01",
        "shot": "c01",
        "prompt": "cinematic",
        **overrides,
    }
    return client.post(f"{PREFIX}/pipelines/shot", json=payload)


def _lora(client, project_id, slot, status="ready"):
    asset = _asset(client, project_id, "lora", f"lora_{slot}", {"lora_slot": slot})
    if status == "deleted":
        client.delete(f"{PREFIX}/assets/{asset['id']}")
    return asset


# --- Auto mounting ----------------------------------------------------------


def test_shot_chain_mounts_loras_by_slot(client):
    project = _project(client)
    first = _asset(client, project["id"], "image", "first")
    last = _asset(client, project["id"], "image", "last")
    lora_char = _lora(client, project["id"], "char")
    lora_env = _lora(client, project["id"], "env")

    response = _chain(client, project["id"], first["id"], last["id"])
    assert response.status_code == 201
    chain = response.json()
    assert chain["shot_token"] == "s01_c01"
    assert chain["operation_id"] == "flf2v"
    mounted = {item["slot"]: item["asset_id"] for item in chain["mounted_loras"]}
    assert mounted == {"Char": lora_char["id"], "Env": lora_env["id"]}

    job = client.get(f"{PREFIX}/jobs/{chain['job_id']}").json()
    assert job["operation_id"] == "flf2v"
    assert job["project_id"] == project["id"]

    video = client.get(f"{PREFIX}/assets/{chain['video_asset_id']}").json()
    parents = set(video["parent_asset_ids"])
    assert {first["id"], last["id"], lora_char["id"], lora_env["id"]} <= parents
    assert video["metadata"]["shot"] == "s01_c01"


def test_shot_chain_without_last_frame_uses_image_to_video(client):
    project = _project(client)
    first = _asset(client, project["id"], "image", "first")
    response = _chain(client, project["id"], first["id"])
    assert response.status_code == 201
    assert response.json()["operation_id"] == "image-to-video"


def test_slot_filter(client):
    project = _project(client)
    first = _asset(client, project["id"], "image", "first")
    char = _lora(client, project["id"], "char")
    env = _lora(client, project["id"], "env")
    response = _chain(client, project["id"], first["id"], slots=["character"])
    assert response.status_code == 201
    mounted = response.json()["mounted_loras"]
    assert [item["asset_id"] for item in mounted] == [char["id"]]
    assert env["id"] not in [item["asset_id"] for item in mounted]


def test_deleted_lora_not_mounted(client):
    project = _project(client)
    first = _asset(client, project["id"], "image", "first")
    deleted = _lora(client, project["id"], "prop", status="deleted")
    response = _chain(client, project["id"], first["id"])
    assert response.json()["mounted_loras"] == []
    assert deleted["id"] not in [
        item["asset_id"] for item in response.json()["mounted_loras"]
    ]


# --- Failure paths ----------------------------------------------------------


def test_missing_project(client):
    response = _chain(client, str(uuid4()), str(uuid4()))
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "project_not_found"


def test_archived_project(client):
    project = _project(client, archived=True)
    response = _chain(client, project["id"], str(uuid4()))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "project_archived"


def test_foreign_frame_rejected(client):
    project = _project(client)
    other = _project(client)
    frame = _asset(client, other["id"], "image", "foreign")
    response = _chain(client, project["id"], frame["id"])
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_frame"


def test_wrong_type_frame_rejected(client):
    project = _project(client)
    frame = _asset(client, project["id"], "lora", "not_a_frame")
    response = _chain(client, project["id"], frame["id"])
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_frame"


def test_same_frame_rejected(client):
    project = _project(client)
    frame = _asset(client, project["id"], "image", "frame")
    response = _chain(client, project["id"], frame["id"], frame["id"])
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_frame"


def test_get_and_list_chains(client):
    p1 = _project(client)["id"]
    p2 = _project(client)["id"]
    first1 = _asset(client, p1, "image", "first1")
    first2 = _asset(client, p2, "image", "first2")
    chain = _chain(client, p1, first1["id"]).json()
    _chain(client, p2, first2["id"])
    assert client.get(f"{PREFIX}/pipelines/shot/{chain['id']}").json() == chain
    assert len(client.get(f"{PREFIX}/pipelines/shot").json()) == 2
    assert len(client.get(f"{PREFIX}/pipelines/shot", params={"project_id": p1}).json()) == 1

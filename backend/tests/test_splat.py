"""Splat/COLMAP chain and camera-path bridge tests."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX
from app.splat import CameraKeyframe, build_camera_path


def _project(client, archived=False):
    response = client.post(f"{PREFIX}/projects", json={"name": "Splat Project"})
    assert response.status_code == 201
    project = response.json()
    if archived:
        client.delete(f"{PREFIX}/projects/{project['id']}")
    return project


def _footage(client, project_id, asset_type="video"):
    payload = {
        "project_id": project_id,
        "type": asset_type,
        "name": f"footage-{uuid4()}",
        "storage": {
            "backend": "local",
            "key": f"footage/{uuid4()}.mp4",
            "size_bytes": 0,
            "content_type": "video/mp4",
        },
    }
    response = client.post(f"{PREFIX}/assets/register", json=payload)
    assert response.status_code == 201
    return response.json()


def _keyframes():
    return [
        {"t": 0.0, "position": [0, 0, 0], "rotation": [0, 0, 0]},
        {"t": 1.0, "position": [10, 0, 5], "rotation": [0, 90, 0]},
    ]


def _chain(client, project_id, footage_id, **overrides):
    payload = {
        "project_id": project_id,
        "footage_asset_ids": [footage_id],
        "scene_name": "Studio Set",
        "keyframes": overrides.pop("keyframes", _keyframes()),
        "samples": 5,
        **overrides,
    }
    return client.post(f"{PREFIX}/pipelines/splat", json=payload)


# --- Camera path ------------------------------------------------------------


def test_build_camera_path():
    frames = [
        CameraKeyframe(t=0.0, position=[0, 0, 0], rotation=[0, 0, 0]),
        CameraKeyframe(t=1.0, position=[10, 0, 5], rotation=[0, 90, 0]),
    ]
    path = build_camera_path(frames, 5)
    assert len(path) == 5
    assert path[0]["position"] == [0.0, 0.0, 0.0]
    assert path[-1]["position"] == [10.0, 0.0, 5.0]
    assert path[2]["position"] == [5.0, 0.0, 2.5]
    assert [point["t"] for point in path] == [0.0, 0.25, 0.5, 0.75, 1.0]


# --- Chain ------------------------------------------------------------------


def test_create_splat_chain(client):
    project = _project(client)
    footage = _footage(client, project["id"])
    response = _chain(client, project["id"], footage["id"])
    assert response.status_code == 201
    chain = response.json()
    assert chain["smoke"] is True
    assert len(chain["job_ids"]) == 2
    assert len(chain["camera_path"]) == 5

    jobs = [client.get(f"{PREFIX}/jobs/{job_id}").json() for job_id in chain["job_ids"]]
    assert [job["operation_id"] for job in jobs] == ["3d-reconstruction", "splat-train"]

    scene = client.get(f"{PREFIX}/assets/{chain['scene_asset_id']}").json()
    model = client.get(f"{PREFIX}/assets/{chain['model_asset_id']}").json()
    splat = client.get(f"{PREFIX}/assets/{chain['splat_asset_id']}").json()
    assert scene["type"] == "scene"
    assert model["type"] == "model3d"
    assert splat["type"] == "splat"
    assert scene["metadata"]["camera_path"] == chain["camera_path"]
    assert scene["metadata"]["mode"] == "cpu-smoke"
    assert splat["parent_asset_ids"] == [model["id"], scene["id"]]


def test_full_mode_flag(client):
    project = _project(client)
    footage = _footage(client, project["id"])
    chain = _chain(client, project["id"], footage["id"], smoke=False).json()
    assert chain["smoke"] is False
    scene = client.get(f"{PREFIX}/assets/{chain['scene_asset_id']}").json()
    assert scene["metadata"]["mode"] == "full"


def test_get_and_list_chains(client):
    p1 = _project(client)["id"]
    p2 = _project(client)["id"]
    f1 = _footage(client, p1)
    f2 = _footage(client, p2)
    chain = _chain(client, p1, f1["id"]).json()
    _chain(client, p2, f2["id"])
    assert client.get(f"{PREFIX}/pipelines/splat/{chain['id']}").json() == chain
    assert len(client.get(f"{PREFIX}/pipelines/splat").json()) == 2
    assert (
        len(client.get(f"{PREFIX}/pipelines/splat", params={"project_id": p1}).json())
        == 1
    )


def test_invalid_camera_path(client):
    project = _project(client)
    footage = _footage(client, project["id"])
    response = _chain(
        client,
        project["id"],
        footage["id"],
        keyframes=[
            {"t": 0.2, "position": [0, 0, 0], "rotation": [0, 0, 0]},
            {"t": 0.8, "position": [1, 1, 1], "rotation": [0, 0, 0]},
        ],
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_camera_path"


def test_foreign_footage_rejected(client):
    project = _project(client)
    other = _project(client)
    footage = _footage(client, other["id"])
    response = _chain(client, project["id"], footage["id"])
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_footage"


def test_missing_project(client):
    response = _chain(client, str(uuid4()), str(uuid4()))
    assert response.status_code == 404


def test_archived_project(client):
    project = _project(client, archived=True)
    response = _chain(client, project["id"], str(uuid4()))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "project_archived"


def test_missing_chain(client):
    response = client.get(f"{PREFIX}/pipelines/splat/{uuid4()}")
    assert response.status_code == 404

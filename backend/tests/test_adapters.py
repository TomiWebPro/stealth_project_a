"""Provider adapter inventory, health and simulated execution tests."""

from __future__ import annotations

from .conftest import PREFIX


def _project(client):
    response = client.post(f"{PREFIX}/projects", json={"name": "Adapter Project"})
    assert response.status_code == 201
    return response.json()


def _submit(client, operation_id="text-to-image"):
    project_id = _project(client)["id"]
    response = client.post(
        f"{PREFIX}/jobs",
        json={
            "operation_id": operation_id,
            "schema_version": "1.0.0",
            "project_id": project_id,
            "prompt": "hello",
        },
    )
    assert response.status_code == 201
    return response.json()


# --- Inventory / health -----------------------------------------------------


def test_list_adapters(client):
    response = client.get(f"{PREFIX}/adapters")
    assert response.status_code == 200
    by_id = {item["provider_id"]: item for item in response.json()}
    assert "local-comfyui" in by_id
    assert "cloud-render" in by_id
    assert by_id["local-comfyui"]["location"] == "local"
    assert "text-to-image" in by_id["local-comfyui"]["operations"]
    assert "image-to-video" in by_id["cloud-render"]["operations"]


def test_adapter_health(client):
    local = client.get(f"{PREFIX}/adapters/local-comfyui/health").json()
    assert local["status"] == "available"
    assert local["simulated"] is True
    cloud = client.get(f"{PREFIX}/adapters/cloud-render/health").json()
    assert cloud["status"] == "degraded"


def test_unknown_adapter_health(client):
    response = client.get(f"{PREFIX}/adapters/does-not-exist/health")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "unknown_adapter"


# --- Execution --------------------------------------------------------------


def test_run_job_with_local_adapter(client):
    job = _submit(client, "text-to-text")
    response = client.post(f"{PREFIX}/jobs/{job['id']}/run")
    assert response.status_code == 200
    finished = response.json()
    assert finished["status"] == "succeeded"
    assert finished["progress"] == 1.0
    assert finished["result"]["metadata"]["adapter"] == "local-comfyui"
    assert finished["result"]["text"]
    assert finished["finished_at"]

    events = client.get(f"{PREFIX}/jobs/{job['id']}/events").json()["events"]
    assert any(event["type"] == "progress" for event in events)
    assert any(event["type"] == "result" and event["status"] == "succeeded" for event in events)
    assert events[-1]["seq"] == len(events) - 1


def test_run_job_with_preferred_cloud_adapter(client):
    job = _submit(client, "text-to-image")
    response = client.post(
        f"{PREFIX}/jobs/{job['id']}/run", params={"provider_id": "cloud-render"}
    )
    assert response.status_code == 200
    assert response.json()["result"]["metadata"]["adapter"] == "cloud-render"


def test_preferred_adapter_must_support_operation(client):
    job = _submit(client, "text-to-text")  # cloud adapter does not support this
    response = client.post(
        f"{PREFIX}/jobs/{job['id']}/run", params={"provider_id": "cloud-render"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "no_adapter"


def test_no_adapter_for_operation(client):
    job = _submit(client, "splat-train")
    response = client.post(f"{PREFIX}/jobs/{job['id']}/run")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "no_adapter"


def test_unknown_provider_on_run(client):
    job = _submit(client)
    response = client.post(
        f"{PREFIX}/jobs/{job['id']}/run", params={"provider_id": "nope"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "unknown_adapter"


def test_run_missing_job(client):
    from uuid import uuid4

    response = client.post(f"{PREFIX}/jobs/{uuid4()}/run")
    assert response.status_code == 404


def test_run_twice_conflicts_then_retry(client):
    job = _submit(client)
    assert client.post(f"{PREFIX}/jobs/{job['id']}/run").status_code == 200
    second = client.post(f"{PREFIX}/jobs/{job['id']}/run")
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "job_not_startable"

    # A canceled job cannot be executed either.
    canceled = _submit(client)
    assert client.post(f"{PREFIX}/jobs/{canceled['id']}/cancel").status_code == 200
    response = client.post(f"{PREFIX}/jobs/{canceled['id']}/run")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "job_not_startable"

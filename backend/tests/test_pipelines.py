"""dataset-prep -> YAML -> lora-train chain and lineage tests."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX
from app.training import ai_toolkit_yaml
from app.training import LoraChainRequest


def _project(client, name="Train Project", archived=False):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    project = response.json()
    if archived:
        assert client.delete(f"{PREFIX}/projects/{project['id']}").status_code == 204
    return project


def _chain(client, project_id, **overrides):
    payload = {
        "project_id": project_id,
        "dataset_name": "hero_set",
        "trigger_word": "hero",
        "base_model": "sdxl-1.0",
        "steps": 800,
        **overrides,
    }
    return client.post(f"{PREFIX}/pipelines/lora", json=payload)


# --- YAML -------------------------------------------------------------------


def test_ai_toolkit_yaml_contains_spec():
    request = LoraChainRequest(
        project_id=uuid4(),
        dataset_name="hero_set",
        trigger_word="hero",
        base_model="sdxl-1.0",
        steps=800,
    )
    yaml = ai_toolkit_yaml(request)
    assert "job: extension_train" in yaml
    assert "trigger_word: hero" in yaml
    assert "base_model: sdxl-1.0" in yaml
    assert "steps: 800" in yaml
    assert "type: lora" in yaml


# --- Chain ------------------------------------------------------------------


def test_create_chain_creates_jobs_and_assets(client):
    project = _project(client)
    response = _chain(client, project["id"])
    assert response.status_code == 201
    chain = response.json()
    assert chain["project_id"] == project["id"]
    assert len(chain["job_ids"]) == 2

    jobs = [client.get(f"{PREFIX}/jobs/{job_id}").json() for job_id in chain["job_ids"]]
    assert [job["operation_id"] for job in jobs] == ["dataset-prep", "lora-train"]
    assert all(job["status"] == "queued" for job in jobs)
    assert all(job["project_id"] == project["id"] for job in jobs)

    dataset = client.get(f"{PREFIX}/assets/{chain['dataset_asset_id']}").json()
    config = client.get(f"{PREFIX}/assets/{chain['config_asset_id']}").json()
    lora = client.get(f"{PREFIX}/assets/{chain['lora_asset_id']}").json()
    assert dataset["type"] == "dataset"
    assert config["type"] == "resource"
    assert lora["type"] == "lora"
    assert lora["metadata"]["lora_slot"] == "char"
    assert len(lora["parent_asset_ids"]) == 2


def test_chain_lineage_relationships(client):
    project = _project(client)
    chain = _chain(client, project["id"]).json()
    relationships = client.get(
        f"{PREFIX}/assets/{chain['lora_asset_id']}/relationships"
    ).json()
    targets = {rel["to_asset_id"] for rel in relationships}
    assert chain["dataset_asset_id"] in targets
    assert chain["config_asset_id"] in targets
    assert all(rel["type"] == "derived_from" for rel in relationships)


def test_chain_yaml_and_hash(client):
    project = _project(client)
    chain = _chain(client, project["id"]).json()
    assert "trigger_word: hero" in chain["yaml"]
    assert len(chain["config_hash"]) == 64
    config = client.get(f"{PREFIX}/assets/{chain['config_asset_id']}").json()
    assert config["metadata"]["config_hash"] == chain["config_hash"]


def test_get_and_list_chains(client):
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]
    chain = _chain(client, p1).json()
    _chain(client, p2, dataset_name="other")

    assert client.get(f"{PREFIX}/pipelines/lora/{chain['id']}").json() == chain
    assert len(client.get(f"{PREFIX}/pipelines/lora").json()) == 2
    assert (
        len(client.get(f"{PREFIX}/pipelines/lora", params={"project_id": p1}).json())
        == 1
    )


def test_create_chain_missing_project(client):
    response = _chain(client, str(uuid4()))
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "project_not_found"


def test_create_chain_archived_project(client):
    project = _project(client, archived=True)
    response = _chain(client, project["id"])
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "project_archived"


def test_get_missing_chain(client):
    response = client.get(f"{PREFIX}/pipelines/lora/{uuid4()}")
    assert response.status_code == 404

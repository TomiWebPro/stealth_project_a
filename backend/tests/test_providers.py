"""Provider discovery and capability query endpoint tests."""

from __future__ import annotations

from .conftest import PREFIX


def test_list_providers(client):
    response = client.get(f"{PREFIX}/providers")
    assert response.status_code == 200
    providers = response.json()
    ids = [provider["id"] for provider in providers]
    assert "local-comfyui" in ids
    assert "cloud-render" in ids
    assert ids == sorted(ids)  # deterministic order


def test_get_provider_success(client):
    response = client.get(f"{PREFIX}/providers/local-comfyui")
    assert response.status_code == 200
    provider = response.json()
    assert provider["name"] == "Local ComfyUI"
    assert provider["location"] == "local"
    assert provider["status"] == "available"
    ops = {cap["operation_id"] for cap in provider["capabilities"]}
    assert "text-to-image" in ops


def test_get_unknown_provider(client):
    response = client.get(f"{PREFIX}/providers/nope")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "provider_not_found"


def test_capabilities_by_operation(client):
    response = client.get(
        f"{PREFIX}/capabilities", params={"operation_id": "lora-train"}
    )
    assert response.status_code == 200
    providers = response.json()
    ids = {provider["id"] for provider in providers}
    assert ids == {"studio-trainer", "cloud-trainer"}
    for provider in providers:
        assert [cap["operation_id"] for cap in provider["capabilities"]] == ["lora-train"]


def test_capabilities_by_location(client):
    response = client.get(f"{PREFIX}/capabilities", params={"location": "local"})
    assert response.status_code == 200
    ids = {provider["id"] for provider in response.json()}
    assert ids == {"local-comfyui", "local-llm"}


def test_capabilities_by_operation_and_location(client):
    response = client.get(
        f"{PREFIX}/capabilities",
        params={"operation_id": "text-to-image", "location": "cloud"},
    )
    assert response.status_code == 200
    providers = response.json()
    assert [provider["id"] for provider in providers] == ["cloud-render"]


def test_capabilities_unknown_operation(client):
    response = client.get(
        f"{PREFIX}/capabilities", params={"operation_id": "not-an-operation"}
    )
    assert response.status_code == 200
    assert response.json() == []


def test_capabilities_all(client):
    response = client.get(f"{PREFIX}/capabilities")
    assert response.status_code == 200
    assert len(response.json()) == 5


def test_capabilities_invalid_location(client):
    response = client.get(f"{PREFIX}/capabilities", params={"location": "moon"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"

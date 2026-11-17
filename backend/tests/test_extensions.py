"""Extension registry and install/enable/disable lifecycle tests."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX

COMFY = "com.studio.comfyui-bridge"
BLENDER = "com.studio.blender-export"
SPLAT = "com.studio.splat-viewer"


def _install(client, extension_id=COMFY, accepted=None, **overrides):
    payload = {
        "extension_id": extension_id,
        "accepted_permissions": accepted
        if accepted is not None
        else ["provider.access", "assets.read", "storage.write"],
        **overrides,
    }
    return client.post(f"{PREFIX}/extensions/install", json=payload)


# --- Registry ---------------------------------------------------------------


def test_list_registry(client):
    response = client.get(f"{PREFIX}/extensions/registry")
    assert response.status_code == 200
    ids = [item["id"] for item in response.json()]
    assert ids == sorted([COMFY, BLENDER, SPLAT])


def test_registry_entry_shape(client):
    entry = next(
        item
        for item in client.get(f"{PREFIX}/extensions/registry").json()
        if item["id"] == COMFY
    )
    assert entry["type"] == "provider"
    assert entry["requirements"]["permissions"][0]["name"] == "provider.access"
    assert entry["signed"] if "signed" in entry else True


# --- Install ----------------------------------------------------------------


def test_install_success(client):
    response = _install(client, COMFY, accepted=["provider.access"])
    assert response.status_code == 201
    result = response.json()
    assert result["extension_id"]
    assert result["status"] == "installed"
    assert result["manifest"]["id"] == COMFY

    installed = client.get(f"{PREFIX}/extensions").json()
    assert len(installed) == 1
    assert installed[0]["manifest"]["id"] == COMFY
    assert installed[0]["signed"] is True
    assert installed[0]["verified"] is True


def test_install_requires_all_permissions(client):
    response = _install(client, BLENDER, accepted=["assets.read"])
    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "permissions_not_accepted"
    assert "storage.write" in body["details"][0]["message"]


def test_install_unknown_extension(client):
    response = _install(client, "com.unknown.thing")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "extension_not_found"


def test_install_wrong_version(client):
    response = _install(client, COMFY, accepted=["provider.access"], version="9.9.9")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "version_not_found"


def test_install_duplicate(client):
    assert _install(client, COMFY, accepted=["provider.access"]).status_code == 201
    response = _install(client, COMFY, accepted=["provider.access"])
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "already_installed"


# --- Lifecycle --------------------------------------------------------------


def test_enable_disable_and_idempotency(client):
    extension_id = _install(client, COMFY, accepted=["provider.access"]).json()[
        "extension_id"
    ]
    enabled = client.post(f"{PREFIX}/extensions/{extension_id}/enable")
    assert enabled.status_code == 200
    assert enabled.json()["status"] == "enabled"
    assert (
        client.post(f"{PREFIX}/extensions/{extension_id}/enable").json()["status"]
        == "enabled"
    )

    disabled = client.post(f"{PREFIX}/extensions/{extension_id}/disable")
    assert disabled.status_code == 200
    assert disabled.json()["status"] == "disabled"
    assert client.get(f"{PREFIX}/extensions/{extension_id}").json()["status"] == "disabled"


def test_lifecycle_missing_extension(client):
    response = client.post(f"{PREFIX}/extensions/{uuid4()}/enable")
    assert response.status_code == 404


def test_uninstall(client):
    extension_id = _install(client, COMFY, accepted=["provider.access"]).json()[
        "extension_id"
    ]
    assert client.delete(f"{PREFIX}/extensions/{extension_id}").status_code == 204
    assert client.get(f"{PREFIX}/extensions/{extension_id}").status_code == 404
    assert client.get(f"{PREFIX}/extensions").json() == []

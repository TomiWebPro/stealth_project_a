"""Extension permission enforcement and isolation-boundary tests (P5.2)."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX

COMFY = "com.studio.comfyui-bridge"
BLENDER = "com.studio.blender-export"
SPLAT = "com.studio.splat-viewer"


def _install(client, extension_id=COMFY, accepted=None):
    payload = {
        "extension_id": extension_id,
        "accepted_permissions": accepted
        if accepted is not None
        else ["provider.access", "assets.read", "storage.write"],
    }
    response = client.post(f"{PREFIX}/extensions/install", json=payload)
    assert response.status_code == 201
    return response.json()["extension_id"]


def _enabled(client, extension_id=COMFY, accepted=None):
    ext_id = _install(client, extension_id, accepted)
    assert client.post(f"{PREFIX}/extensions/{ext_id}/enable").status_code == 200
    return ext_id


def _authorize(client, ext_id, **payload):
    return client.post(f"{PREFIX}/extensions/{ext_id}/authorize", json=payload)


# --- Scope / isolation boundary ----------------------------------------------


def test_scope_reflects_manifest_and_trust(client):
    ext_id = _enabled(client, COMFY, ["provider.access"])
    response = client.get(f"{PREFIX}/extensions/{ext_id}/permissions")
    assert response.status_code == 200
    scope = response.json()
    assert scope["extension_id"] == ext_id
    assert scope["status"] == "enabled"
    assert scope["enabled"] is True
    assert scope["permissions"] == ["provider.access"]
    assert scope["provider_ids"] == ["local-comfyui"]
    assert scope["ui_contributions"] == ["provider:local-comfyui"]
    assert scope["signed"] is True
    assert scope["verified"] is True


def test_scope_of_disabled_extension_is_inactive(client):
    ext_id = _install(client, COMFY, ["provider.access"])
    scope = client.get(f"{PREFIX}/extensions/{ext_id}/permissions").json()
    assert scope["enabled"] is False
    assert scope["status"] == "installed"


def test_untrusted_extension_scope(client):
    ext_id = _install(client, SPLAT, ["assets.read"])
    scope = client.get(f"{PREFIX}/extensions/{ext_id}/permissions").json()
    assert scope["signed"] is False
    assert scope["verified"] is False
    assert scope["capabilities"] == ["splat-preview"]


# --- Authorization -----------------------------------------------------------


def test_authorize_declared_permission(client):
    ext_id = _enabled(client, COMFY, ["provider.access"])
    response = _authorize(client, ext_id, permission="provider.access")
    assert response.status_code == 200
    decision = response.json()
    assert decision["allowed"] is True
    assert decision["permission"] == "provider.access"
    assert decision["capability"] is None
    assert decision["scope"]["enabled"] is True


def test_authorize_declared_capability(client):
    ext_id = _enabled(client, BLENDER, ["assets.read", "storage.write"])
    response = _authorize(client, ext_id, capability="export-blend")
    assert response.status_code == 200
    assert response.json()["allowed"] is True


def test_authorize_undeclared_permission_denied(client):
    ext_id = _enabled(client, COMFY, ["provider.access"])
    response = _authorize(client, ext_id, permission="storage.write")
    assert response.status_code == 403
    body = response.json()["error"]
    assert body["code"] == "permission_denied"
    assert body["details"][0]["message"] == "not declared"


def test_authorize_undeclared_capability_denied(client):
    ext_id = _enabled(client, COMFY, ["provider.access"])
    response = _authorize(client, ext_id, capability="export-blend")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "permission_denied"


def test_disabled_extension_denied(client):
    ext_id = _install(client, COMFY, ["provider.access"])
    response = _authorize(client, ext_id, permission="provider.access")
    assert response.status_code == 403
    body = response.json()["error"]
    assert body["code"] == "permission_denied"
    assert body["details"][0]["message"] == "installed"


def test_reenabled_extension_allowed_again(client):
    ext_id = _enabled(client, COMFY, ["provider.access"])
    assert client.post(f"{PREFIX}/extensions/{ext_id}/disable").status_code == 200
    assert _authorize(client, ext_id, permission="provider.access").status_code == 403
    assert client.post(f"{PREFIX}/extensions/{ext_id}/enable").status_code == 200
    assert _authorize(client, ext_id, permission="provider.access").status_code == 200


def test_authorize_requires_a_target(client):
    ext_id = _enabled(client, COMFY, ["provider.access"])
    response = _authorize(client, ext_id)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "nothing_to_authorize"


# --- Failure paths -----------------------------------------------------------


def test_scope_unknown_extension(client):
    response = client.get(f"{PREFIX}/extensions/{uuid4()}/permissions")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "extension_not_found"


def test_authorize_unknown_extension(client):
    response = _authorize(client, uuid4(), permission="provider.access")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "extension_not_found"


def test_scope_after_uninstall(client):
    ext_id = _enabled(client, COMFY, ["provider.access"])
    assert client.delete(f"{PREFIX}/extensions/{ext_id}").status_code == 204
    assert client.get(f"{PREFIX}/extensions/{ext_id}/permissions").status_code == 404

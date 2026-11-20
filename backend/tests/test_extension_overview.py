"""Authoritative extension-overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import NAMESPACE_URL, uuid4, uuid5

from app.schemas.common import utcnow
from app.schemas.provider import (
    Extension,
    ExtensionDependency,
    ExtensionManifest,
    ExtensionPermission,
    ExtensionRequirements,
)
from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {
    "extension_id",
    "manifest_id",
    "name",
    "version",
    "publisher",
    "type",
    "status",
    "installed_at",
    "runtime",
    "app_versions",
    "signed",
    "verified",
    "permissions",
    "capabilities",
    "provider_ids",
    "ui_contributions",
    "dependencies",
    "counts",
    "generated_at",
}
_COUNT_KEYS = {
    "permissions",
    "capabilities",
    "provider_ids",
    "ui_contributions",
    "dependencies",
}


def _overview(client, extension_id):
    return client.get(f"{PREFIX}/extensions/{extension_id}/overview")


def _store(client):
    return client.app.state.store


def _extension_id(manifest_id: str):
    return uuid5(NAMESPACE_URL, f"studio-extension:{manifest_id}")


def _seed_extension(
    client,
    manifest_id: str,
    *,
    name="Overview Extension",
    type="capability",
    status="enabled",
    publisher="Studio Platform",
    version="1.2.3",
    app_versions=">=0.2.0",
    runtime=None,
    permissions=None,
    capabilities=None,
    provider_ids=None,
    ui_contributions=None,
    dependencies=None,
    installed_at=None,
    signed=True,
    verified=True,
):
    """Write an Extension straight to the authoritative store with deterministic data."""
    requirements = ExtensionRequirements(
        app_versions=app_versions,
        permissions=permissions
        if permissions is not None
        else [ExtensionPermission(name="assets.read")],
        capabilities=capabilities if capabilities is not None else [],
        provider_ids=provider_ids if provider_ids is not None else [],
        runtime=runtime,
    )
    manifest = ExtensionManifest(
        id=manifest_id,
        name=name,
        version=version,
        publisher=publisher,
        type=type,
        requirements=requirements,
        dependencies=dependencies if dependencies is not None else [],
        ui_contributions=ui_contributions if ui_contributions is not None else [],
    )
    extension = Extension(
        manifest=manifest,
        status=status,
        installed_at=installed_at,
        signed=signed,
        verified=verified,
    )
    extension_id = _extension_id(manifest_id)
    _store(client).put(
        Collections.EXTENSIONS, str(extension_id), extension.model_dump(mode="json")
    )
    return extension_id


def test_overview_of_seeded_extension_has_full_shape(client):
    installed = utcnow() - timedelta(days=1)
    extension_id = _seed_extension(
        client,
        "com.studio.overview",
        name="Overview Extension",
        type="provider",
        status="enabled",
        version="1.2.3",
        publisher="Studio Platform",
        runtime="local",
        installed_at=installed,
    )

    response = _overview(client, extension_id)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["extension_id"] == str(extension_id)
    assert body["manifest_id"] == "com.studio.overview"
    assert body["name"] == "Overview Extension"
    assert body["version"] == "1.2.3"
    assert body["publisher"] == "Studio Platform"
    assert body["type"] == "provider"
    assert body["status"] == "enabled"
    assert body["installed_at"] == installed.isoformat().replace("+00:00", "Z")
    assert body["runtime"] == "local"
    assert body["app_versions"] == ">=0.2.0"
    assert body["signed"] is True
    assert body["verified"] is True
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["generated_at"]


def test_declared_scope_sorted_deduplicated_and_counts_agree(client):
    extension_id = _seed_extension(
        client,
        "com.studio.scope",
        permissions=[
            ExtensionPermission(name="storage.write"),
            ExtensionPermission(name="assets.read"),
            ExtensionPermission(name="assets.read"),
        ],
        capabilities=["splat-preview", "export-blend", "splat-preview"],
        provider_ids=["z-provider", "a-provider", "a-provider"],
        ui_contributions=["viewer:splat", "export:blender", "viewer:splat"],
        dependencies=[
            ExtensionDependency(extension_id="com.b", version_range=">=1.0.0"),
            ExtensionDependency(extension_id="com.a", version_range=">=1.0.0"),
            ExtensionDependency(extension_id="com.b", version_range=">=1.0.0"),
        ],
    )

    body = _overview(client, extension_id).json()
    assert body["permissions"] == ["assets.read", "storage.write"]
    assert body["capabilities"] == ["export-blend", "splat-preview"]
    assert body["provider_ids"] == ["a-provider", "z-provider"]
    assert body["ui_contributions"] == ["export:blender", "viewer:splat"]
    assert body["dependencies"] == ["com.a", "com.b"]
    assert body["counts"] == {
        "permissions": 2,
        "capabilities": 2,
        "provider_ids": 2,
        "ui_contributions": 2,
        "dependencies": 2,
    }
    # Each count is the length of its emitted list so the two cannot drift.
    for key in _COUNT_KEYS:
        assert body["counts"][key] == len(body[key])


def test_overview_without_declarations_is_zero_filled(client):
    extension_id = _seed_extension(
        client,
        "com.studio.bare",
        permissions=[],
        capabilities=[],
        provider_ids=[],
        ui_contributions=[],
        dependencies=[],
        runtime=None,
        signed=False,
        verified=False,
    )

    body = _overview(client, extension_id).json()
    assert body["permissions"] == []
    assert body["capabilities"] == []
    assert body["provider_ids"] == []
    assert body["ui_contributions"] == []
    assert body["dependencies"] == []
    assert body["runtime"] is None
    assert body["signed"] is False
    assert body["verified"] is False
    assert body["counts"] == {key: 0 for key in _COUNT_KEYS}


def test_installed_at_can_be_null(client):
    extension_id = _seed_extension(client, "com.studio.nulltime", installed_at=None)
    body = _overview(client, extension_id).json()
    assert body["installed_at"] is None


def test_seeded_registry_extension_installed_via_api_is_derivable(client):
    # Install a real registry extension through the lifecycle endpoint, then
    # derive its overview from the authoritative store.
    install = client.post(
        f"{PREFIX}/extensions/install",
        json={
            "extension_id": "com.studio.blender-export",
            "accepted_permissions": ["assets.read", "storage.write"],
        },
    )
    assert install.status_code == 201
    extension_id = install.json()["extension_id"]

    body = _overview(client, extension_id).json()
    assert body["manifest_id"] == "com.studio.blender-export"
    assert body["name"] == "Blender Export"
    assert body["type"] == "capability"
    assert body["status"] == "installed"
    assert body["signed"] is True
    assert body["verified"] is True
    assert body["permissions"] == ["assets.read", "storage.write"]
    assert body["capabilities"] == ["export-blend"]
    assert body["dependencies"] == ["com.studio.comfyui-bridge"]
    assert body["ui_contributions"] == ["export:blender"]


def test_unknown_extension_uses_shared_404_envelope(client):
    response = _overview(client, uuid4())
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "extension_not_found"
    assert error["request_id"]


def test_malformed_id_uses_shared_422_envelope(client):
    response = _overview(client, "not-a-uuid")
    assert response.status_code == 422
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "validation_error"


def test_literal_overview_path_is_not_parsed_as_extension_id(client):
    # A malformed id with the literal /overview suffix still 422s rather than
    # being swallowed by the dynamic extension route.
    response = client.get(f"{PREFIX}/extensions/not-a-uuid/overview")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"

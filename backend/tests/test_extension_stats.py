"""Authoritative extension registry/installation statistics endpoint tests."""

from __future__ import annotations

from .conftest import PREFIX

_KEYS = {
    "total_registered",
    "total_installed",
    "by_type",
    "by_status",
    "enabled",
    "signed",
    "verified",
    "total_permissions",
    "unique_permissions",
    "by_permission",
    "total_capabilities",
    "generated_at",
}
_TYPES = [
    {"type": "capability", "count": 0},
    {"type": "ui", "count": 0},
    {"type": "provider", "count": 0},
    {"type": "runtime", "count": 0},
    {"type": "bundle", "count": 0},
]
_STATUSES = [
    {"status": "installed", "count": 0},
    {"status": "enabled", "count": 0},
    {"status": "disabled", "count": 0},
    {"status": "update_available", "count": 0},
]


def _stats(client, **params):
    return client.get(f"{PREFIX}/extensions/stats", params=params)


def _clear(client):
    client.app.state.store.clear()


def _put_installed(
    client,
    extension_id,
    *,
    type="ui",
    status="enabled",
    signed=False,
    verified=False,
    permissions=(),
    capabilities=(),
):
    from app.schemas.provider import (
        Extension,
        ExtensionManifest,
        ExtensionPermission,
        ExtensionRequirements,
    )
    from app.storage.base import Collections

    manifest = ExtensionManifest(
        id=extension_id,
        name=extension_id,
        version="1.0.0",
        publisher="Test Publisher",
        type=type,
        requirements=ExtensionRequirements(
            app_versions=">=0.1.0",
            permissions=[ExtensionPermission(name=name) for name in permissions],
            capabilities=list(capabilities),
        ),
    )
    extension = Extension(
        manifest=manifest,
        status=status,
        signed=signed,
        verified=verified,
    )
    client.app.state.store.put(
        Collections.EXTENSIONS, extension_id, extension.model_dump(mode="json")
    )
    return extension


def _put_three_installed(client):
    _put_installed(
        client, "a", type="ui", status="enabled", signed=True, verified=True,
        permissions=("assets.read",),
    )
    _put_installed(
        client, "b", type="provider", status="disabled", signed=True,
        permissions=("provider.access",),
    )
    _put_installed(client, "c", type="capability", status="installed")


def test_extension_stats_derives_seed_registry(client):
    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    # The extension repository seeds 3 registry manifests on a fresh store.
    assert body["total_registered"] == 3
    assert body["total_installed"] == 0
    assert body["by_type"] == [
        {"type": "capability", "count": 1},
        {"type": "ui", "count": 1},
        {"type": "provider", "count": 1},
        {"type": "runtime", "count": 0},
        {"type": "bundle", "count": 0},
    ]
    assert body["by_status"] == _STATUSES
    assert body["enabled"] == 0
    assert body["signed"] == 0
    assert body["verified"] == 0
    assert body["total_permissions"] == 4
    assert body["unique_permissions"] == 3
    assert body["by_permission"] == [
        {"permission": "assets.read", "extensions": 2},
        {"permission": "provider.access", "extensions": 1},
        {"permission": "storage.write", "extensions": 1},
    ]
    assert body["total_capabilities"] == 2
    assert body["generated_at"]


def test_extension_stats_empty_stores_are_zero_filled(client):
    _clear(client)
    body = _stats(client).json()
    assert body["total_registered"] == 0
    assert body["total_installed"] == 0
    assert body["by_type"] == _TYPES
    assert body["by_status"] == _STATUSES
    assert body["enabled"] == 0
    assert body["signed"] == 0
    assert body["verified"] == 0
    assert body["total_permissions"] == 0
    assert body["unique_permissions"] == 0
    assert body["by_permission"] == []
    assert body["total_capabilities"] == 0
    assert body["generated_at"]


def test_extension_stats_derives_installed_extensions(client):
    _clear(client)
    _put_three_installed(client)

    body = _stats(client).json()
    assert body["total_installed"] == 3
    assert body["by_status"] == [
        {"status": "installed", "count": 1},
        {"status": "enabled", "count": 1},
        {"status": "disabled", "count": 1},
        {"status": "update_available", "count": 0},
    ]
    assert body["enabled"] == 1
    assert body["signed"] == 2
    assert body["verified"] == 1
    # Registry metrics stay zero-filled: the registry was cleared above.
    assert body["total_registered"] == 0
    assert body["by_type"] == _TYPES
    assert body["by_permission"] == []


def test_extension_stats_filters_type_and_status_independently(client):
    _put_three_installed(client)

    # `type` narrows only the registry slice; installed counts stay unchanged.
    ui = _stats(client, type="ui").json()
    assert ui["total_registered"] == 1
    assert ui["by_type"] == [
        {"type": "capability", "count": 0},
        {"type": "ui", "count": 1},
        {"type": "provider", "count": 0},
        {"type": "runtime", "count": 0},
        {"type": "bundle", "count": 0},
    ]
    assert ui["by_permission"] == [{"permission": "assets.read", "extensions": 1}]
    assert ui["total_installed"] == 3

    # `status` narrows only the installed slice; registry counts stay unchanged.
    enabled = _stats(client, status="enabled").json()
    assert enabled["total_registered"] == 3
    assert enabled["total_installed"] == 1
    assert enabled["by_status"] == [
        {"status": "installed", "count": 0},
        {"status": "enabled", "count": 1},
        {"status": "disabled", "count": 0},
        {"status": "update_available", "count": 0},
    ]
    assert enabled["signed"] == 1
    assert enabled["verified"] == 1

    # A well-formed combination matching neither slice is a valid zero snapshot.
    none = _stats(client, type="bundle", status="update_available").json()
    assert none["total_registered"] == 0
    assert none["by_type"] == _TYPES
    assert none["total_installed"] == 0
    assert none["by_status"] == _STATUSES


def test_extension_stats_is_derived_live_from_the_store(client):
    _clear(client)
    assert _stats(client).json()["total_installed"] == 0

    _put_installed(client, "x", status="enabled", signed=True)
    first = _stats(client).json()
    assert first["total_installed"] == 1
    assert first["enabled"] == 1
    assert first["signed"] == 1
    assert first["verified"] == 0

    # Flipping the stored status is reflected on the next call without rebuild.
    from app.schemas.provider import Extension
    from app.storage.base import Collections

    document = client.app.state.store.get(Collections.EXTENSIONS, "x")
    document["status"] = "disabled"
    client.app.state.store.put(Collections.EXTENSIONS, "x", Extension.model_validate(document).model_dump(mode="json"))

    second = _stats(client).json()
    assert second["enabled"] == 0
    assert second["by_status"][2] == {"status": "disabled", "count": 1}

    _clear(client)
    assert _stats(client).json()["total_installed"] == 0


def test_extension_stats_rejects_invalid_type(client):
    response = _stats(client, type="mystery")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_extension_stats_rejects_invalid_status(client):
    response = _stats(client, status="bogus")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]

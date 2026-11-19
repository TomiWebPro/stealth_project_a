"""Authoritative extension-feed endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import NAMESPACE_URL, uuid5

from app.schemas.common import utcnow
from app.schemas.provider import Extension, ExtensionManifest, ExtensionRequirements
from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {"items", "total", "generated_at"}
_ITEM_KEYS = {
    "extension_id",
    "manifest_id",
    "name",
    "version",
    "publisher",
    "type",
    "status",
    "signed",
    "verified",
    "installed_at",
}


def _feed(client, **params):
    return client.get(f"{PREFIX}/extensions/feed", params=params)


def _clear(client):
    client.app.state.store.clear()


def _extension_id(manifest_id: str):
    return uuid5(NAMESPACE_URL, f"studio-extension:{manifest_id}")


def _seed_extension(
    client,
    manifest_id: str,
    *,
    name="Extension",
    type="provider",
    status="installed",
    publisher="Studio Platform",
    version="1.0.0",
    installed_at=None,
    signed=False,
    verified=False,
):
    manifest = ExtensionManifest(
        id=manifest_id,
        name=name,
        version=version,
        publisher=publisher,
        type=type,
        requirements=ExtensionRequirements(app_versions=">=0.2.0"),
    )
    extension = Extension(
        manifest=manifest,
        status=status,
        installed_at=installed_at or utcnow(),
        signed=signed,
        verified=verified,
    )
    extension_id = _extension_id(manifest_id)
    client.app.state.store.put(
        Collections.EXTENSIONS, str(extension_id), extension.model_dump(mode="json")
    )
    return extension_id


def _sorted_desc(items):
    return items == sorted(
        items,
        key=lambda item: (item["installed_at"], item["extension_id"]),
        reverse=True,
    )


def test_extension_feed_empty_store_is_zero_filled(client):
    _clear(client)

    response = _feed(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["items"] == []
    assert body["generated_at"]


def test_extension_feed_is_newest_first_with_full_item_shape(client):
    _clear(client)
    now = utcnow()
    older = _seed_extension(
        client, "com.studio.older", name="Older", installed_at=now - timedelta(hours=2)
    )
    newer = _seed_extension(
        client,
        "com.studio.newer",
        name="Newer",
        type="capability",
        status="enabled",
        publisher="Community",
        version="2.1.0",
        installed_at=now,
        signed=True,
        verified=True,
    )

    body = _feed(client).json()
    assert set(body) == _KEYS
    assert body["total"] == 2
    items = body["items"]
    assert len(items) == 2
    assert _sorted_desc(items)
    for item in items:
        assert set(item) == _ITEM_KEYS

    newest = items[0]
    assert newest["extension_id"] == str(newer)
    assert newest["manifest_id"] == "com.studio.newer"
    assert newest["name"] == "Newer"
    assert newest["version"] == "2.1.0"
    assert newest["publisher"] == "Community"
    assert newest["type"] == "capability"
    assert newest["status"] == "enabled"
    assert newest["signed"] is True
    assert newest["verified"] is True

    assert items[1]["extension_id"] == str(older)
    assert items[1]["manifest_id"] == "com.studio.older"


def test_extension_feed_ties_break_by_extension_id(client):
    _clear(client)
    same_time = utcnow()
    ids = [
        _seed_extension(client, f"com.studio.tie-{i}", installed_at=same_time)
        for i in range(3)
    ]

    items = _feed(client).json()["items"]
    assert _sorted_desc(items)
    assert [item["extension_id"] for item in items] == sorted(
        (str(value) for value in ids), reverse=True
    )


def test_extension_feed_limit_bounds_page_but_not_total(client):
    _clear(client)
    for i in range(4):
        _seed_extension(client, f"com.studio.limit-{i}")

    body = _feed(client, limit=2).json()
    assert body["total"] == 4
    assert len(body["items"]) == 2
    assert _sorted_desc(body["items"])


def test_extension_feed_type_filter(client):
    _clear(client)
    _seed_extension(client, "com.studio.provider", type="provider")
    _seed_extension(client, "com.studio.ui", type="ui")
    _seed_extension(client, "com.studio.capability", type="capability")

    body = _feed(client, type="ui").json()
    assert body["total"] == 1
    assert body["items"][0]["type"] == "ui"
    assert body["items"][0]["manifest_id"] == "com.studio.ui"


def test_extension_feed_status_filter(client):
    _clear(client)
    _seed_extension(client, "com.studio.installed", status="installed")
    _seed_extension(client, "com.studio.enabled", status="enabled")
    _seed_extension(client, "com.studio.disabled", status="disabled")

    body = _feed(client, status="enabled").json()
    assert body["total"] == 1
    assert body["items"][0]["status"] == "enabled"
    assert body["items"][0]["manifest_id"] == "com.studio.enabled"


def test_extension_feed_total_agrees_with_extension_stats(client):
    _clear(client)
    _seed_extension(client, "com.studio.a", status="installed")
    _seed_extension(client, "com.studio.b", status="enabled")

    feed = _feed(client).json()
    stats = client.get(f"{PREFIX}/extensions/stats").json()
    assert feed["total"] == stats["total_installed"] == 2


def test_extension_feed_is_derived_live_from_the_store(client):
    _clear(client)
    assert _feed(client).json()["total"] == 0

    extension_id = _seed_extension(client, "com.studio.live")
    body = _feed(client).json()
    assert body["total"] == 1
    assert body["items"][0]["extension_id"] == str(extension_id)

    client.app.state.store.delete(Collections.EXTENSIONS, str(extension_id))
    assert _feed(client).json()["total"] == 0


def test_extension_feed_skips_extension_without_install_time(client):
    _clear(client)
    _seed_extension(client, "com.studio.no-time", installed_at=None)
    # Overwrite with a document lacking installed_at to exercise the guard.
    manifest = ExtensionManifest(
        id="com.studio.no-time",
        name="No time",
        version="1.0.0",
        publisher="Studio Platform",
        type="provider",
        requirements=ExtensionRequirements(app_versions=">=0.2.0"),
    )
    document = Extension(manifest=manifest, status="installed").model_dump(mode="json")
    client.app.state.store.put(Collections.EXTENSIONS, str(_extension_id(manifest.id)), document)

    assert _feed(client).json()["total"] == 0


def test_extension_feed_literal_route_wins_over_extension_id(client):
    extension_id = _seed_extension(client, "com.studio.detail")

    assert _feed(client).status_code == 200
    detail = client.get(f"{PREFIX}/extensions/{extension_id}")
    assert detail.status_code == 200
    assert detail.json()["manifest"]["id"] == "com.studio.detail"


def test_extension_feed_invalid_limit_uses_shared_422_envelope(client):
    _clear(client)
    for bad_limit in (0, 201):
        response = _feed(client, limit=bad_limit)
        assert response.status_code == 422
        error = response.json()["error"]
        assert error["code"] == "validation_error"
        assert error["request_id"] == response.headers["X-Request-ID"]


def test_extension_feed_invalid_filters_use_shared_422_envelope(client):
    _clear(client)
    for bad_filter in ({"type": "not-a-type"}, {"status": "not-a-status"}):
        response = _feed(client, **bad_filter)
        assert response.status_code == 422
        error = response.json()["error"]
        assert error["code"] == "validation_error"
        assert error["request_id"] == response.headers["X-Request-ID"]

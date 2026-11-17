"""Reference-link dry-run and apply tests (never copy weights)."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX


def _project(client, name="Link Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _shared(settings, name="shared_lora.safetensors"):
    source = settings.studio_root / "Pipeline" / "Loras" / name
    source.parent.mkdir(parents=True, exist_ok=True)
    source.write_bytes(b"shared-weights")
    return source


def _request(source, target, prefer_marker=False):
    return {
        "links": [{"source": str(source), "target": target}],
        "prefer_marker": prefer_marker,
    }


def _plan(client, project_id, payload):
    return client.post(f"{PREFIX}/projects/{project_id}/links/plan", json=payload)


def _apply(client, project_id, payload):
    return client.post(f"{PREFIX}/projects/{project_id}/links/apply", json=payload)


# --- Dry run ----------------------------------------------------------------


def test_plan_is_side_effect_free(client, settings):
    project = _project(client)
    source = _shared(settings)
    payload = _request(source, "Resources/Loras/shared_lora.safetensors")

    response = _plan(client, project["id"], payload)
    assert response.status_code == 200
    plan = response.json()
    assert plan["actions"][0]["action"] == "symlink"
    assert plan["copied_bytes"] == 0
    root = settings.studio_root / "Projects" / "link_project"
    assert not (root / "Resources" / ".links.json").exists()
    assert not (root / "Resources" / "Loras" / "shared_lora.safetensors").exists()
    assert not (root / "Resources" / "Loras" / "shared_lora.safetensors.link.txt").exists()


def test_plan_missing_source_and_existing_target(client, settings):
    project = _project(client)
    source = _shared(settings)
    root = settings.studio_root / "Projects" / "link_project" / "Resources"
    (root / "Taken").mkdir(parents=True)
    (root / "Taken" / "file.bin").write_bytes(b"keep")

    payload = {
        "links": [
            {"source": str(settings.studio_root / "Pipeline" / "missing.bin"), "target": "Resources/nope.bin"},
            {"source": str(source), "target": "Resources/Taken/file.bin"},
        ]
    }
    actions = _plan(client, project["id"], payload).json()["actions"]
    assert actions[0]["action"] == "skip"
    assert "does not exist" in actions[0]["reason"]
    assert actions[1]["action"] == "conflict"


# --- Apply ------------------------------------------------------------------


def test_apply_creates_reference_not_copy(client, settings):
    project = _project(client)
    source = _shared(settings)
    target = "Resources/Loras/shared_lora.safetensors"
    payload = _request(source, target)

    result = _apply(client, project["id"], payload)
    assert result.status_code == 200
    body = result.json()
    assert body["copied_bytes"] == 0
    assert body["performed"][0]["action"] == "symlink"

    link = settings.studio_root / "Projects" / "link_project" / target
    assert link.is_symlink()
    assert link.resolve() == source
    assert "shared-weights" not in [
        p.read_bytes() for p in (settings.studio_root / "Projects").rglob("*") if p.is_file() and not p.is_symlink()
    ]

    registry = client.get(f"{PREFIX}/projects/{project['id']}/links").json()
    assert registry[target] == source.as_posix()


def test_apply_is_idempotent(client, settings):
    project = _project(client)
    source = _shared(settings)
    payload = _request(source, "Resources/Loras/shared_lora.safetensors")
    assert _apply(client, project["id"], payload).status_code == 200
    second = _apply(client, project["id"], payload).json()
    assert second["performed"][0]["action"] == "already_linked"


def test_marker_fallback(client, settings):
    project = _project(client)
    source = _shared(settings)
    target = "Resources/Loras/shared_lora.safetensors"
    payload = _request(source, target, prefer_marker=True)

    result = _apply(client, project["id"], payload)
    assert result.json()["performed"][0]["action"] == "link_file"
    base = settings.studio_root / "Projects" / "link_project"
    marker = base / (target + ".link.txt")
    assert marker.is_file()
    assert marker.read_text().strip() == source.as_posix()
    assert not (base / target).exists()  # no target file created


def test_apply_conflict_rejected(client, settings):
    project = _project(client)
    source = _shared(settings)
    root = settings.studio_root / "Projects" / "link_project" / "Resources" / "Occupied"
    root.mkdir(parents=True)
    (root / "file.bin").write_bytes(b"existing")
    response = _apply(client, project["id"], _request(source, "Resources/Occupied/file.bin"))
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "link_target_exists"


def test_invalid_target_rejected(client, settings):
    project = _project(client)
    source = _shared(settings)
    for target in ("../escape.bin", "/absolute.bin"):
        response = _plan(client, project["id"], _request(source, target))
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "invalid_link_target"


def test_links_missing_project(client):
    unknown = str(uuid4())
    assert _plan(client, unknown, {"links": []}).status_code == 404
    assert _apply(client, unknown, {"links": []}).status_code == 404
    assert client.get(f"{PREFIX}/projects/{unknown}/links").status_code == 404

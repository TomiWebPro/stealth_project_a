"""Project folder-tree helper and endpoint tests."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX
from app.tree import (
    KINDS,
    normalize_kind,
    project_template_dirs,
    published_name,
    sanitize_name,
    shot_token,
    studio_template_dirs,
    version_folder,
)


def _project(client, name="Campaign One"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


# --- Pure helpers -----------------------------------------------------------


def test_sanitize_name():
    assert sanitize_name("Campaign One!") == "campaign_one"
    assert sanitize_name("  Spaces  ") == "spaces"
    assert sanitize_name("***") == "unnamed"
    assert sanitize_name("Mixed_CASE-42") == "mixed_case_42"


def test_normalize_kind():
    assert normalize_kind("character") == "Char"
    assert normalize_kind("env") == "Env"
    assert normalize_kind("prop") == "Prop"
    assert normalize_kind("Vehicle") == "Vehicle"


def test_version_and_shot_tokens():
    assert version_folder(1) == "Ver_001"
    assert version_folder(12) == "Ver_012"
    assert shot_token("s01", "c01") == "s01_c01"
    assert published_name("hero.png", 3) == "hero_v003.png"
    assert published_name("hero", 3) == "hero_v003"


def test_template_lists():
    project_dirs = project_template_dirs()
    assert f"Assets/Char/Asset_Name/Ver_001/Dataset/Output" in project_dirs
    assert f"Assets/Env/Asset_Name/Ver_001/Workflows/Edit" in project_dirs
    assert "Resources/Loras" in project_dirs
    assert "Shots/Seq_shot/Ver_001/Compose/Publish" in project_dirs
    studio_dirs = studio_template_dirs()
    assert "Projects/Default" in studio_dirs
    assert "Pipeline/Workflows/Image/Composition" in studio_dirs
    assert "Pipeline/Workflows/Video/Upscale" in studio_dirs
    assert len(KINDS) == 3


# --- Endpoints --------------------------------------------------------------


def test_materialize_and_verify_tree(client, settings):
    project = _project(client)
    response = client.post(f"{PREFIX}/projects/{project['id']}/tree")
    assert response.status_code == 201
    info = response.json()
    assert info["folder"] == "campaign_one"
    assert info["exists"] is True
    assert info["missing"] == []
    assert info["directory_count"] == len(project_template_dirs())
    assert info["manifest"]["schema"] == "studio-project/1"
    assert info["manifest"]["project_id"] == project["id"]

    root = settings.studio_root / "Projects" / "campaign_one"
    assert (
        root / "Assets" / "Char" / "Asset_Name" / "Ver_001" / "Dataset" / "Publish"
    ).is_dir()
    assert (root / "Shots" / "Seq_shot" / "Ver_001" / "Compose" / "Output").is_dir()
    assert (root / "project.json").is_file()
    assert (settings.studio_root / "Projects" / "Default").is_dir()
    # Template is directories only — no stray files.
    assert list((settings.studio_root / "Projects" / "Default").rglob("*.*")) == []

    verified = client.get(f"{PREFIX}/projects/{project['id']}/tree")
    assert verified.status_code == 200
    assert verified.json()["missing"] == []


def test_materialize_is_idempotent(client):
    project = _project(client, "Repeatable")
    first = client.post(f"{PREFIX}/projects/{project['id']}/tree").json()
    second = client.post(f"{PREFIX}/projects/{project['id']}/tree").json()
    assert first == second


def test_verify_before_materialize(client):
    project = _project(client, "Not Made")
    response = client.get(f"{PREFIX}/projects/{project['id']}/tree")
    assert response.status_code == 200
    info = response.json()
    assert info["exists"] is False
    assert info["missing"]  # all expected dirs reported missing
    assert info["directory_count"] == 0


def test_tree_missing_project(client):
    unknown = str(uuid4())
    assert client.post(f"{PREFIX}/projects/{unknown}/tree").status_code == 404
    assert client.get(f"{PREFIX}/projects/{unknown}/tree").status_code == 404

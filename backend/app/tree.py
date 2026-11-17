"""Local project-folder tree conventions (docs/PROJECT_FOLDERS.md).

Pure helpers plus a small filesystem service. The backend registry remains
authoritative; this module only materializes and verifies the canonical local
layout. Every path is built with :mod:`pathlib` for cross-platform correctness.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from uuid import UUID

KINDS = ("Char", "Env", "Prop")
WORKFLOW_IMAGE = ("Composition", "Dataset", "Design", "Edit")
WORKFLOW_VIDEO = ("Edit", "Gen", "Upscale")
ASSET_VERSION_GROUPS = ("Dataset", "Design", "Loras")
SHOT_VERSION_GROUPS = ("Compose", "Dataset", "Loras")
MANIFEST_SCHEMA = "studio-project/1"
TEMPLATE_VERSION = "1.0.0"

_KIND_ALIASES = {
    "character": "Char",
    "environment": "Env",
    "prop": "Prop",
    "char": "Char",
    "env": "Env",
}
_SAFE = re.compile(r"[^a-z0-9]+")


def sanitize_name(name: str) -> str:
    """Folder-safe token: lowercase ``[a-z0-9_]``; other chars become ``_``."""
    cleaned = _SAFE.sub("_", name.strip().lower()).strip("_")
    return cleaned or "unnamed"


def normalize_kind(kind: str) -> str:
    """Accept legacy spellings, otherwise keep the canonical case."""
    alias = _KIND_ALIASES.get(kind.strip().lower())
    if alias:
        return alias
    for canonical in KINDS:
        if kind.strip().lower() == canonical.lower():
            return canonical
    # Unknown kinds are allowed but must be folder-safe (keep given case).
    return re.sub(r"[^A-Za-z0-9_]", "_", kind.strip()) or "Asset"


def shot_token(sequence: str, shot: str) -> str:
    return f"{sanitize_name(sequence)}_{sanitize_name(shot)}"


def version_folder(version: int) -> str:
    if version < 1:
        raise ValueError("version must be >= 1")
    return f"Ver_{version:03d}"


def published_name(name: str, version: int) -> str:
    """``hero_v003.png`` style suffix, inserted before the final extension."""
    stem, dot, suffix = name.rpartition(".")
    if not dot:
        stem, suffix = name, ""
    base = f"{stem}_v{version:03d}"
    return f"{base}.{suffix}" if suffix else base


def parse_version_folder(name: str) -> int | None:
    """``Ver_007`` -> 7; anything else -> ``None``."""
    match = re.fullmatch(r"Ver_(\d{3,})", name)
    return int(match.group(1)) if match else None


def parse_published_version(name: str) -> int | None:
    """Read the ``_vNNN`` suffix from a published file name."""
    match = re.search(r"_v(\d{3,})(?:\.|$)", name)
    return int(match.group(1)) if match else None


def _workflow_dirs(parent: str, kinds) -> list[str]:
    return [f"{parent}/{workflow}" for workflow in kinds]


def project_template_dirs() -> list[str]:
    """Directory suffixes under a project root (template + generated projects)."""
    dirs: list[str] = []
    for kind in KINDS:
        version = f"Assets/{kind}/Asset_Name/{version_folder(1)}"
        for group in ASSET_VERSION_GROUPS:
            dirs.extend([f"{version}/{group}/Output", f"{version}/{group}/Publish"])
        dirs.extend(_workflow_dirs(f"{version}/Workflows", ("Dataset", "Design", "Edit")))
    dirs.extend(
        [
            "Resources/Loras",
            "Resources/Scripts",
            *_workflow_dirs("Resources/Workflows/Image", WORKFLOW_IMAGE),
            *_workflow_dirs("Resources/Workflows/Video", WORKFLOW_VIDEO),
        ]
    )
    shot = f"Shots/Seq_shot/{version_folder(1)}"
    for group in SHOT_VERSION_GROUPS:
        dirs.extend([f"{shot}/{group}/Output", f"{shot}/{group}/Publish"])
    dirs.extend(_workflow_dirs(f"{shot}/Workflows", ("Composition", "Dataset", "Edit")))
    return dirs


def studio_template_dirs() -> list[str]:
    """Directories under the studio root, including the empty Default template."""
    dirs = [
        "Pipeline/Loras",
        "Pipeline/Scripts",
        *_workflow_dirs("Pipeline/Workflows/Image", WORKFLOW_IMAGE),
        *_workflow_dirs("Pipeline/Workflows/Video", WORKFLOW_VIDEO),
    ]
    template_root = "Projects/Default"
    dirs.append(template_root)
    dirs.extend(f"{template_root}/{suffix}" for suffix in project_template_dirs())
    return dirs


class ProjectTree:
    """Materialize and verify the local tree under ``root``."""

    def __init__(self, root: Path) -> None:
        self.root = Path(root)

    def ensure_studio(self) -> None:
        for relative in studio_template_dirs():
            (self.root / relative).mkdir(parents=True, exist_ok=True)

    def project_root(self, folder: str) -> Path:
        return self.root / "Projects" / folder

    def create_project(self, project_id: UUID, name: str) -> dict:
        """Copy the (directory-only) template and write ``project.json``."""
        self.ensure_studio()
        folder = sanitize_name(name)
        destination = self.project_root(folder)
        for suffix in project_template_dirs():
            (destination / suffix).mkdir(parents=True, exist_ok=True)
        manifest = {
            "schema": MANIFEST_SCHEMA,
            "project_id": str(project_id),
            "name": name,
            "folder": folder,
            "template_version": TEMPLATE_VERSION,
        }
        (destination / "project.json").write_text(
            json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        return self.verify(project_id, name)

    def verify(self, project_id: UUID, name: str) -> dict:
        folder = sanitize_name(name)
        destination = self.project_root(folder)
        missing = [
            suffix
            for suffix in project_template_dirs()
            if not (destination / suffix).is_dir()
        ]
        manifest_path = destination / "project.json"
        manifest: dict | None = None
        if manifest_path.is_file():
            try:
                loaded = json.loads(manifest_path.read_text(encoding="utf-8"))
                manifest = loaded if isinstance(loaded, dict) else None
            except (ValueError, OSError):  # pragma: no cover - corrupt file
                manifest = None
        return {
            "project_id": str(project_id),
            "folder": folder,
            "root": str(destination),
            "exists": destination.is_dir(),
            "missing": missing,
            "manifest": manifest,
            "directory_count": len(project_template_dirs()) - len(missing),
        }


__all__ = [
    "KINDS",
    "MANIFEST_SCHEMA",
    "TEMPLATE_VERSION",
    "ProjectTree",
    "normalize_kind",
    "parse_published_version",
    "parse_version_folder",
    "project_template_dirs",
    "published_name",
    "sanitize_name",
    "shot_token",
    "studio_template_dirs",
    "version_folder",
]

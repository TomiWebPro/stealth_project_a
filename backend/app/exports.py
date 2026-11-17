"""Authoritative engine export paths for published assets.

Mirrors the frontend's provisional convention (``Content/Studio/<project>/...``
for Unreal, ``//exports/<project>/...`` for Blender) so the UI can replace its
local helper with this endpoint without changing any path strings. The backend
additionally reports whether the published bytes are present on disk.
"""

from __future__ import annotations

import re
from uuid import UUID

from .errors import NotFoundError
from .repositories.assets import AssetRepository
from .repositories.projects import ProjectRepository
from .tree import ProjectTree

TARGET_LABEL = {"unreal": "Unreal Engine", "blender": "Blender"}
_UNREAL_READY = {"video", "image", "splat"}
_BLENDER_READY = {"image", "splat", "scene"}


def slug(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9_]+", "_", value.strip().lower()).strip("_")
    return cleaned or "asset"


def basename(key: str) -> str:
    segment = key.rsplit("/", 1)[-1]
    segment = re.sub(r"\.[^.]+$", "", segment)
    return re.sub(r"_v\d+$", "", segment, flags=re.IGNORECASE)


class ExportService:
    def __init__(
        self,
        assets: AssetRepository,
        projects: ProjectRepository,
        tree: ProjectTree,
    ) -> None:
        self.assets = assets
        self.projects = projects
        self.tree = tree

    def _rows(self, project_id: UUID) -> list[dict]:
        project = self.projects.get_or_raise(project_id)
        project_slug = slug(project.name)
        rows: list[dict] = []
        for asset in self.assets.list(project_id=project_id, limit=1_000_000):
            if "/Publish/" not in asset.storage.key:
                continue
            name = slug(basename(asset.storage.key))
            type_folder = (
                "Video" if asset.type == "video" else "Splat" if asset.type == "splat" else "Image"
            )
            version = asset.version
            source_path = self.tree.root / asset.storage.key
            rows.append(
                {
                    "asset_id": str(asset.id),
                    "asset_name": asset.name,
                    "asset_type": asset.type,
                    "source_key": asset.storage.key,
                    "targets": [
                        {
                            "target": "unreal",
                            "label": TARGET_LABEL["unreal"],
                            "path": f"Content/Studio/{project_slug}/{type_folder}/{name}_v{version}",
                            "ready": asset.type in _UNREAL_READY,
                            "source_exists": source_path.is_file(),
                        },
                        {
                            "target": "blender",
                            "label": TARGET_LABEL["blender"],
                            "path": f"//exports/{project_slug}/{type_folder}/{name}_v{version}",
                            "ready": asset.type in _BLENDER_READY,
                            "source_exists": source_path.is_file(),
                        },
                    ],
                }
            )
        rows.sort(key=lambda row: row["asset_id"])
        return rows

    def project_exports(self, project_id: UUID) -> list[dict]:
        return self._rows(project_id)

    def asset_exports(self, asset_id: UUID) -> list[dict]:
        asset = self.assets.get(asset_id)
        if asset is None:
            raise NotFoundError("Asset", str(asset_id))
        return [row for row in self._rows(asset.project_id) if row["asset_id"] == str(asset_id)]


__all__ = ["ExportService", "basename", "slug"]

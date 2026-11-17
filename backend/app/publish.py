"""Publish ceremony: immutable ``Publish/`` copies + receipt sidecars.

The project tree (P3.1) provides the directory layout; this service maps an
``AssetVersion`` to a ``Ver_NNN`` folder, copies the working bytes into
``Publish/`` with a ``_vNNN`` suffix, and writes a JSON receipt next to the copy.
Re-publishing the identical bytes is idempotent; different bytes for the same
version are rejected so published deliverables stay immutable.
"""

from __future__ import annotations

import hashlib
import json
import shutil
from datetime import datetime
from pathlib import Path
from uuid import UUID

from .errors import ConflictError, InvalidRequestError, NotFoundError
from .repositories.assets import AssetRepository
from .repositories.projects import ProjectRepository
from .schemas.asset import AssetUpdate
from .tree import ProjectTree, normalize_kind, published_name, sanitize_name, version_folder

RECEIPT_SUFFIX = ".publish.json"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class PublishService:
    def __init__(
        self,
        assets: AssetRepository,
        projects: ProjectRepository,
        tree: ProjectTree,
        upload_dir: Path,
    ) -> None:
        self.assets = assets
        self.projects = projects
        self.tree = tree
        self.upload_dir = Path(upload_dir)

    def _source_path(self, key: str) -> Path:
        relative = Path(key)
        if relative.is_absolute() or ".." in relative.parts:
            raise InvalidRequestError(
                "Asset storage key is not a local project-relative path.",
                code="publish_source_missing",
            )
        source = (self.upload_dir / relative).resolve()
        if self.upload_dir.resolve() not in source.parents:
            raise InvalidRequestError(
                "Asset storage key escapes the upload directory.",
                code="publish_source_missing",
            )
        if not source.is_file():
            raise InvalidRequestError(
                f"Source bytes for '{key}' are not available on this backend.",
                code="publish_source_missing",
                details=[("key", "no local file for this asset")],
            )
        return source

    def publish(
        self,
        asset_id: UUID,
        *,
        comment: str,
        user_id: UUID,
        thumbnail: str | None = None,
    ) -> dict:
        asset = self.assets.get_or_raise(asset_id)
        if asset.status == "deleted":
            raise InvalidRequestError(
                f"Asset '{asset_id}' is deleted and cannot be published.",
                code="asset_deleted",
            )
        project = self.projects.get_or_raise(asset.project_id)
        source = self._source_path(asset.storage.key)

        version = version_folder(asset.version)
        kind = normalize_kind(str(asset.metadata.get("lora_slot", "Char")))
        destination_dir = (
            self.tree.project_root(sanitize_name(project.name))
            / "Assets"
            / kind
            / sanitize_name(asset.name)
            / version
            / "Dataset"
            / "Publish"
        )
        destination_dir.mkdir(parents=True, exist_ok=True)
        destination = destination_dir / published_name(source.name, asset.version)
        receipt_path = Path(str(destination) + RECEIPT_SUFFIX)

        checksum = _sha256(source)
        if destination.is_file():
            existing = dict(asset.metadata.get("publish_receipt") or {})
            if _sha256(destination) == checksum and receipt_path.is_file():
                return existing  # idempotent replay
            raise ConflictError(
                f"Version {asset.version} is already published with different bytes.",
                code="publish_conflict",
            )

        shutil.copyfile(source, destination)
        now = datetime.now()
        receipt = {
            "asset_id": str(asset.id),
            "project_id": str(asset.project_id),
            "version": asset.version,
            "version_folder": version,
            "comment": comment,
            "thumbnail": thumbnail,
            "published_by": str(user_id),
            "published_at": now.isoformat(),
            "source_key": asset.storage.key,
            "published_path": destination.relative_to(self.tree.root).as_posix(),
            "checksum_sha256": checksum,
            "size_bytes": destination.stat().st_size,
        }
        receipt_path.write_text(
            json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        metadata = dict(asset.metadata)
        metadata["publish_receipt"] = receipt
        self.assets.update(asset.id, AssetUpdate(metadata=metadata))
        return receipt

    def receipt(self, asset_id: UUID) -> dict:
        asset = self.assets.get_or_raise(asset_id)
        receipt = asset.metadata.get("publish_receipt")
        if not isinstance(receipt, dict):
            raise NotFoundError("Publish receipt", str(asset_id))
        relative = receipt.get("published_path")
        if not isinstance(relative, str):
            raise NotFoundError("Publish receipt", str(asset_id))
        path = self.tree.root / relative
        if not path.is_file():
            raise NotFoundError("Publish receipt", str(asset_id))
        return receipt


__all__ = ["PublishService", "RECEIPT_SUFFIX"]

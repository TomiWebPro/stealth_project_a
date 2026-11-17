"""Reference links: relative symlinks with ``.link.txt`` fallback.

Shared weights are referenced, never copied. A plan is computed first (dry run,
no writes), then applied. The registry lives in ``Resources/.links.json`` as
``{project-relative target: absolute source}``; the ``.link.txt`` fallback marker
holds the absolute source path for platforms without symlink support.
"""

from __future__ import annotations

import json
from pathlib import Path
from uuid import UUID

from .errors import ConflictError, InvalidRequestError
from .tree import ProjectTree, sanitize_name

REGISTRY_NAME = ".links.json"


class ReferenceLinkService:
    def __init__(self, tree: ProjectTree) -> None:
        self.tree = tree

    def _roots(self, project_id: UUID, project_name: str) -> tuple[Path, Path]:
        root = self.tree.project_root(sanitize_name(project_name))
        return root, root / "Resources" / REGISTRY_NAME

    def _target(self, project_root: Path, target: str) -> Path:
        relative = Path(target)
        if relative.is_absolute() or ".." in relative.parts:
            raise InvalidRequestError(
                "Link target must be a project-relative path.",
                code="invalid_link_target",
                details=[("target", "no absolute paths or '..'")],
            )
        # Do NOT resolve symlinks here: an already-created link points outside
        # the project by design and must still be recognised as the same target.
        candidate = (project_root / relative).absolute()
        root = project_root.absolute()
        if candidate != root and root not in candidate.parents:
            raise InvalidRequestError(
                "Link target escapes the project root.",
                code="invalid_link_target",
            )
        return project_root / relative

    def _read_registry(self, registry_path: Path) -> dict[str, str]:
        if not registry_path.is_file():
            return {}
        try:
            loaded = json.loads(registry_path.read_text(encoding="utf-8"))
        except (ValueError, OSError):  # pragma: no cover - corrupt sidecar
            return {}
        return loaded if isinstance(loaded, dict) else {}

    def plan(
        self,
        project_id: UUID,
        project_name: str,
        links: list[dict],
        *,
        prefer_marker: bool = False,
    ) -> dict:
        """Dry run: describe actions without touching the filesystem."""
        project_root, _ = self._roots(project_id, project_name)
        actions: list[dict] = []
        for item in links:
            source_raw = item.get("source")
            target_raw = item.get("target")
            if not isinstance(source_raw, str) or not isinstance(target_raw, str):
                raise InvalidRequestError(
                    "Each link needs string 'source' and 'target'.",
                    code="invalid_link",
                )
            target = self._target(project_root, target_raw)
            source = Path(source_raw).expanduser().resolve()
            action = "link_file" if prefer_marker else "symlink"
            reason: str | None = None
            if not source.exists():
                action, reason = "skip", "source does not exist"
            elif target.is_symlink() and target.resolve() == source:
                action, reason = "already_linked", "target already references source"
            elif target.exists():
                action, reason = "conflict", "target already exists; refusing to overwrite"
            actions.append(
                {
                    "source": source.as_posix(),
                    "target": target_raw,
                    "action": action,
                    "reason": reason,
                }
            )
        return {
            "project_id": str(project_id),
            "root": str(project_root),
            "actions": actions,
            "copied_bytes": 0,  # references only; weights are never copied
        }

    def apply(
        self,
        project_id: UUID,
        project_name: str,
        links: list[dict],
        *,
        prefer_marker: bool = False,
    ) -> dict:
        """Execute a planned set of references and update ``.links.json``."""
        project_root, registry_path = self._roots(project_id, project_name)
        plan = self.plan(project_id, project_name, links, prefer_marker=prefer_marker)
        registry = self._read_registry(registry_path)
        performed: list[dict] = []

        for action in plan["actions"]:
            if action["action"] == "conflict":
                raise ConflictError(
                    f"Link target '{action['target']}' already exists.",
                    code="link_target_exists",
                )
            if action["action"] == "skip":
                performed.append(action)
                continue
            if action["action"] == "already_linked":
                performed.append(action)
                continue

            source = Path(action["source"])
            target = self._target(project_root, action["target"])
            target.parent.mkdir(parents=True, exist_ok=True)
            if action["action"] == "symlink":
                try:
                    target.symlink_to(source, target_is_directory=source.is_dir())
                except (OSError, NotImplementedError):
                    # Locked-down Windows: fall back to a marker file.
                    self._write_marker(target, source)
                    action = {**action, "action": "link_file", "reason": "symlink unavailable"}
            else:
                self._write_marker(target, source)
            registry[action["target"]] = source.as_posix()
            performed.append(action)

        registry_path.parent.mkdir(parents=True, exist_ok=True)
        registry_path.write_text(
            json.dumps(registry, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        return {
            "project_id": str(project_id),
            "root": str(project_root),
            "performed": performed,
            "registry": registry,
            "copied_bytes": 0,
        }

    def registry(self, project_id: UUID, project_name: str) -> dict:
        _, registry_path = self._roots(project_id, project_name)
        return self._read_registry(registry_path)

    @staticmethod
    def _write_marker(target: Path, source: Path) -> None:
        Path(str(target) + ".link.txt").write_text(
            source.as_posix() + "\n", encoding="utf-8"
        )


__all__ = ["ReferenceLinkService", "REGISTRY_NAME"]

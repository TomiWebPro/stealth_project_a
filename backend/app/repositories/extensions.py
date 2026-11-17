"""Stub extension registry with install/enable/disable lifecycle.

The registry is seeded locally so contracts hold without an external marketplace.
Installation enforces the manifest's declared permissions: every required
permission must be explicitly accepted by the caller before an extension can be
installed. Isolation/permission *enforcement at runtime* is a later phase; this
layer gates installation and records the accepted set.
"""

from __future__ import annotations

from uuid import NAMESPACE_URL, UUID, uuid5

from ..errors import ConflictError, InvalidRequestError, NotFoundError
from ..schemas.common import utcnow
from ..schemas.provider import (
    Extension,
    ExtensionDependency,
    ExtensionInstallRequest,
    ExtensionInstallResult,
    ExtensionManifest,
    ExtensionPermission,
    ExtensionRequirements,
)
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository

_SEED_MANIFESTS: list[tuple[ExtensionManifest, bool, bool]] = [
    (
        ExtensionManifest(
            id="com.studio.comfyui-bridge",
            name="ComfyUI Bridge",
            version="1.2.0",
            publisher="Studio Platform",
            type="provider",
            requirements=ExtensionRequirements(
                app_versions=">=0.2.0",
                permissions=[
                    ExtensionPermission(
                        name="provider.access",
                        description="Connect to a local ComfyUI runtime.",
                    )
                ],
                provider_ids=["local-comfyui"],
                runtime="local",
            ),
            dependencies=[],
            ui_contributions=["provider:local-comfyui"],
        ),
        True,
        True,
    ),
    (
        ExtensionManifest(
            id="com.studio.blender-export",
            name="Blender Export",
            version="0.9.1",
            publisher="Studio Platform",
            type="capability",
            requirements=ExtensionRequirements(
                app_versions=">=0.2.0",
                permissions=[
                    ExtensionPermission(name="assets.read"),
                    ExtensionPermission(name="storage.write"),
                ],
                capabilities=["export-blend"],
            ),
            dependencies=[
                ExtensionDependency(
                    extension_id="com.studio.comfyui-bridge", version_range=">=1.0.0"
                )
            ],
            ui_contributions=["export:blender"],
        ),
        True,
        True,
    ),
    (
        ExtensionManifest(
            id="com.studio.splat-viewer",
            name="Splat Viewer",
            version="1.0.0",
            publisher="Community",
            type="ui",
            requirements=ExtensionRequirements(
                app_versions=">=0.2.0",
                permissions=[ExtensionPermission(name="assets.read")],
                capabilities=["splat-preview"],
            ),
            ui_contributions=["viewer:splat"],
        ),
        False,
        False,
    ),
]


def _extension_id(manifest_id: str) -> UUID:
    return uuid5(NAMESPACE_URL, f"studio-extension:{manifest_id}")


class ExtensionRepository(BaseRepository):
    def __init__(self, store: DocumentStore, clock=utcnow) -> None:
        super().__init__(store, clock)
        self._signed = {manifest.id: signed for manifest, signed, _ in _SEED_MANIFESTS}
        self._verified = {
            manifest.id: verified for manifest, _, verified in _SEED_MANIFESTS
        }
        self._seed()

    def _seed(self) -> None:
        for manifest, _, _ in _SEED_MANIFESTS:
            self.store.put(
                Collections.EXTENSION_REGISTRY,
                manifest.id,
                manifest.model_dump(mode="json"),
            )

    # --- Registry -----------------------------------------------------------

    def list_registry(self) -> list[ExtensionManifest]:
        manifests = self._load_all(Collections.EXTENSION_REGISTRY, ExtensionManifest)
        manifests.sort(key=lambda manifest: manifest.id)
        return manifests

    def _manifest(self, extension_id: str) -> ExtensionManifest | None:
        return self._load(
            Collections.EXTENSION_REGISTRY, extension_id, ExtensionManifest
        )

    # --- Installed ----------------------------------------------------------

    def get(self, extension_id: UUID) -> Extension | None:
        return self._load(Collections.EXTENSIONS, str(extension_id), Extension)

    def get_or_raise(self, extension_id: UUID) -> Extension:
        extension = self.get(extension_id)
        if extension is None:
            raise NotFoundError("Extension", str(extension_id))
        return extension

    def list_installed(self) -> list[Extension]:
        extensions = self._load_all(Collections.EXTENSIONS, Extension)
        extensions.sort(key=lambda extension: extension.manifest.id)
        return extensions

    def install(self, payload: ExtensionInstallRequest) -> ExtensionInstallResult:
        manifest = self._manifest(payload.extension_id)
        if manifest is None:
            raise NotFoundError("Extension", payload.extension_id)
        if payload.version is not None and payload.version != manifest.version:
            raise InvalidRequestError(
                f"Extension '{payload.extension_id}' has no version '{payload.version}'.",
                code="version_not_found",
                details=[("version", f"available: {manifest.version}")],
            )

        extension_id = _extension_id(manifest.id)
        if self.get(extension_id) is not None:
            raise ConflictError(
                f"Extension '{manifest.id}' is already installed.",
                code="already_installed",
            )

        required = {
            permission.name for permission in manifest.requirements.permissions
        }
        missing = sorted(required - set(payload.accepted_permissions))
        if missing:
            raise InvalidRequestError(
                "The extension requires permissions that were not accepted.",
                code="permissions_not_accepted",
                details=[("accepted_permissions", f"missing: {', '.join(missing)}")],
            )

        extension = Extension(
            manifest=manifest,
            status="installed",
            installed_at=self.clock(),
            signed=self._signed.get(manifest.id, False),
            verified=self._verified.get(manifest.id, False),
        )
        self._save(Collections.EXTENSIONS, str(extension_id), extension)
        return ExtensionInstallResult(
            extension_id=extension_id,
            status=extension.status,
            manifest=manifest,
        )

    def set_status(self, extension_id: UUID, status: str) -> Extension:
        """Transition an installed extension to ``enabled`` or ``disabled``."""
        extension = self.get_or_raise(extension_id)
        if status not in {"enabled", "disabled"}:  # pragma: no cover - internal guard
            raise InvalidRequestError(f"Unknown extension status '{status}'.", code="invalid_request")
        if extension.status == status:
            return extension  # idempotent
        document = extension.model_dump(mode="json")
        document["status"] = status
        updated = Extension.model_validate(document)
        self._save(Collections.EXTENSIONS, str(extension_id), updated)
        return updated

    def uninstall(self, extension_id: UUID) -> None:
        self.get_or_raise(extension_id)
        self.store.delete(Collections.EXTENSIONS, str(extension_id))


__all__ = ["ExtensionRepository"]

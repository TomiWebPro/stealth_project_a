"""Authoritative single-extension overview repository.

The snapshot is derived fresh from the authoritative installed-extension store on
every call, like the other overview repositories: there is no second index to
drift and removing the router leaves no collection behind. Declared permission
names, capabilities, provider ids, UI contributions and dependency ids are sorted
and deduplicated so the wire shape is byte-for-byte identical regardless of how a
manifest ordered them, and each ``counts`` total equals the emitted list length.

An unknown extension uses ``ExtensionRepository.get_or_raise``'s shared 404
``extension_not_found`` envelope.

Mirrors ``frontend/src/types/extensionOverview.ts`` contracts.
"""

from __future__ import annotations

from ..schemas.common import utcnow
from ..schemas.extension_overview import ExtensionOverview, ExtensionOverviewCounts
from ..storage.base import DocumentStore
from .base import BaseRepository
from .extensions import ExtensionRepository


def _unique_sorted(values) -> list[str]:
    """Sorted, de-duplicated projection, independent of declaration order."""
    return sorted(set(values))


class ExtensionOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        extensions: ExtensionRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.extensions = extensions

    def overview(self, extension_id) -> ExtensionOverview:
        """Build a fresh snapshot for one installed extension."""
        extension = self.extensions.get_or_raise(extension_id)
        manifest = extension.manifest
        requirements = manifest.requirements

        permissions = _unique_sorted(p.name for p in requirements.permissions)
        capabilities = _unique_sorted(requirements.capabilities)
        provider_ids = _unique_sorted(requirements.provider_ids)
        ui_contributions = _unique_sorted(manifest.ui_contributions)
        dependencies = _unique_sorted(dep.extension_id for dep in manifest.dependencies)

        counts = ExtensionOverviewCounts(
            permissions=len(permissions),
            capabilities=len(capabilities),
            provider_ids=len(provider_ids),
            ui_contributions=len(ui_contributions),
            dependencies=len(dependencies),
        )

        return ExtensionOverview(
            extension_id=extension_id,
            manifest_id=manifest.id,
            name=manifest.name,
            version=manifest.version,
            publisher=manifest.publisher,
            type=manifest.type,
            status=extension.status,
            installed_at=extension.installed_at,
            runtime=requirements.runtime,
            app_versions=requirements.app_versions,
            signed=extension.signed,
            verified=extension.verified,
            permissions=permissions,
            capabilities=capabilities,
            provider_ids=provider_ids,
            ui_contributions=ui_contributions,
            dependencies=dependencies,
            counts=counts,
            generated_at=self.clock(),
        )


__all__ = ["ExtensionOverviewRepository"]

"""Authoritative single-provider overview repository.

The snapshot is derived fresh from the authoritative provider store and the
static versioned operation catalog on every call, like the other overview
repositories: there is no second index to drift and removing the router leaves
no collection behind. Advertised operations and their schema versions are
sorted and deduplicated so the wire shape is byte-for-byte identical regardless
of how a future registry adapter orders capabilities.

An unknown provider uses ``ProviderRepository.get_or_raise``'s shared 404
``provider_not_found`` envelope.

Mirrors ``frontend/src/types/providerOverview.ts`` contracts.
"""

from __future__ import annotations

from ..catalog import OPERATION_CATALOG
from ..schemas.common import utcnow
from ..schemas.provider_overview import (
    ProviderOverview,
    ProviderOverviewCounts,
    ProviderOverviewOperation,
)
from ..storage.base import DocumentStore
from .base import BaseRepository
from .providers import ProviderRepository


class ProviderOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        providers: ProviderRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.providers = providers

    def overview(self, provider_id: str) -> ProviderOverview:
        """Build a fresh snapshot for one provider."""
        provider = self.providers.get_or_raise(provider_id)

        # Advertised operation -> sorted, deduplicated schema versions.
        versions_by_operation: dict[str, list[str]] = {}
        all_versions: set[str] = set()
        for capability in provider.capabilities:
            versions = versions_by_operation.setdefault(capability.operation_id, [])
            for version in capability.schema_versions:
                if version not in versions:
                    versions.append(version)
                all_versions.add(version)
        # Re-sort after merging capabilities of the same operation so the wire
        # order is independent of how the registry ordered them.
        for versions in versions_by_operation.values():
            versions.sort()
        operation_ids = sorted(versions_by_operation)

        catalog_by_id = {spec.id: spec for spec in OPERATION_CATALOG.operations}
        catalog_operations: list[ProviderOverviewOperation] = []
        for operation_id in operation_ids:
            spec = catalog_by_id.get(operation_id)
            if spec is None:
                continue
            advertised = versions_by_operation[operation_id]
            catalog_operations.append(
                ProviderOverviewOperation(
                    operation_id=operation_id,
                    title=spec.title,
                    catalog_version=spec.schema_version,
                    advertised_versions=advertised,
                    schema_match=spec.schema_version in advertised,
                )
            )

        counts = ProviderOverviewCounts(
            capabilities=len(provider.capabilities),
            advertised_operations=len(operation_ids),
            catalog_operations=len(catalog_operations),
            schema_versions=len(all_versions),
        )

        return ProviderOverview(
            provider_id=provider.id,
            name=provider.name,
            location=provider.location,
            status=provider.status,
            metadata=provider.metadata,
            operation_ids=operation_ids,
            catalog_operations=catalog_operations,
            counts=counts,
            generated_at=self.clock(),
        )


__all__ = ["ProviderOverviewRepository"]

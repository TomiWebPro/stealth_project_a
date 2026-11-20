"""Authoritative single-capability overview repository.

The snapshot is derived fresh from the same authoritative provider store and
versioned operation catalog that back ``/capabilities`` and ``/providers`` on
every call: there is no second index to drift and removing the router leaves no
collection behind. Each provider contributes at most one row, with its
advertised schema versions sorted and deduplicated so the wire shape is
byte-for-byte identical regardless of how a future registry adapter orders
capabilities.

A capability is known when it is in the catalog or at least one provider
advertises it. Anything else raises ``NotFoundError`` for the shared 404
``capability_not_found`` envelope.

Mirrors ``frontend/src/types/capabilityOverview.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter

from ..catalog import get_operation_spec
from ..errors import NotFoundError
from ..schemas.capability_overview import (
    CapabilityOverview,
    CapabilityOverviewCounts,
    CapabilityProvider,
)
from ..schemas.common import utcnow
from ..storage.base import DocumentStore
from .base import BaseRepository
from .providers import ProviderRepository


class CapabilityOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        providers: ProviderRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.providers = providers

    def overview(self, operation_id: str) -> CapabilityOverview:
        """Build a fresh snapshot for one capability (catalog operation id)."""
        spec = get_operation_spec(operation_id)

        capability_providers: list[CapabilityProvider] = []
        for provider in self.providers.list():
            versions: list[str] = []
            advertises = False
            for capability in provider.capabilities:
                if capability.operation_id != operation_id:
                    continue
                advertises = True
                for version in capability.schema_versions:
                    if version not in versions:
                        versions.append(version)
            if not advertises:
                continue
            versions.sort()
            capability_providers.append(
                CapabilityProvider(
                    provider_id=provider.id,
                    name=provider.name,
                    location=provider.location,
                    status=provider.status,
                    schema_versions=versions,
                    schema_match=bool(spec and spec.schema_version in versions),
                )
            )
        capability_providers.sort(key=lambda item: item.provider_id)

        if spec is None and not capability_providers:
            raise NotFoundError("capability", operation_id, code="capability_not_found")

        status_counts = Counter(item.status for item in capability_providers)
        locations = {item.location for item in capability_providers}
        all_versions = {version for item in capability_providers for version in item.schema_versions}
        counts = CapabilityOverviewCounts(
            total_providers=len(capability_providers),
            available=status_counts.get("available", 0),
            degraded=status_counts.get("degraded", 0),
            unavailable=status_counts.get("unavailable", 0),
            locations=len(locations),
            schema_versions=len(all_versions),
        )

        return CapabilityOverview(
            operation_id=operation_id,
            in_catalog=spec is not None,
            catalog_title=spec.title if spec else None,
            catalog_version=spec.schema_version if spec else None,
            providers=capability_providers,
            counts=counts,
            generated_at=self.clock(),
        )


__all__ = ["CapabilityOverviewRepository"]

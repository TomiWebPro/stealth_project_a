"""Authoritative single-operation overview repository.

The snapshot is derived fresh from the versioned ``OPERATION_CATALOG`` (the same
registry ``JobRepository.submit`` validates against) and the authoritative
provider store on every call. There is no second index to drift and removing the
router leaves no collection behind.

Declared catalog provider bindings and the providers actually advertising the
operation are projected side by side so their drift is visible. Advertised
schema versions and both provider lists are sorted and deduplicated so the wire
shape is byte-for-byte identical across storage backends and independent of how
a future registry adapter orders capabilities.

An unknown operation uses the shared 404 ``operation_not_found`` envelope.

Mirrors ``frontend/src/types/operationOverview.ts`` contracts.
"""

from __future__ import annotations

from ..catalog import get_operation_spec
from ..errors import NotFoundError
from ..schemas.common import utcnow
from ..schemas.operation_overview import (
    OperationOverview,
    OperationOverviewCounts,
    OperationProviderBinding,
)
from ..storage.base import DocumentStore
from .base import BaseRepository
from .providers import ProviderRepository


class OperationOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        providers: ProviderRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.providers = providers

    def overview(self, operation_id: str) -> OperationOverview:
        """Build a fresh snapshot for one catalog operation."""
        spec = get_operation_spec(operation_id)
        if spec is None:
            raise NotFoundError("Operation", operation_id)

        # Providers actually advertising this operation -> sorted, deduplicated
        # schema versions (a provider may declare the operation more than once).
        bindings: list[OperationProviderBinding] = []
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
            bindings.append(
                OperationProviderBinding(
                    provider_id=provider.id,
                    name=provider.name,
                    location=provider.location,
                    status=provider.status,
                    advertised_versions=versions,
                    schema_match=spec.schema_version in versions,
                )
            )
        bindings.sort(key=lambda binding: binding.provider_id)

        provider_ids = sorted(set(spec.provider_ids))
        setting_keys = sorted({setting.key for setting in spec.settings})
        counts = OperationOverviewCounts(
            settings=len(spec.settings),
            input_types=len(spec.input.asset_types),
            output_types=len(spec.output.asset_types),
            provider_bindings=len(bindings),
            matching_providers=sum(1 for binding in bindings if binding.schema_match),
        )

        return OperationOverview(
            operation_id=spec.id,
            title=spec.title,
            description=spec.description,
            schema_version=spec.schema_version,
            input_types=list(spec.input.asset_types),
            output_types=list(spec.output.asset_types),
            setting_keys=setting_keys,
            streaming=spec.streaming,
            provider_ids=provider_ids,
            provider_bindings=bindings,
            counts=counts,
            generated_at=self.clock(),
        )


__all__ = ["OperationOverviewRepository"]

"""Authoritative single-provider overview contracts.

The Providers UI needs a compact, single-provider snapshot: identity + health,
the operations it advertises and how those bind to the authoritative operation
catalog. Deriving it on the backend — where the provider registry and the
versioned operation catalog are authoritative — keeps every client reading the
same coverage numbers and avoids reproducing the join per screen.

Everything is computed fresh on every call from the authoritative provider store
and ``OPERATION_CATALOG``: there is no second index to drift and removing the
router leaves no collection behind. A catalog-backed operation carries the
provider's advertised schema versions next to the catalog version plus a
``schema_match`` flag, so the UI can surface capability drift without guessing.
Mirrors ``frontend/src/types/providerOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from pydantic import Field

from .common import ContractModel, Metadata, NonEmptyStr, SemVer, Timestamp
from .provider import ProviderLocation, ProviderStatus


class ProviderOverviewOperation(ContractModel):
    """A catalog-backed operation advertised by this provider."""

    operation_id: NonEmptyStr
    title: NonEmptyStr
    catalog_version: SemVer
    advertised_versions: list[SemVer] = Field(default_factory=list)
    schema_match: bool


class ProviderOverviewCounts(ContractModel):
    """Capability/coverage totals for one provider, derived authoritatively."""

    capabilities: int = Field(ge=0)
    advertised_operations: int = Field(ge=0)
    catalog_operations: int = Field(ge=0)
    schema_versions: int = Field(ge=0)


class ProviderOverview(ContractModel):
    """A single-provider snapshot: identity, coverage and catalog bindings.

    ``operation_ids`` is the sorted, deduplicated set of operations advertised
    through the provider's capabilities. ``catalog_operations`` narrows that set
    to operations that actually exist in the authoritative catalog (in the same
    deterministic order), and ``counts`` is never bounded by that projection.
    """

    provider_id: NonEmptyStr
    name: NonEmptyStr
    location: ProviderLocation
    status: ProviderStatus
    metadata: Metadata = Field(default_factory=dict)
    operation_ids: list[NonEmptyStr] = Field(default_factory=list)
    catalog_operations: list[ProviderOverviewOperation] = Field(default_factory=list)
    counts: ProviderOverviewCounts
    generated_at: Timestamp


__all__ = ["ProviderOverview", "ProviderOverviewCounts", "ProviderOverviewOperation"]

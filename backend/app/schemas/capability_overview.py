"""Authoritative single-capability overview contracts.

``GET /capabilities`` discovers providers by operation, and ``GET /providers``
lists each provider's capabilities, but neither offers a compact view of one
capability: which providers advertise a given operation, how their advertised
schema versions compare to the versioned operation catalog, and a zero-filled
health/location breakdown. This snapshot fills that gap.

Everything is computed fresh from the authoritative provider store and
``get_operation_spec`` on every call: there is no second index to drift and
removing the router leaves no collection behind. Each provider appears once with
sorted, deduplicated advertised versions; ``schema_match`` flags advertised-vs-
catalog drift (a capability absent from the catalog has no version to match).

Mirrors ``frontend/src/types/capabilityOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from pydantic import Field

from .common import ContractModel, NonEmptyStr, SemVer, Timestamp
from .provider import ProviderLocation, ProviderStatus


class CapabilityProvider(ContractModel):
    """One provider advertising the capability, with schema coverage."""

    provider_id: NonEmptyStr
    name: NonEmptyStr
    location: ProviderLocation
    status: ProviderStatus
    schema_versions: list[SemVer] = Field(default_factory=list)
    schema_match: bool


class CapabilityOverviewCounts(ContractModel):
    """Provider/health/location totals for one capability, derived authoritatively."""

    total_providers: int = Field(ge=0)
    available: int = Field(ge=0)
    degraded: int = Field(ge=0)
    unavailable: int = Field(ge=0)
    locations: int = Field(ge=0)
    schema_versions: int = Field(ge=0)


class CapabilityOverview(ContractModel):
    """A single-capability snapshot: catalog binding, providers and counts.

    ``providers`` is the sorted, deduplicated set of providers advertising the
    operation; ``counts`` describes that whole set and is never bounded. When the
    operation is not in the authoritative catalog, ``in_catalog`` is false and
    ``catalog_title``/``catalog_version`` are null.
    """

    operation_id: NonEmptyStr
    in_catalog: bool
    catalog_title: NonEmptyStr | None = None
    catalog_version: SemVer | None = None
    providers: list[CapabilityProvider] = Field(default_factory=list)
    counts: CapabilityOverviewCounts
    generated_at: Timestamp


__all__ = ["CapabilityOverview", "CapabilityOverviewCounts", "CapabilityProvider"]

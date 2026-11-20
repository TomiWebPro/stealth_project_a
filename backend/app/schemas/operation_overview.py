"""Authoritative single-operation overview contracts.

The Operations/Jobs UI needs a compact, single-operation snapshot: catalog
identity + settings/IO shape, the declared provider bindings and the *actual*
provider fleet advertising this operation with schema-drift flags. Deriving it
on the backend — where the versioned operation catalog and the provider registry
are authoritative — keeps every client reading the same coverage numbers and
avoids reproducing the join per screen.

Everything is computed fresh from ``OPERATION_CATALOG`` and the authoritative
provider store on every call: there is no second index to drift and removing the
router leaves no collection behind. Advertised versions and provider bindings
are sorted and deduplicated so the wire shape is byte-for-byte identical across
storage backends and independent of how a future registry adapter orders its
capabilities.

Mirrors ``frontend/src/types/operationOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from pydantic import Field

from .common import ContractModel, NonEmptyStr, SemVer, Timestamp
from .provider import ProviderLocation, ProviderStatus


class OperationProviderBinding(ContractModel):
    """A provider advertising this operation, with schema-drift information."""

    provider_id: NonEmptyStr
    name: NonEmptyStr
    location: ProviderLocation
    status: ProviderStatus
    advertised_versions: list[SemVer] = Field(default_factory=list)
    schema_match: bool


class OperationOverviewCounts(ContractModel):
    """Shape/coverage totals for one operation, derived authoritatively."""

    settings: int = Field(ge=0)
    input_types: int = Field(ge=0)
    output_types: int = Field(ge=0)
    provider_bindings: int = Field(ge=0)
    matching_providers: int = Field(ge=0)


class OperationOverview(ContractModel):
    """A single-operation snapshot: catalog identity, shape and provider bindings.

    ``provider_ids`` is the sorted, deduplicated set declared by the catalog
    spec, while ``provider_bindings`` is derived from the provider fleet actually
    advertising the operation (both may differ — the snapshot surfaces that
    drift). ``counts`` describes the whole operation and is never bounded down.
    """

    operation_id: NonEmptyStr
    title: NonEmptyStr
    description: str | None = None
    schema_version: SemVer
    input_types: list[str] = Field(default_factory=list)
    output_types: list[str] = Field(default_factory=list)
    setting_keys: list[NonEmptyStr] = Field(default_factory=list)
    streaming: bool
    provider_ids: list[NonEmptyStr] = Field(default_factory=list)
    provider_bindings: list[OperationProviderBinding] = Field(default_factory=list)
    counts: OperationOverviewCounts
    generated_at: Timestamp


__all__ = [
    "OperationOverview",
    "OperationOverviewCounts",
    "OperationProviderBinding",
]

"""Authoritative provider fleet statistics contracts.

The Providers screen needs aggregate fleet metrics (health mix, runtime-location
mix, capability coverage) that agree with what ``GET /providers`` and
``GET /capabilities`` report. Deriving them on the backend — where the provider
registry is authoritative — keeps every client reading the same numbers and
avoids reproducing aggregation rules per screen.

Everything is computed fresh from the authoritative provider store on every
call: there is no second index to drift and removing the router leaves no
collection behind. ``by_status`` and ``by_location`` are zero-filled over the
canonical value orders so the wire shape is stable across storage backends;
``by_operation`` lists only operations actually advertised (sorted
deterministically). Optional ``location``/``status`` filters narrow the same
derivation to one fleet slice, matching the ``/capabilities`` filters.

Mirrored in ``frontend/src/types/providerStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from pydantic import Field

from .common import ContractModel, Timestamp
from .provider import ProviderLocation, ProviderStatus


class ProviderStatusCount(ContractModel):
    """Number of providers in one health status."""

    status: ProviderStatus
    count: int = Field(ge=0)


class ProviderLocationCount(ContractModel):
    """Number of providers at one runtime location."""

    location: ProviderLocation
    count: int = Field(ge=0)


class ProviderOperationStat(ContractModel):
    """How many providers advertise an operation, and how many are available."""

    operation_id: str
    providers: int = Field(ge=0)
    available: int = Field(ge=0)


class ProviderStats(ContractModel):
    """Fleet metrics derived from the authoritative provider store.

    ``by_status`` and ``by_location`` are zero-filled over every canonical
    status/location so a UI can read a bucket without guarding for a missing
    key. ``available``, ``degraded`` and ``unavailable`` are the same status
    totals surfaced as convenience scalars. ``total_capabilities`` sums every
    advertised capability; ``unique_operations`` is the count of distinct
    operation ids. ``by_operation`` is sorted by descending provider count then
    operation id for deterministic cross-backend ordering.
    """

    total: int = Field(ge=0)
    by_status: list[ProviderStatusCount] = Field(default_factory=list)
    by_location: list[ProviderLocationCount] = Field(default_factory=list)
    available: int = Field(ge=0)
    degraded: int = Field(ge=0)
    unavailable: int = Field(ge=0)
    total_capabilities: int = Field(ge=0)
    unique_operations: int = Field(ge=0)
    by_operation: list[ProviderOperationStat] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = [
    "ProviderLocationCount",
    "ProviderOperationStat",
    "ProviderStats",
    "ProviderStatusCount",
]

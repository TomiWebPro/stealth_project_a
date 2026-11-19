"""Authoritative operation catalog statistics contracts.

The operations catalog is the authoritative list of application-level creative
operations (``app.catalog.OPERATION_CATALOG``). Screens that browse operations
need aggregate metrics — catalog size, streaming/provider coverage, setting and
asset-type mix — that agree with what ``GET /operations`` and
``GET /operations/{id}`` report. Deriving them on the backend keeps every client
reading the same numbers and avoids reproducing aggregation rules per screen.

Everything is computed fresh from the authoritative catalog on every call: there
is no second index to drift. ``by_output_type``/``by_input_type`` list only the
asset-type strings actually declared by operations, sorted by descending count
then name for deterministic cross-backend ordering.

Mirrored in ``frontend/src/types/operationStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from pydantic import Field

from .common import ContractModel, Timestamp


class OperationTypeCount(ContractModel):
    """Number of catalog operations consuming/producing one asset-type string."""

    asset_type: str
    operations: int = Field(ge=0)


class OperationStats(ContractModel):
    """Catalog metrics derived from the authoritative operation catalog.

    ``streaming`` counts streaming operations; ``with_provider`` counts those
    with at least one provider binding and ``without_provider`` the rest.
    ``total_settings`` sums every declared user-facing setting.
    ``unique_output_types`` is the distinct output asset-type count. The
    ``by_output_type``/``by_input_type`` breakdowns count how many operations
    consume or produce each asset-type string.
    """

    total: int = Field(ge=0)
    streaming: int = Field(ge=0)
    with_provider: int = Field(ge=0)
    without_provider: int = Field(ge=0)
    total_settings: int = Field(ge=0)
    unique_output_types: int = Field(ge=0)
    by_output_type: list[OperationTypeCount] = Field(default_factory=list)
    by_input_type: list[OperationTypeCount] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = [
    "OperationStats",
    "OperationTypeCount",
]

"""Authoritative extension registry/installation statistics contracts.

The Extensions screen needs aggregate metrics (registry type mix, installation
status mix, trust flags and permission/capability coverage) that agree with what
``GET /extensions/registry`` and ``GET /extensions`` report. Deriving them on the
backend — where the registry and installed-extension stores are authoritative —
keeps every client reading the same numbers and avoids reproducing aggregation
rules per screen.

Everything is computed fresh from the authoritative stores on every call: there
is no second index to drift and removing the router leaves no collection behind.
``by_type`` and ``by_status`` are zero-filled over the canonical Literal orders
so the wire shape is stable across storage backends; ``by_permission`` lists only
declared permissions, sorted deterministically. Optional ``type``/``status``
filters narrow the registry/installed slices before any metric is computed.

Mirrored in ``frontend/src/types/extensionStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from pydantic import Field

from .common import ContractModel, Timestamp
from .provider import ExtensionStatus, ExtensionType


class ExtensionTypeCount(ContractModel):
    """Number of registry manifests of one extension type."""

    type: ExtensionType
    count: int = Field(ge=0)


class ExtensionStatusCount(ContractModel):
    """Number of installed extensions in one lifecycle status."""

    status: ExtensionStatus
    count: int = Field(ge=0)


class ExtensionPermissionStat(ContractModel):
    """How many registry manifests declare a permission."""

    permission: str
    extensions: int = Field(ge=0)


class ExtensionStats(ContractModel):
    """Registry/installation metrics derived from the authoritative stores.

    ``by_type`` is zero-filled over every canonical extension type and counts
    registry manifests; ``by_status`` is zero-filled over every canonical status
    and counts installed extensions. ``enabled``/``signed``/``verified`` are
    convenience scalars over the installed slice. Permission coverage sums every
    declared permission across the registry slice; ``unique_permissions`` is the
    distinct name count and ``by_permission`` is sorted by descending manifest
    count then permission name for deterministic cross-backend ordering.
    """

    total_registered: int = Field(ge=0)
    total_installed: int = Field(ge=0)
    by_type: list[ExtensionTypeCount] = Field(default_factory=list)
    by_status: list[ExtensionStatusCount] = Field(default_factory=list)
    enabled: int = Field(ge=0)
    signed: int = Field(ge=0)
    verified: int = Field(ge=0)
    total_permissions: int = Field(ge=0)
    unique_permissions: int = Field(ge=0)
    by_permission: list[ExtensionPermissionStat] = Field(default_factory=list)
    total_capabilities: int = Field(ge=0)
    generated_at: Timestamp


__all__ = [
    "ExtensionPermissionStat",
    "ExtensionStats",
    "ExtensionStatusCount",
    "ExtensionTypeCount",
]

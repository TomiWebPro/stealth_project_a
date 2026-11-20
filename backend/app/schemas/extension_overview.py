"""Authoritative single-extension overview contracts.

The Extensions UI needs a compact, single-extension snapshot: manifest identity,
lifecycle/trust state, the declared permission/capability/provider/UI surface and
a deterministic whole-extension count block. Deriving it on the backend — where
the authoritative installed-extension store lives — keeps every client reading
the same declaration data and avoids reproducing the projection per screen.

Everything is computed fresh on every call from the authoritative ``EXTENSIONS``
store: there is no second index to drift and removing the router leaves no
collection behind. Permission names, capabilities, provider ids, UI contributions
and dependency ids are sorted and deduplicated so the wire shape is byte-for-byte
identical regardless of how a manifest declared them. Mirrors
``frontend/src/types/extensionOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, NonEmptyStr, SemVer, Timestamp
from .provider import ExtensionStatus, ExtensionType


class ExtensionOverviewCounts(ContractModel):
    """Declaration totals for one extension, derived authoritatively.

    Each total equals the length of the corresponding emitted (sorted,
    deduplicated) list on the overview so the two can never disagree.
    """

    permissions: int = Field(ge=0)
    capabilities: int = Field(ge=0)
    provider_ids: int = Field(ge=0)
    ui_contributions: int = Field(ge=0)
    dependencies: int = Field(ge=0)


class ExtensionOverview(ContractModel):
    """A single-extension snapshot: manifest identity, trust and declared scope."""

    extension_id: UUID
    manifest_id: NonEmptyStr
    name: NonEmptyStr
    version: SemVer
    publisher: NonEmptyStr
    type: ExtensionType
    status: ExtensionStatus
    installed_at: Timestamp | None = None
    runtime: str | None = None
    app_versions: NonEmptyStr
    signed: bool
    verified: bool
    permissions: list[NonEmptyStr] = Field(default_factory=list)
    capabilities: list[NonEmptyStr] = Field(default_factory=list)
    provider_ids: list[NonEmptyStr] = Field(default_factory=list)
    ui_contributions: list[NonEmptyStr] = Field(default_factory=list)
    dependencies: list[NonEmptyStr] = Field(default_factory=list)
    counts: ExtensionOverviewCounts
    generated_at: Timestamp


__all__ = ["ExtensionOverview", "ExtensionOverviewCounts"]

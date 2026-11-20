"""Authoritative single asset-version overview contracts.

The asset version history UI needs a compact, single-version snapshot: the
requested version's identity and storage reference, its parent asset/project
context, whether it is the asset's current version, and the authoritative
version activity of that asset. Deriving it on the backend — where the
``ASSET_VERSIONS`` store and assets are authoritative — keeps every client
reading the same numbers without reimplementing the version-chain projection
per screen.

Everything is computed fresh from the authoritative stores on every call: there
is no second index to drift and removing the router leaves no collection behind.
The ``counts`` block is the whole-asset version activity (never bounded by the
``recent_limit`` page) and uses the same version-number semantics as
``/versions/stats``, so the single-version view cannot disagree with that
snapshot. Mirrors ``frontend/src/types/versionOverview.ts`` — parity is enforced
by ``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .asset import AssetType, AssetVersion, StorageRef
from .common import ContractModel, NonEmptyStr, Timestamp


class VersionOverviewCounts(ContractModel):
    """Whole-asset version activity for the version's parent asset, never bounded."""

    asset_versions: int = Field(ge=0)
    revisions: int = Field(ge=0)


class VersionOverview(ContractModel):
    """A single-version snapshot: identity, storage, context and version activity.

    ``version`` is the requested version number; ``is_latest`` is true when it
    equals the parent asset's current ``version``. ``recent_versions`` is the
    newest-version-first sibling list bounded by ``recent_limit``; ``counts`` is
    never bounded by that page. A version whose asset's project no longer exists
    keeps a stable ``Unknown project`` name rather than being dropped.
    """

    asset_id: UUID
    asset_name: NonEmptyStr
    asset_type: AssetType
    project_id: UUID
    project_name: NonEmptyStr
    version: int = Field(ge=1)
    storage: StorageRef
    created_by: UUID
    created_at: Timestamp
    is_latest: bool
    counts: VersionOverviewCounts
    recent_versions: list[AssetVersion] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = ["VersionOverview", "VersionOverviewCounts"]

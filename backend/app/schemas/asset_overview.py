"""Authoritative single-asset overview contracts.

The asset-detail screen needs a compact, single-asset snapshot (identity, a few
cross-domain counts and the newest version records). Deriving it on the backend —
where assets, versions, relationships, comments and publish receipts are
authoritative — keeps the numbers consistent with the resource routers and with
the workspace aggregates, and avoids reproducing aggregation rules per screen.

Everything is computed fresh from the authoritative stores on every call: there
is no second index to drift and removing the router leaves no collection behind.
Upstream/downstream counts reuse the same lineage relationship set as
``/assets/{id}/lineage`` and ``/assets/{id}/impact``; ``published`` reuses the
``/publishes/stats`` receipt parser so the flag cannot drift. Soft-deleted
related assets are excluded from the counts, matching the resource routers.
Mirrors ``frontend/src/types/assetOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .asset import AssetStatus, AssetType, AssetVersion
from .common import ContractModel, NonEmptyStr, Timestamp


class AssetOverviewCounts(ContractModel):
    """Cross-domain totals for one asset, derived from the authoritative stores."""

    versions: int = Field(ge=0)
    upstream: int = Field(ge=0)
    downstream: int = Field(ge=0)
    comments: int = Field(ge=0)
    tags: int = Field(ge=0)


class AssetOverview(ContractModel):
    """A single-asset snapshot: identity, counts and a few recent versions.

    ``counts.upstream``/``counts.downstream`` are distinct live assets directly
    linked by lineage relationships (parents and children respectively);
    ``counts.comments`` counts comments referencing this asset; ``published`` is
    true when the asset carries a well-formed publish receipt. ``recent_versions``
    is newest-version-first and bounded by ``recent_limit``.
    """

    asset_id: UUID
    asset_name: NonEmptyStr
    asset_type: AssetType
    status: AssetStatus
    version: int = Field(ge=1)
    project_id: UUID
    project_name: NonEmptyStr
    created_at: Timestamp
    published: bool
    counts: AssetOverviewCounts
    recent_versions: list[AssetVersion] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = ["AssetOverview", "AssetOverviewCounts"]

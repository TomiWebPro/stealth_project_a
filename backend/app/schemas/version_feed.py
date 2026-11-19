"""Authoritative asset version-feed contracts.

``GET /versions/feed`` is a newest-first, workspace-wide view of asset version
records derived fresh from the authoritative ``ASSET_VERSIONS`` collection — the
same store ``AssetRepository`` writes on register and on every ``create_version``
call — so there is no second index and no cached feed to drift. It complements
``GET /versions/stats`` (an aggregate snapshot) by projecting every version
record with its asset identity and joined project display name.

Every version record is attributed to its asset: records whose asset is
soft-deleted or unknown are excluded (matching ``/versions/stats`` and every
other asset-derived metric), so the feed can never disagree with the snapshot.
``VersionFeed`` carries a whole-scope ``total`` counted before the ``limit`` page
is applied, so a browser can show both the feed depth and a bounded page in a
single call. An optional ``project_id`` scopes the same derivation to one
project; an unknown project uses the shared 404 envelope at the router.

Mirrored in ``frontend/src/types/versionFeed.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .asset import AssetType
from .common import ContractModel, Timestamp


class VersionFeedItem(ContractModel):
    """One asset version projected from the authoritative version store."""

    asset_id: UUID
    project_id: UUID
    project_name: str
    asset_name: str
    asset_type: AssetType
    version: int = Field(ge=1)
    created_by: UUID
    created_at: Timestamp


class VersionFeed(ContractModel):
    """A bounded, newest-first page of asset versions with a whole-scope total.

    ``total`` counts every version record in scope before paging. ``items`` holds
    at most ``limit`` entries in descending ``(created_at, asset_id, version)``
    order.
    """

    items: list[VersionFeedItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    generated_at: Timestamp


__all__ = [
    "VersionFeed",
    "VersionFeedItem",
]

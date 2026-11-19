"""Authoritative asset lineage-feed contracts.

``GET /lineage/feed`` is a newest-first, workspace-wide view of typed asset
relationships derived fresh from the authoritative ``ASSET_RELATIONSHIPS``
collection — the same store ``AssetRepository`` writes on register (via
``parent_asset_ids``) and ``LineageStatsRepository`` aggregates — so there is no
second index and no cached feed to drift. It complements ``GET /lineage/stats``
(an aggregate snapshot) and the per-asset ``/assets/{id}/lineage`` /
``/assets/{id}/impact`` walks by projecting every individual relationship link
with both endpoint assets' display names and the owning project name.

A relationship belongs to the project of its source (``from_asset_id``) asset.
Links whose source asset is soft-deleted or unknown are excluded (matching
``/lineage/stats`` and every other asset-derived metric), so the feed's ``total``
can never disagree with the snapshot's ``total_relationships``. A soft-deleted
or unknown ``to_asset_id`` is kept (the link still exists) but its display name
falls back to a stable sentinel. ``LineageFeed`` carries a whole-scope ``total``
counted before the ``limit`` page is applied, so a browser can show both the feed
depth and a bounded page in a single call. An optional ``project_id`` scopes the
same derivation to one project; an unknown project uses the shared 404 envelope
at the router.

Mirrored in ``frontend/src/types/lineageFeed.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .asset import RelationshipType
from .common import ContractModel, Timestamp


class LineageFeedItem(ContractModel):
    """One typed asset relationship projected from the authoritative store."""

    id: UUID
    from_asset_id: UUID
    to_asset_id: UUID
    from_asset_name: str
    to_asset_name: str
    project_id: UUID
    project_name: str
    type: RelationshipType
    created_at: Timestamp


class LineageFeed(ContractModel):
    """A bounded, newest-first page of relationships with a whole-scope total.

    ``total`` counts every relationship in scope before paging. ``items`` holds
    at most ``limit`` entries in descending ``(created_at, id)`` order.
    """

    items: list[LineageFeedItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    generated_at: Timestamp


__all__ = [
    "LineageFeed",
    "LineageFeedItem",
]

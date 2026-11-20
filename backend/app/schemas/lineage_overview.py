"""Authoritative single lineage-relationship overview contracts.

A lineage detail UI needs a compact snapshot of one typed asset relationship:
the link's identity, both endpoint assets' identity/context, and the authoritative
activity around its source asset. Deriving it on the backend — where the
``ASSET_RELATIONSHIPS`` store is authoritative — keeps every client reading the
same numbers without reimplementing the relationship projection per screen.

Everything is computed fresh from the authoritative store on every call: there
is no second index to drift and removing the router leaves no collection behind.
``counts`` reuses the same canonical relationship set as ``/lineage/stats`` and
``/lineage/feed`` (links whose source asset is soft-deleted/unknown are excluded)
so the single view cannot disagree with those endpoints, and
``recent_relationships`` reuses the canonical ``LineageFeedItem`` wire shape from
``/lineage/feed``. Asset/project display names are joined from the authoritative
``ASSETS`` / ``PROJECTS`` stores with stable fallbacks.

Mirrors ``frontend/src/types/lineageOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .asset import AssetType, RelationshipType
from .common import ContractModel, Timestamp
from .lineage_feed import LineageFeedItem


class LineageOverviewCounts(ContractModel):
    """Whole-source-asset lineage activity, never bounded by the page."""

    source_upstream: int = Field(ge=0)
    source_downstream: int = Field(ge=0)
    source_types: int = Field(ge=0)
    project_relationships: int = Field(ge=0)


class LineageOverview(ContractModel):
    """A single relationship snapshot: endpoints, context, activity and siblings.

    ``source_upstream`` counts links into the source asset (its parents) and
    ``source_downstream`` counts links out of it (its children, including the
    target). ``source_types`` is the number of distinct relationship types across
    those links. ``project_relationships`` counts every canonical link attributed
    to the source asset's project. All counts are derived from the same
    relationship set as ``/lineage/stats``/``/lineage/feed`` and are never bounded
    by ``recent_limit``; ``recent_relationships`` is the newest-first list of the
    source asset's links bounded by that page. A relationship whose target asset
    is soft-deleted/unknown keeps a stable ``Unknown asset`` name and a null type.
    """

    id: UUID
    from_asset_id: UUID
    to_asset_id: UUID
    from_asset_name: str
    to_asset_name: str
    from_asset_type: AssetType
    to_asset_type: AssetType | None = None
    project_id: UUID
    project_name: str
    type: RelationshipType
    created_at: Timestamp
    counts: LineageOverviewCounts
    recent_relationships: list[LineageFeedItem] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = ["LineageOverview", "LineageOverviewCounts"]

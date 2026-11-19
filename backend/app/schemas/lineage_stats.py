"""Authoritative asset lineage statistics contracts.

The asset relationship store (``ASSET_RELATIONSHIPS``) records every typed link
between assets (derived_from, variant_of, uses_input, related_to, duplicate_of).
This snapshot reports how many links exist, how they are distributed across the
canonical relationship types, how many distinct live assets participate and how
recent the newest link is, so the UI never has to reproduce the aggregation rules
or read the relationship collection directly.

Everything is computed fresh from the authoritative relationship and asset stores
on every call: there is no second index to drift. Relationships whose source
asset is soft-deleted (or unknown) are excluded, matching ``/assets``, the
dashboard and the tag/asset-stat indexes. ``by_type`` is zero-filled over every
canonical relationship type and ``by_project`` is sorted by descending link count
then project id for deterministic cross-backend ordering. An optional
``project_id`` narrows the same derivation to the links originating in one
project.

Mirrored in ``frontend/src/types/lineageStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .asset import RelationshipType
from .common import ContractModel, Timestamp


class LineageTypeCount(ContractModel):
    """Number of relationships of one canonical type."""

    type: RelationshipType
    count: int = Field(ge=0)


class LineageProjectCount(ContractModel):
    """Number of relationships originating from assets in one project."""

    project_id: UUID
    relationships: int = Field(ge=0)


class LineageStats(ContractModel):
    """Lineage metrics derived from the authoritative relationship store.

    ``by_type`` is zero-filled over every canonical relationship type so a UI can
    read a bucket without guarding for a missing key. ``by_project`` lists only
    projects that own at least one relationship, sorted by descending link count
    then project id. ``total_linked_assets`` counts distinct live assets that
    appear as either endpoint of a counted relationship. ``newest_relationship_at``
    is the newest relationship ``created_at`` (``None`` when there are none).
    """

    total_relationships: int = Field(ge=0)
    total_linked_assets: int = Field(ge=0)
    by_type: list[LineageTypeCount] = Field(default_factory=list)
    by_project: list[LineageProjectCount] = Field(default_factory=list)
    newest_relationship_at: Timestamp | None = None
    generated_at: Timestamp


__all__ = [
    "LineageProjectCount",
    "LineageStats",
    "LineageTypeCount",
]

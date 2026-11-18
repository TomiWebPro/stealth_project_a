"""Authoritative downstream asset impact contracts.

Where ``AssetLineage`` walks *upstream* (an asset's ancestors), this contract
walks *downstream*: every asset transitively derived from a root asset through
the authoritative relationship store. It lets clients answer "what would break
if this asset changed?" without keeping a second index in the frontend.

Deleted assets are excluded and traversal is breadth-first with a bounded depth,
so the result is cycle-safe and cheap even in a large asset graph.

Mirrored in ``frontend/src/types/impact.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .asset import RelationshipType
from .common import ContractModel


class ImpactNode(ContractModel):
    """A descendant asset, its direct relationship to its parent and its depth."""

    asset_id: UUID
    relationship: RelationshipType | None = None
    depth: int = Field(ge=0, default=0)


class AssetImpact(ContractModel):
    """Downstream impact derived from the authoritative relationship store."""

    root_asset_id: UUID
    descendants: list[ImpactNode] = Field(default_factory=list)
    total: int = Field(ge=0)


__all__ = ["AssetImpact", "ImpactNode"]

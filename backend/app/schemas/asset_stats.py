"""Authoritative asset inventory statistics contracts.

The workspace overview and asset browser need aggregate inventory metrics
(asset volume, type/status breakdowns, stored bytes, version count, recency).
Deriving them on the backend — where assets are authoritative — keeps every
client reading the same numbers and avoids reproducing aggregation rules per
client.

Everything is computed fresh from the authoritative asset store on every call:
there is no second index to drift and removing the router leaves no collection
behind. Soft-deleted assets are excluded from every metric (matching ``/assets``,
the dashboard and the tag index), so the zero-filled ``deleted`` status bucket
stays at 0 by construction. An optional ``project_id`` scope narrows the same
derivation to one project.

Mirrored in ``frontend/src/types/assetStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from pydantic import Field

from .asset import AssetStatus, AssetType
from .common import ContractModel, Timestamp


class AssetTypeCount(ContractModel):
    """Number of live assets of one type."""

    type: AssetType
    count: int = Field(ge=0)


class AssetStatusCount(ContractModel):
    """Number of live assets in one lifecycle status."""

    status: AssetStatus
    count: int = Field(ge=0)


class AssetStats(ContractModel):
    """Inventory metrics derived from the authoritative asset store.

    ``by_type`` and ``by_status`` are zero-filled over every canonical asset
    type/status so a UI can read a bucket without guarding for a missing key.
    ``total_size_bytes`` sums the recorded ``storage.size_bytes`` of live assets.
    ``total_versions`` is the sum of each live asset's current ``version`` — the
    total number of version revisions recorded across the inventory (each asset
    contributes at least one). ``newest_asset_at`` is the newest live asset's
    ``created_at`` (``None`` when there are no live assets).
    """

    total: int = Field(ge=0)
    by_type: list[AssetTypeCount] = Field(default_factory=list)
    by_status: list[AssetStatusCount] = Field(default_factory=list)
    total_size_bytes: int = Field(ge=0)
    total_versions: int = Field(ge=0)
    newest_asset_at: Timestamp | None = None
    generated_at: Timestamp


__all__ = ["AssetStats", "AssetStatusCount", "AssetTypeCount"]

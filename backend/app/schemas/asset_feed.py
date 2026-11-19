"""Authoritative asset feed contracts.

``GET /assets/feed`` is the feed companion to the ``GET /assets`` list, the
``GET /assets/stats`` inventory snapshot and the ``GET /publishes`` feed: a
newest-first, workspace-wide view of assets, each projected from the
authoritative ``ASSETS`` collection with its project display name joined from
the ``PROJECTS`` store. It is built fresh on every call (no second index), so the
feed can never drift from what actually exists.

Every item carries the asset and project identity (id + joined project display
name), type/name/status, the current version and recorded byte size, and the
asset's created/updated timestamps. Ordering is by descending
``(created_at, asset_id)``, giving a byte-for-byte identical wire shape across
the in-memory and SQLite stores. Soft-deleted assets are excluded (matching
``/assets``, ``/assets/stats`` and the tag index). An optional ``project_id``
narrows the same derivation to one project.

Mirrored in ``frontend/src/types/assetFeed.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .asset import AssetStatus, AssetType
from .common import ContractModel, NonEmptyStr, Timestamp


class AssetFeedItem(ContractModel):
    """One live asset projected from the authoritative asset store."""

    asset_id: UUID
    project_id: UUID
    project_name: str
    type: AssetType
    name: NonEmptyStr
    status: AssetStatus
    version: int = Field(ge=1)
    size_bytes: int = Field(ge=0)
    created_at: Timestamp
    updated_at: Timestamp


class AssetFeed(ContractModel):
    """A bounded, newest-first page of assets with a whole-scope total.

    ``total`` counts every live asset in scope before the ``limit`` page is
    applied, so a consumer can show the feed size and the newest page in one
    call. ``items`` is empty when there are no live assets in scope.
    """

    items: list[AssetFeedItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    generated_at: Timestamp


__all__ = [
    "AssetFeed",
    "AssetFeedItem",
]

"""Authoritative publish-feed contracts.

``GET /publishes`` is the feed companion to ``GET /publishes/stats``: a newest-
first view of published deliverables, each projected from the ``publish_receipt``
recorded inside an asset in the authoritative ``ASSETS`` collection. It is derived
fresh on every call (no second index), so the feed can never drift from the
publish snapshot or from what actually exists on disk.

Every item carries the asset and project identity (id + display name), the asset
type, the receipt version and delivered byte size, and the publish time. Feed
ordering is by descending publish time with an asset-id tie-break, giving a
byte-for-byte identical wire shape across the in-memory and SQLite stores. An
optional ``project_id`` narrows the same derivation to one project.

Mirrored in ``frontend/src/types/publishFeed.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .asset import AssetType
from .common import ContractModel, Timestamp


class PublishFeedItem(ContractModel):
    """One published deliverable projected from an asset's publish receipt."""

    asset_id: UUID
    asset_name: str
    asset_type: AssetType
    project_id: UUID
    project_name: str
    version: int = Field(ge=1)
    size_bytes: int = Field(ge=0)
    published_at: Timestamp


class PublishFeed(ContractModel):
    """A bounded, newest-first page of published assets with a whole-scope total.

    ``total`` counts every published asset in scope before the ``limit`` page is
    applied, so a consumer can show the feed size and the newest page in one
    call. ``items`` is empty when nothing is published in scope.
    """

    items: list[PublishFeedItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    generated_at: Timestamp


__all__ = [
    "PublishFeedItem",
    "PublishFeed",
]

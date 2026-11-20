"""Authoritative single publish-receipt overview contracts.

``GET /publishes`` (feed) and ``GET /publishes/stats`` (snapshot) already expose
published deliverables workspace-wide, but there is no view of one individual
publication with its joined project context. This snapshot fills that gap: the
receipt identity (asset/project names, type, version, delivered bytes and
publish time), a whole-project publish-count/byte block derived with the exact
same rules as ``/publishes/stats``, and a bounded newest-first page of sibling
publications from the same project reusing the canonical ``PublishFeedItem``
wire shape.

Everything is computed fresh from the authoritative ``ASSETS`` store on every
call: there is no second index to drift and removing the router leaves no
collection behind. Soft-deleted assets and assets without a well-formed receipt
are excluded everywhere, so the overview can never disagree with the feed or the
publish snapshot. ``counts`` describe whole scopes and are never bounded by
``recent_limit``; the sibling page is bounded and newest-first with a
deterministic ``(published_at, asset_id)`` tie-break.

Mirrors ``frontend/src/types/publishOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .asset import AssetType
from .common import ContractModel, Timestamp
from .publish_feed import PublishFeedItem


class PublishOverviewCounts(ContractModel):
    """Publish activity totals derived from the authoritative asset store."""

    project_published: int = Field(ge=0)
    project_bytes: int = Field(ge=0)
    total_published: int = Field(ge=0)


class PublishOverview(ContractModel):
    """A single-publication snapshot: identity, context, counts and siblings.

    ``counts`` describe the whole asset's project and the whole workspace; they
    are never bounded by ``recent_limit``. ``recent_siblings`` is newest-first
    within the same project (the target included) and bounded by ``recent_limit``.
    """

    asset_id: UUID
    asset_name: str
    asset_type: AssetType
    project_id: UUID
    project_name: str
    version: int = Field(ge=1)
    size_bytes: int = Field(ge=0)
    published_at: Timestamp
    counts: PublishOverviewCounts
    recent_siblings: list[PublishFeedItem] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = ["PublishOverview", "PublishOverviewCounts"]

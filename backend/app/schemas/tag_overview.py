"""Authoritative single-tag overview contracts.

``GET /tags`` exposes a most-used-first facet index and ``GET /assets/feed`` a
newest-first asset feed, but neither shows what actually sits behind one tag.
This snapshot fills that gap: the tag identity (with its optional project scope),
a whole-scope count block derived with the exact same rules as ``/tags``, and a
bounded newest-first page of the live assets carrying that tag reusing the
canonical ``AssetFeedItem`` wire shape.

Everything is computed fresh from the authoritative ``ASSETS`` store on every
call: there is no second index to drift and removing the router leaves no
collection behind. Matching is exact (case-sensitive) and soft-deleted assets
are excluded everywhere, so ``counts.tagged_assets`` can never disagree with the
matching ``/tags`` facet. ``counts`` describe whole scopes and are never bounded
by ``recent_limit``; the recent-asset page is bounded and newest-first with a
deterministic ``(created_at, asset_id)`` tie-break.

Mirrors ``frontend/src/types/tagOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .asset_feed import AssetFeedItem
from .common import ContractModel, NonEmptyStr, Timestamp


class TagOverviewCounts(ContractModel):
    """Tag usage totals derived from the authoritative asset store."""

    tagged_assets: int = Field(ge=0)
    tagged_projects: int = Field(ge=0)
    scope_assets: int = Field(ge=0)


class TagOverview(ContractModel):
    """A single-tag snapshot: identity, scope, counts and recent tagged assets.

    ``counts`` describe the whole requested scope (one project, or the whole
    workspace) and are never bounded by ``recent_limit``. ``recent_assets`` is
    newest-first within that scope and bounded by ``recent_limit``.
    """

    tag: NonEmptyStr
    project_id: UUID | None = None
    project_name: str | None = None
    counts: TagOverviewCounts
    recent_assets: list[AssetFeedItem] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = ["TagOverview", "TagOverviewCounts"]

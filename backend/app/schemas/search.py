"""Authoritative cross-domain search contracts.

The desktop quick-finder needs to search projects, assets and conversations.
Deriving matches on the backend — where projects, assets and conversations are
authoritative — keeps a single source of truth and avoids reproducing ranking
rules per screen.

Mirrored in ``frontend/src/types/search.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import Field

from .common import ContractModel, NonEmptyStr

SearchResultKind = Literal["project", "asset", "conversation"]


class SearchResult(ContractModel):
    """One ranked match. ``id`` is the entity id and is stable across refetches."""

    kind: SearchResultKind
    id: UUID
    title: NonEmptyStr
    subtitle: str | None = None
    project_id: UUID | None = None
    score: float = Field(ge=0.0, le=1.0, default=0.0)


class SearchResponse(ContractModel):
    """Ranked, best-first matches for one query."""

    query: NonEmptyStr
    results: list[SearchResult] = Field(default_factory=list)


__all__ = ["SearchResponse", "SearchResult", "SearchResultKind"]

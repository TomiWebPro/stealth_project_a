"""Authoritative cross-domain search endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ..deps import get_search_repository
from ..repositories.search import SearchRepository
from ..schemas.search import SearchResponse, SearchResultKind

router = APIRouter(tags=["search"])


@router.get("/search", response_model=SearchResponse)
def global_search(
    q: Annotated[
        str,
        Query(min_length=1, max_length=200, description="Case-insensitive search text"),
    ],
    search_repo: Annotated[SearchRepository, Depends(get_search_repository)],
    kind: Annotated[
        SearchResultKind | None,
        Query(description="Restrict results to one entity kind"),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> SearchResponse:
    """Ranked project/asset/conversation matches, best first.

    Invalid filters (blank/over-long ``q``, unknown ``kind``, out-of-range
    ``limit``) are rejected with the shared 422 validation envelope. A valid
    query with no matches returns an empty ``results`` list, not an error.
    """
    return search_repo.search(q, kind=kind, limit=limit)


__all__ = ["router"]

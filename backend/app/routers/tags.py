"""Authoritative asset tag facet endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_tag_repository
from ..repositories.tags import TagRepository
from ..schemas.tags import TagIndex

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=TagIndex)
def tag_facets(
    tags: Annotated[TagRepository, Depends(get_tag_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
    prefix: Annotated[
        str | None, Query(description="Case-insensitive tag prefix filter", min_length=1)
    ] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> TagIndex:
    """Most-used-first asset tag facets derived from the authoritative store.

    Unknown projects return the shared 404 error envelope; invalid filters
    (bad project id, empty prefix or limit) use the shared 422 envelope.
    """
    return tags.index(project_id=project_id, prefix=prefix, limit=limit)


__all__ = ["router"]

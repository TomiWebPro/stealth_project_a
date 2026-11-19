"""Authoritative production-pipeline feed endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_pipeline_feed_repository
from ..repositories.pipeline_feed import PipelineFeedRepository
from ..schemas.pipeline_feed import PipelineFeed
from ..schemas.pipeline_stats import PipelineKind

router = APIRouter(tags=["pipelines", "feed"])


@router.get("/pipelines/feed", response_model=PipelineFeed)
def get_pipeline_feed(
    pipeline_feed: Annotated[PipelineFeedRepository, Depends(get_pipeline_feed_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
    kind: Annotated[
        PipelineKind | None,
        Query(description="Filter to one pipeline chain kind"),
    ] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum feed items to return"),
    ] = 50,
) -> PipelineFeed:
    """Return pipeline chains newest-first from the authoritative chain stores.

    Each item is projected from a LoRA/shot/splat chain document with its kind,
    joined project name and the same job/asset counts ``/pipelines/stats`` uses.
    An unknown ``project_id`` raises the shared 404 envelope; an invalid ``kind``,
    ``project_id`` or ``limit`` uses the shared 422 validation envelope.
    ``total`` counts the whole filtered feed before the ``limit`` page is applied.
    """
    return pipeline_feed.feed(project_id=project_id, kind=kind, limit=limit)


__all__ = ["router"]

"""Reference-link planning (dry run) and application endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from ..deps import get_link_service, get_project_repository
from ..links import ReferenceLinkService
from ..repositories.projects import ProjectRepository

router = APIRouter(tags=["reference-links"])


class LinkSpec(BaseModel):
    source: str
    target: str


class LinkRequest(BaseModel):
    links: list[LinkSpec]
    prefer_marker: bool = False


class LinkAction(BaseModel):
    source: str
    target: str
    action: str
    reason: str | None = None


class LinkPlanResponse(BaseModel):
    project_id: str
    root: str
    actions: list[LinkAction]
    copied_bytes: int


class LinkApplyResponse(BaseModel):
    project_id: str
    root: str
    performed: list[LinkAction]
    registry: dict[str, str]
    copied_bytes: int


def _specs(payload: LinkRequest) -> list[dict]:
    return [item.model_dump() for item in payload.links]


@router.post("/projects/{project_id}/links/plan", response_model=LinkPlanResponse)
def plan_links(
    project_id: UUID,
    payload: LinkRequest,
    projects: Annotated[ProjectRepository, Depends(get_project_repository)],
    links: Annotated[ReferenceLinkService, Depends(get_link_service)],
) -> LinkPlanResponse:
    """Dry run: describe reference actions without writing anything."""
    project = projects.get_or_raise(project_id)
    return LinkPlanResponse(
        **links.plan(
            project.id,
            project.name,
            _specs(payload),
            prefer_marker=payload.prefer_marker,
        )
    )


@router.post("/projects/{project_id}/links/apply", response_model=LinkApplyResponse)
def apply_links(
    project_id: UUID,
    payload: LinkRequest,
    projects: Annotated[ProjectRepository, Depends(get_project_repository)],
    links: Annotated[ReferenceLinkService, Depends(get_link_service)],
) -> LinkApplyResponse:
    project = projects.get_or_raise(project_id)
    return LinkApplyResponse(
        **links.apply(
            project.id,
            project.name,
            _specs(payload),
            prefer_marker=payload.prefer_marker,
        )
    )


@router.get("/projects/{project_id}/links")
def get_link_registry(
    project_id: UUID,
    projects: Annotated[ProjectRepository, Depends(get_project_repository)],
    links: Annotated[ReferenceLinkService, Depends(get_link_service)],
) -> dict[str, str]:
    project = projects.get_or_raise(project_id)
    return links.registry(project.id, project.name)


__all__ = ["router"]

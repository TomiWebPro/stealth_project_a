"""Project folder-tree materialization and verification endpoints.

Response shapes are router-local (Phase 3 backend utility, not yet part of the
shared frontend mirror); when a screen consumes them, promote them into
``app.schemas`` with a TS mirror in the same change.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from ..deps import get_project_repository, get_project_tree
from ..repositories.projects import ProjectRepository
from ..tree import ProjectTree

router = APIRouter(tags=["project-tree"])


class ProjectTreeInfo(BaseModel):
    project_id: UUID
    folder: str
    root: str
    exists: bool
    missing: list[str]
    manifest: dict | None
    directory_count: int


@router.post(
    "/projects/{project_id}/tree",
    response_model=ProjectTreeInfo,
    status_code=status.HTTP_201_CREATED,
)
def materialize_project_tree(
    project_id: UUID,
    projects: Annotated[ProjectRepository, Depends(get_project_repository)],
    tree: Annotated[ProjectTree, Depends(get_project_tree)],
) -> ProjectTreeInfo:
    """Create/refresh the canonical on-disk tree for a registered project."""
    project = projects.get_or_raise(project_id)
    return ProjectTreeInfo(**tree.create_project(project.id, project.name))


@router.get("/projects/{project_id}/tree", response_model=ProjectTreeInfo)
def verify_project_tree(
    project_id: UUID,
    projects: Annotated[ProjectRepository, Depends(get_project_repository)],
    tree: Annotated[ProjectTree, Depends(get_project_tree)],
) -> ProjectTreeInfo:
    project = projects.get_or_raise(project_id)
    return ProjectTreeInfo(**tree.verify(project.id, project.name))


__all__ = ["router", "ProjectTreeInfo"]

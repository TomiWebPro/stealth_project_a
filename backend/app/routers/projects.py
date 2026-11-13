"""Project endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from ..deps import (
    get_current_org_id,
    get_current_user_id,
    get_project_repository,
)
from ..repositories.projects import ProjectRepository
from ..schemas.auth import Project, ProjectCreate, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[Project])
def list_projects(
    projects: Annotated[ProjectRepository, Depends(get_project_repository)],
    org_id: Annotated[UUID | None, Query(description="Filter by organization")] = None,
) -> list[Project]:
    return projects.list(org_id=org_id)


@router.post("", response_model=Project, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    projects: Annotated[ProjectRepository, Depends(get_project_repository)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    org_id: Annotated[UUID, Depends(get_current_org_id)],
) -> Project:
    return projects.create(payload, org_id=org_id, user_id=user_id)


@router.get("/{project_id}", response_model=Project)
def get_project(
    project_id: UUID,
    projects: Annotated[ProjectRepository, Depends(get_project_repository)],
) -> Project:
    return projects.get_or_raise(project_id)


@router.patch("/{project_id}", response_model=Project)
def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    projects: Annotated[ProjectRepository, Depends(get_project_repository)],
) -> Project:
    return projects.update(project_id, payload)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_project(
    project_id: UUID,
    projects: Annotated[ProjectRepository, Depends(get_project_repository)],
) -> Response:
    """Soft-delete a project by archiving it (recoverable)."""
    projects.archive(project_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]

"""Project repository."""

from __future__ import annotations

from uuid import UUID, uuid4

from ..errors import ApiError, NotFoundError
from ..schemas.auth import Project, ProjectCreate, ProjectUpdate
from ..schemas.common import utcnow
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository


class ProjectRepository(BaseRepository):
    def create(
        self, payload: ProjectCreate, *, org_id: UUID, user_id: UUID
    ) -> Project:
        now = self.clock()
        project = Project(
            id=uuid4(),
            org_id=org_id,
            name=payload.name,
            description=payload.description,
            created_by=user_id,
            created_at=now,
            updated_at=now,
        )
        self._save(Collections.PROJECTS, str(project.id), project)
        return project

    def get(self, project_id: UUID) -> Project | None:
        return self._load(Collections.PROJECTS, str(project_id), Project)

    def get_or_raise(self, project_id: UUID) -> Project:
        project = self.get(project_id)
        if project is None:
            raise NotFoundError("Project", str(project_id))
        return project

    def list(self, *, org_id: UUID | None = None) -> list[Project]:
        projects = self._load_all(Collections.PROJECTS, Project)
        if org_id is not None:
            projects = [project for project in projects if project.org_id == org_id]
        # Newest first; id is the stable tie-breaker (deterministic ordering).
        projects.sort(key=lambda project: (project.created_at, str(project.id)), reverse=True)
        return projects

    def update(self, project_id: UUID, payload: ProjectUpdate) -> Project:
        project = self.get_or_raise(project_id)
        changes = payload.model_dump(exclude_unset=True)

        if "name" in changes and changes["name"] is None:
            raise ApiError(
                "Project name cannot be null.",
                status_code=422,
                code="invalid_request",
                details=[("name", "name is required and cannot be null")],
            )
        if "archived" in changes and changes["archived"] is None:
            raise ApiError(
                "Project archived flag cannot be null.",
                status_code=422,
                code="invalid_request",
                details=[("archived", "archived must be a boolean or omitted")],
            )

        document = project.model_dump(mode="json")
        document.update(changes)
        document["updated_at"] = self.clock().isoformat()
        updated = Project.model_validate(document)
        self._save(Collections.PROJECTS, str(project_id), updated)
        return updated

    def archive(self, project_id: UUID) -> Project:
        project = self.get_or_raise(project_id)
        if project.archived:
            return project
        document = project.model_dump(mode="json")
        document["archived"] = True
        document["updated_at"] = self.clock().isoformat()
        updated = Project.model_validate(document)
        self._save(Collections.PROJECTS, str(project_id), updated)
        return updated


__all__ = ["ProjectRepository"]

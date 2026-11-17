"""Workspace activity feed repository.

Activity is derived from the authoritative stores rather than persisted as a
separate log: there is no second source of truth to drift, and removing the
router leaves no orphaned collection behind. It complements the per-project
audit feed by adding comment activity, the acting user, project context and an
optional cross-project scope.

Event kinds and ids mirror ``frontend/src/types/activity.ts``:
  - ``asset-<id>``   one per registered asset (creation);
  - ``publish-<id>`` one per asset carrying a publish receipt;
  - ``job-<id>``     one per submitted job;
  - ``comment-<id>`` one per project comment.
"""

from __future__ import annotations

from uuid import UUID

from ..errors import NotFoundError
from ..schemas.activity import ActivityEvent, ActivityFeed, ActivityKind
from ..schemas.asset import Asset
from ..schemas.common import utcnow
from ..schemas.operation import Job
from ..schemas.orchestration import Comment
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

# Kept in sync with JOB_TONE in graphHelpers.ts / the audit repository.
_JOB_TONES: dict[str, str] = {
    "queued": "neutral",
    "running": "info",
    "succeeded": "success",
    "failed": "danger",
    "canceled": "neutral",
}


class ActivityRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def feed(
        self,
        *,
        project_id: UUID | None = None,
        kind: ActivityKind | None = None,
        limit: int = 50,
    ) -> ActivityFeed:
        """Build the newest-first activity feed, optionally scoped to a project.

        An unknown ``project_id`` raises ``NotFoundError`` so the shared 404
        envelope is used (same behaviour as the other project-scoped routers).
        """
        if project_id is not None:
            self.projects.get_or_raise(project_id)

        events: list[ActivityEvent] = []
        for asset in self._load_all(Collections.ASSETS, Asset):
            if project_id is not None and asset.project_id != project_id:
                continue
            events.append(
                ActivityEvent(
                    id=f"asset-{asset.id}",
                    kind="asset",
                    project_id=asset.project_id,
                    actor_id=asset.creator_id,
                    label=f"Created {asset.name}",
                    detail=asset.provenance.operation_id or asset.type,
                    timestamp=asset.created_at,
                    tone="info",
                )
            )
            receipt = asset.metadata.get("publish_receipt")
            if isinstance(receipt, dict):
                publisher = receipt.get("publisher")
                actor = UUID(str(publisher)) if publisher else asset.creator_id
                comment = receipt.get("comment")
                events.append(
                    ActivityEvent(
                        id=f"publish-{asset.id}",
                        kind="publish",
                        project_id=asset.project_id,
                        actor_id=actor,
                        label=f"Published {asset.name}",
                        detail=comment if isinstance(comment, str) and comment else "Publish receipt recorded",
                        timestamp=asset.updated_at,
                        tone="success",
                    )
                )

        for job in self._load_all(Collections.JOBS, Job):
            if project_id is not None and job.project_id != project_id:
                continue
            events.append(
                ActivityEvent(
                    id=f"job-{job.id}",
                    kind="job",
                    project_id=job.project_id,
                    actor_id=job.created_by,
                    label=f"{job.operation_id} · {job.status}",
                    detail=(
                        job.error.message
                        if job.error and job.error.message
                        else f"Attempt {job.attempt}"
                    ),
                    timestamp=job.created_at,
                    tone=_JOB_TONES.get(job.status, "neutral"),  # type: ignore[arg-type]
                )
            )

        for comment in self._load_all(Collections.COMMENTS, Comment):
            if project_id is not None and comment.project_id != project_id:
                continue
            events.append(
                ActivityEvent(
                    id=f"comment-{comment.id}",
                    kind="comment",
                    project_id=comment.project_id,
                    actor_id=comment.author_id,
                    label="Commented on a project",
                    detail=comment.body,
                    timestamp=comment.created_at,
                    tone="accent",
                )
            )

        if kind is not None:
            events = [event for event in events if event.kind == kind]

        events.sort(key=lambda event: (event.timestamp, event.id), reverse=True)
        return ActivityFeed(events=events[:limit], total=len(events))


__all__ = ["ActivityRepository", "_JOB_TONES"]

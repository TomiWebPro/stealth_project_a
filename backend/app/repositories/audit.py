"""Project audit trail repository.

Audit events are derived from authoritative stores rather than persisted as a
separate log. That keeps the feed consistent with assets/jobs (no second source
of truth to drift) and makes the feature reversible: removing the router leaves
no orphaned collection behind.

Provenance mirrors the desktop derivation in
``frontend/src/features/lineage/graphHelpers.ts``:
  - one ``asset`` event per registered asset (creation);
  - one ``publish`` event per asset carrying a publish receipt;
  - one ``job`` event per submitted job.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from ..errors import NotFoundError
from ..schemas.asset import Asset
from ..schemas.audit import AuditEvent, AuditEventKind, AuditTrail
from ..schemas.common import utcnow
from ..schemas.operation import Job
from ..storage.base import Collections, DocumentStore
from .assets import AssetRepository
from .base import BaseRepository
from .jobs import JobRepository
from .projects import ProjectRepository

# Kept in sync with JOB_TONE in graphHelpers.ts.
_JOB_TONES: dict[str, str] = {
    "queued": "neutral",
    "running": "info",
    "succeeded": "success",
    "failed": "danger",
    "canceled": "neutral",
}


def _as_utc(value: datetime) -> datetime:
    """Normalize query bounds so comparisons never mix naive/aware datetimes."""
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class AuditRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        assets: AssetRepository,
        jobs: JobRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects
        self.assets = assets
        self.jobs = jobs

    def trail(
        self,
        project_id: UUID,
        *,
        kind: AuditEventKind | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
        limit: int = 200,
    ) -> AuditTrail:
        """Build the project's audit feed, newest first.

        Raises ``NotFoundError`` for an unknown project so the shared error
        envelope is used (same behaviour as the other project-scoped routers).
        """
        self.projects.get_or_raise(project_id)

        events: list[AuditEvent] = []
        for asset in self._load_all(Collections.ASSETS, Asset):
            if asset.project_id != project_id:
                continue
            events.append(
                AuditEvent(
                    id=f"asset-{asset.id}",
                    kind="asset",
                    label=f"Created {asset.name}",
                    detail=asset.provenance.operation_id or asset.type,
                    timestamp=asset.created_at,
                    tone="info",
                )
            )
            receipt = asset.metadata.get("publish_receipt")
            if isinstance(receipt, dict):
                comment = receipt.get("comment")
                events.append(
                    AuditEvent(
                        id=f"publish-{asset.id}",
                        kind="publish",
                        label=f"Published {asset.name}",
                        detail=comment if isinstance(comment, str) and comment else "Publish receipt recorded",
                        timestamp=asset.updated_at,
                        tone="success",
                    )
                )

        for job in self._load_all(Collections.JOBS, Job):
            if job.project_id != project_id:
                continue
            events.append(
                AuditEvent(
                    id=f"job-{job.id}",
                    kind="job",
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

        if kind is not None:
            events = [event for event in events if event.kind == kind]
        lower = _as_utc(since) if since is not None else None
        upper = _as_utc(until) if until is not None else None
        if lower is not None or upper is not None:
            filtered: list[AuditEvent] = []
            for event in events:
                moment = _as_utc(event.timestamp)
                if lower is not None and moment < lower:
                    continue
                if upper is not None and moment > upper:
                    continue
                filtered.append(event)
            events = filtered

        events.sort(key=lambda event: (event.timestamp, event.id), reverse=True)
        return AuditTrail(project_id=project_id, events=events[:limit])

    def require_project(self, project_id: UUID) -> None:
        """Explicit guard for callers that want a 404 without building a feed."""
        if self.projects.get(project_id) is None:
            raise NotFoundError("Project", str(project_id))


__all__ = ["AuditRepository", "_JOB_TONES"]

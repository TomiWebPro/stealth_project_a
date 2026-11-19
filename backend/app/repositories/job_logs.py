"""Authoritative per-job execution log repository.

Log entries are derived from the job's event stream via
``JobRepository.event_frame`` — the same authoritative ``JOB_EVENTS`` store the
SSE and polling endpoints read. There is no persisted log index to drift, and
removing the router leaves no collection behind.

An unknown ``job_id`` propagates ``JobRepository``'s ``NotFoundError`` so the
shared 404 envelope is used. Filtering and bounds are validated at the router
(shared 422 envelope); this repository only implements the derivation.

Mirrors ``frontend/src/types/jobLogs.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..schemas.common import utcnow
from ..schemas.job_logs import JobLogEntry, JobLogFrame, LogLevel
from ..storage.base import DocumentStore
from .base import BaseRepository
from .jobs import JobRepository

# Coarse console severity for each canonical JobEventType. Every type has a
# mapping so an event can never silently disappear from a filtered log view.
_LEVEL_BY_TYPE: dict[str, str] = {
    "status": "info",
    "progress": "debug",
    "intermediate": "info",
    "result": "success",
    "error": "error",
    "log": "info",
}


class JobLogsRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        jobs: JobRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.jobs = jobs

    def logs(
        self,
        job_id: UUID,
        *,
        level: LogLevel | None = None,
        since_seq: int = 0,
        limit: int = 50,
    ) -> JobLogFrame:
        """Build a chronological, filtered, paginated view of a job's log.

        ``total`` counts every matching entry in the stream (ignoring the cursor
        and page size). ``next_seq`` is a resume cursor: pass it back as
        ``since_seq`` to continue reading, until no more entries are returned.
        """
        # event_frame raises NotFoundError for an unknown job, giving the shared
        # 404 envelope; it also guarantees seq-ascending order.
        events = self.jobs.event_frame(job_id, since=0).events

        matching = [
            event
            for event in events
            if (level is None or _LEVEL_BY_TYPE.get(event.type, "info") == level)
        ]
        total = len(matching)

        page = [
            JobLogEntry(
                seq=event.seq,
                type=event.type,
                level=_LEVEL_BY_TYPE.get(event.type, "info"),  # type: ignore[arg-type]
                message=event.message,
                status=event.status,
                progress=event.progress,
                asset_id=event.asset_id,
                error=event.error,
                timestamp=event.timestamp,
            )
            for event in matching
            if event.seq >= since_seq
        ][:limit]

        next_seq = page[-1].seq + 1 if page else since_seq
        return JobLogFrame(
            job_id=job_id,
            entries=page,
            next_seq=next_seq,
            total=total,
        )


__all__ = ["JobLogsRepository", "_LEVEL_BY_TYPE"]

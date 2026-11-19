"""Upload ticket repository (local object-storage emulation).

Uploads are intentionally separated from asset registration: the client obtains
a ticket, PUTs bytes to the backend's dev-local storage, then registers asset
metadata. A real S3-compatible adapter will replace the local path handling
behind the same API (see docs/ASSET_MANAGEMENT.md).
"""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from ..errors import ConflictError, GoneError, NotFoundError
from ..schemas.asset import UploadRequest, UploadTicket
from ..schemas.common import utcnow
from ..schemas.upload_stats import UploadStatus
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

UPLOAD_TICKET_TTL = timedelta(minutes=15)


class UploadRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    upload_id: UUID
    project_id: UUID
    filename: str
    content_type: str
    declared_size: int
    size_bytes: int = 0
    status: UploadStatus = "pending"
    path: str | None = None
    created_at: datetime
    expires_at: datetime


class UploadRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        *,
        upload_dir: Path,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects
        self.upload_dir = upload_dir

    def create_ticket(
        self, payload: UploadRequest, *, upload_id: UUID, url: str
    ) -> UploadTicket:
        project = self.projects.get_or_raise(payload.project_id)
        if project.archived:
            raise ConflictError(
                f"Project '{project.id}' is archived; uploads are not accepted.",
                code="project_archived",
            )

        now = self.clock()
        expires_at = now + UPLOAD_TICKET_TTL
        record = UploadRecord(
            upload_id=upload_id,
            project_id=payload.project_id,
            filename=payload.filename,
            content_type=payload.content_type,
            declared_size=payload.size_bytes,
            created_at=now,
            expires_at=expires_at,
        )
        self._save(Collections.UPLOADS, str(upload_id), record)
        return UploadTicket(
            upload_id=upload_id,
            url=url,
            method="PUT",
            headers={"Content-Type": payload.content_type},
            expires_at=expires_at,
        )

    def get_record(self, upload_id: UUID) -> UploadRecord | None:
        return self._load(Collections.UPLOADS, str(upload_id), UploadRecord)

    def get_record_or_raise(self, upload_id: UUID) -> UploadRecord:
        record = self.get_record(upload_id)
        if record is None:
            raise NotFoundError("Upload", str(upload_id))
        return record

    def ensure_writable(self, record: UploadRecord) -> None:
        if record.status == "complete":
            raise ConflictError(
                f"Upload '{record.upload_id}' has already been completed.",
                code="upload_already_complete",
            )
        if self.clock() > record.expires_at:
            raise GoneError(
                f"Upload ticket '{record.upload_id}' has expired.",
                code="upload_expired",
            )

    def target_path(self, record: UploadRecord) -> Path:
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        return self.upload_dir / str(record.upload_id)

    def mark_complete(self, record: UploadRecord, *, size_bytes: int) -> UploadRecord:
        completed = record.model_copy(
            update={
                "status": "complete",
                "size_bytes": size_bytes,
                "path": str(self.target_path(record)),
            }
        )
        self._save(Collections.UPLOADS, str(record.upload_id), completed)
        return completed

    def content_path(self, record: UploadRecord) -> Path | None:
        if record.status != "complete" or record.path is None:
            return None
        path = Path(record.path)
        return path if path.is_file() else None


__all__ = ["UPLOAD_TICKET_TTL", "UploadRecord", "UploadRepository"]

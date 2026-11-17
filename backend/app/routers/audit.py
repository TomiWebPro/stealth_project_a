"""Authoritative project audit trail endpoint."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_audit_repository
from ..repositories.audit import AuditRepository
from ..schemas.audit import AuditEventKind, AuditTrail

router = APIRouter(tags=["audit"])


@router.get("/projects/{project_id}/audit", response_model=AuditTrail)
def project_audit(
    project_id: UUID,
    audit: Annotated[AuditRepository, Depends(get_audit_repository)],
    kind: Annotated[AuditEventKind | None, Query(description="Filter to one event kind")] = None,
    since: Annotated[datetime | None, Query(description="Inclusive lower time bound")] = None,
    until: Annotated[datetime | None, Query(description="Inclusive upper time bound")] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> AuditTrail:
    """Newest-first history of asset, publish and job events for a project.

    Unknown projects return the shared 404 error envelope; invalid filters are
    rejected with the shared 422 validation envelope.
    """
    return audit.trail(project_id, kind=kind, since=since, until=until, limit=limit)


__all__ = ["router"]

"""Authoritative project audit trail contracts.

The desktop UI derives a chronological feed from the assets and jobs it has
already loaded. These contracts move that derivation to the backend, which is
authoritative for jobs and assets: clients can render a single, consistent feed
without having to reproduce the derivation rules per screen.

Mirrored in ``frontend/src/types/audit.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import Field

from .common import ContractModel, NonEmptyStr, Timestamp

AuditEventKind = Literal["asset", "publish", "job"]
# Mirrors the frontend BadgeTone union so an event's tone can be passed directly
# to a badge without a client-side remapping table.
AuditTone = Literal["neutral", "accent", "success", "warning", "danger", "info"]


class AuditEvent(ContractModel):
    """One immutable entry in a project's history.

    ``id`` is stable (``<kind>-<entity-id>``) so clients can dedupe across
    refetches and use it as a React key.
    """

    id: NonEmptyStr
    kind: AuditEventKind
    label: NonEmptyStr
    detail: NonEmptyStr
    timestamp: Timestamp
    tone: AuditTone


class AuditTrail(ContractModel):
    """Newest-first audit feed for one project."""

    project_id: UUID
    events: list[AuditEvent] = Field(default_factory=list)


__all__ = ["AuditEvent", "AuditEventKind", "AuditTone", "AuditTrail"]

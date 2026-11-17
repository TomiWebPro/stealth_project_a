"""Authoritative workspace activity feed contracts.

The per-project audit trail (``schemas/audit``) answers "what happened in this
project?". This feed answers "what is happening across the workspace?" — it adds
comment activity, the acting user and project context, and can be filtered to a
single project. Both are derived from the same authoritative stores so a client
never has to reproduce aggregation rules or keep a second log in sync.

Mirrored in ``frontend/src/types/activity.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import Field

from .common import ContractModel, NonEmptyStr, Timestamp

ActivityKind = Literal["asset", "publish", "job", "comment"]
# Mirrors the frontend BadgeTone union so an event's tone can be passed directly
# to a badge without a client-side remapping table.
ActivityTone = Literal["neutral", "accent", "success", "warning", "danger", "info"]


class ActivityEvent(ContractModel):
    """One entry in the workspace activity feed.

    ``id`` is stable (``<kind>-<entity-id>``) so clients can dedupe across
    refetches and use it as a React key, exactly like ``AuditEvent``.
    """

    id: NonEmptyStr
    kind: ActivityKind
    project_id: UUID
    actor_id: UUID
    label: NonEmptyStr
    detail: NonEmptyStr
    timestamp: Timestamp
    tone: ActivityTone


class ActivityFeed(ContractModel):
    """Newest-first activity feed plus the total matches before limiting."""

    events: list[ActivityEvent] = Field(default_factory=list)
    total: int = Field(ge=0)


__all__ = ["ActivityEvent", "ActivityFeed", "ActivityKind", "ActivityTone"]

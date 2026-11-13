"""Orchestration, collaboration and storage helper contracts."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import Field

from .common import ContractModel, Metadata, NonEmptyStr, Timestamp

OrchestrationStage = Literal["plan", "resolve", "submit", "await", "collect", "done"]
PresenceState = Literal["online", "away", "offline"]
StorageQuotaUnit = Literal["bytes", "objects"]


class OrchestrationPlanStep(ContractModel):
    step_id: NonEmptyStr
    operation_id: NonEmptyStr
    depends_on: list[str] = Field(default_factory=list)
    settings: Metadata = Field(default_factory=dict)


class OrchestrationPlan(ContractModel):
    """Execution plan produced by the orchestration layer (not source of truth)."""

    plan_id: UUID
    project_id: UUID
    goal: str | None = None
    steps: list[OrchestrationPlanStep] = Field(default_factory=list)
    created_at: Timestamp


class OrchestrationRunRequest(ContractModel):
    project_id: UUID
    conversation_id: UUID | None = None
    goal: NonEmptyStr


class OrchestrationRun(ContractModel):
    run_id: UUID
    plan_id: UUID
    stage: OrchestrationStage
    job_ids: list[UUID] = Field(default_factory=list)
    created_at: Timestamp


class Presence(ContractModel):
    user_id: UUID
    project_id: UUID
    state: PresenceState
    last_seen_at: Timestamp


class Comment(ContractModel):
    id: UUID
    project_id: UUID
    asset_id: UUID | None = None
    author_id: UUID
    body: NonEmptyStr
    created_at: Timestamp


class StorageQuota(ContractModel):
    used: int = Field(ge=0)
    limit: int = Field(ge=0)
    unit: StorageQuotaUnit = "bytes"


class StorageStats(ContractModel):
    project_id: UUID
    quota: StorageQuota
    object_count: int = Field(ge=0, default=0)


__all__ = [
    "Comment",
    "OrchestrationPlan",
    "OrchestrationPlanStep",
    "OrchestrationRun",
    "OrchestrationRunRequest",
    "OrchestrationStage",
    "Presence",
    "PresenceState",
    "StorageQuota",
    "StorageQuotaUnit",
    "StorageStats",
]

"""Operation catalog and job lifecycle contracts.

Operations are application-level creative operations (text-to-image, upscale,
etc.) described by a versioned schema. Jobs are their asynchronous executions.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import Field

from .common import ContractModel, Metadata, NonEmptyStr, SemVer, Timestamp
from .conversation import StreamEvent

JobStatus = Literal[
    "queued",
    "running",
    "succeeded",
    "failed",
    "canceled",
]
JobEventType = Literal[
    "status",
    "progress",
    "intermediate",
    "result",
    "error",
    "log",
]
SettingType = Literal["string", "number", "integer", "boolean", "enum"]


class OperationSetting(ContractModel):
    """A user-facing setting exposed by an operation (never raw backend params)."""

    key: NonEmptyStr
    label: NonEmptyStr
    type: SettingType
    required: bool = False
    default: str | int | float | bool | None = None
    choices: list[str] = Field(default_factory=list)
    minimum: float | None = None
    maximum: float | None = None
    description: str | None = None


class OperationIO(ContractModel):
    asset_types: list[str] = Field(default_factory=list)
    required: bool = True
    multiple: bool = False


class OperationSpec(ContractModel):
    id: NonEmptyStr
    title: NonEmptyStr
    description: str | None = None
    schema_version: SemVer
    input: OperationIO = Field(default_factory=OperationIO)
    output: OperationIO = Field(default_factory=OperationIO)
    settings: list[OperationSetting] = Field(default_factory=list)
    streaming: bool = False
    provider_ids: list[str] = Field(default_factory=list)


class OperationCatalog(ContractModel):
    version: NonEmptyStr
    operations: list[OperationSpec] = Field(default_factory=list)


class OperationRequest(ContractModel):
    """Submission payload for an operation."""

    operation_id: NonEmptyStr
    schema_version: SemVer
    project_id: UUID
    input_asset_ids: list[UUID] = Field(default_factory=list)
    prompt: str | None = None
    settings: Metadata = Field(default_factory=dict)
    provider_id: str | None = None
    conversation_id: UUID | None = None


class JobResult(ContractModel):
    asset_ids: list[UUID] = Field(default_factory=list)
    text: str | None = None
    metadata: Metadata = Field(default_factory=dict)


class JobError(ContractModel):
    code: NonEmptyStr
    message: NonEmptyStr
    retryable: bool = False


class Job(ContractModel):
    id: UUID
    project_id: UUID
    operation_id: NonEmptyStr
    schema_version: SemVer
    status: JobStatus
    progress: float = Field(ge=0.0, le=1.0, default=0.0)
    result: JobResult | None = None
    error: JobError | None = None
    attempt: int = Field(ge=1, default=1)
    created_by: UUID
    created_at: Timestamp
    started_at: Timestamp | None = None
    finished_at: Timestamp | None = None


class JobEvent(ContractModel):
    type: JobEventType
    job_id: UUID
    seq: int = Field(ge=0)
    status: JobStatus | None = None
    progress: float | None = Field(default=None, ge=0.0, le=1.0)
    message: str | None = None
    asset_id: UUID | None = None
    error: JobError | None = None
    timestamp: Timestamp


class JobEventFrame(ContractModel):
    """Recoverable stream: resume from the last observed `seq`."""

    job_id: UUID
    events: list[JobEvent] = Field(default_factory=list)
    next_seq: int = Field(ge=0, default=0)


class JobListQuery(ContractModel):
    project_id: UUID | None = None
    status: JobStatus | None = None
    limit: int = Field(ge=1, le=200, default=50)


class JobCancelRequest(ContractModel):
    reason: str | None = None


class JobRetryRequest(ContractModel):
    """Idempotency key makes retries safe to repeat."""

    idempotency_key: NonEmptyStr


__all__ = [
    "Job",
    "JobCancelRequest",
    "JobError",
    "JobEvent",
    "JobEventFrame",
    "JobEventType",
    "JobListQuery",
    "JobResult",
    "JobRetryRequest",
    "JobStatus",
    "OperationCatalog",
    "OperationIO",
    "OperationRequest",
    "OperationSetting",
    "OperationSpec",
    "SettingType",
    "StreamEvent",
]

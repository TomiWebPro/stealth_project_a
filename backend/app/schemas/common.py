"""Shared primitives used across API domains.

These are the canonical wire contracts. Field names, value sets and defaults are
mirrored 1:1 in frontend/src/types. Keep both sides in sync — parity is enforced
by tests/test_contract_parity.py.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# Bumped whenever a shared contract changes in a backwards-incompatible way.
API_VERSION = "v1"

# Prefix every REST path is mounted under, e.g. "/api/v1/health".
API_PREFIX = "/api/v1"


class ContractModel(BaseModel):
    """Base class for all request/response contracts."""

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        ser_json_timedelta="float",
    )


# --- Identifiers and scalars -------------------------------------------------

NonEmptyStr = Annotated[str, StringConstraints(min_length=1, max_length=1024)]
Slug = Annotated[str, StringConstraints(pattern=r"^[a-z0-9][a-z0-9-]{0,63}$")]
SemVer = Annotated[
    str, StringConstraints(pattern=r"^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$")
]
# ISO-8601 UTC timestamp, e.g. "2026-01-01T00:00:00Z".
Timestamp = datetime
Metadata = dict[str, Any]
# Deliberately loose, dependency-free email check. `pydantic.EmailStr` would
# require the optional `email-validator` package; the TS side uses an identical
# regex so both sides accept exactly the same inputs.
Email = Annotated[
    str,
    StringConstraints(
        min_length=3,
        max_length=320,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        strip_whitespace=True,
    ),
]


class Empty(ContractModel):
    """Explicit empty payload (never `null`) for responses with no body."""


class ErrorDetail(ContractModel):
    field: str | None = None
    message: NonEmptyStr


class ErrorBody(ContractModel):
    """Machine-readable error envelope returned for every non-2xx response."""

    code: NonEmptyStr
    message: NonEmptyStr
    details: list[ErrorDetail] = Field(default_factory=list)
    request_id: str | None = None


class ErrorResponse(ContractModel):
    error: ErrorBody


class PageInfo(ContractModel):
    """Cursor pagination envelope info."""

    limit: int = Field(ge=1, le=200)
    next_cursor: str | None = None
    has_more: bool = False


HealthStatus = Literal["ok", "degraded", "down"]


class HealthResponse(ContractModel):
    status: HealthStatus
    version: NonEmptyStr


class VersionResponse(ContractModel):
    api_version: NonEmptyStr
    build: NonEmptyStr


def utcnow() -> datetime:
    """Timezone-aware UTC now (single source of truth for timestamps)."""
    from datetime import UTC

    return datetime.now(UTC)


__all__ = [
    "API_PREFIX",
    "API_VERSION",
    "ContractModel",
    "Email",
    "Empty",
    "ErrorBody",
    "ErrorDetail",
    "ErrorResponse",
    "HealthResponse",
    "HealthStatus",
    "Metadata",
    "NonEmptyStr",
    "PageInfo",
    "SemVer",
    "Slug",
    "Timestamp",
    "UUID",
    "VersionResponse",
    "utcnow",
]

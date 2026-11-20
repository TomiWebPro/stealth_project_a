"""Authoritative single-upload-ticket overview contracts.

The upload detail UI needs a compact, single-ticket snapshot: ticket identity and
project context, lifecycle status and byte accounting, derived progress/expiry
signals and the authoritative upload activity of the ticket's project. Deriving
it on the backend — where the ``UPLOADS`` store and projects are authoritative —
keeps every client reading the same numbers and avoids reproducing the projection
per screen.

Everything is computed fresh from the authoritative stores on every call: there
is no second index to drift and removing the router leaves no collection behind.
The ``counts`` block reuses the exact per-project aggregation behind
``/uploads/stats`` (``total``/``completed``/``bytes_uploaded``), so the single
ticket view can never disagree with that snapshot. Mirrors
``frontend/src/types/uploadOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp
from .upload_stats import UploadStatus


class UploadOverviewCounts(ContractModel):
    """Whole-project upload activity for the ticket's project, never bounded."""

    project_tickets: int = Field(ge=0)
    project_completed: int = Field(ge=0)
    project_bytes_uploaded: int = Field(ge=0)


class UploadOverview(ContractModel):
    """A single-upload snapshot: identity, lifecycle and project activity.

    ``bytes_remaining`` and ``progress`` are derived from the authoritative byte
    fields and ``expired`` from the injected clock; ``counts`` is the whole-project
    upload activity and is never bounded. A ticket whose project no longer exists
    keeps a stable ``Unknown project`` name rather than being dropped.
    """

    upload_id: UUID
    project_id: UUID
    project_name: str
    filename: str
    content_type: str
    status: UploadStatus
    declared_size: int = Field(ge=0)
    size_bytes: int = Field(ge=0)
    bytes_remaining: int = Field(ge=0)
    progress: float = Field(ge=0.0, le=1.0)
    expired: bool
    created_at: Timestamp
    expires_at: Timestamp
    counts: UploadOverviewCounts
    generated_at: Timestamp


__all__ = [
    "UploadOverview",
    "UploadOverviewCounts",
]

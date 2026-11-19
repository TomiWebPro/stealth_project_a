"""Authoritative upload statistics contracts.

Upload tickets live in the authoritative ``UPLOADS`` collection (see
``repositories/uploads.py``). This snapshot reports the size and shape of that
collection: how many tickets exist, how they split across the canonical
lifecycle states, how many bytes have actually been uploaded, per-project
activity, the newest ticket's creation time and when the snapshot was
generated.

Everything is computed fresh from the authoritative store on every call; there
is no second index to drift. ``by_status`` is zero-filled over every canonical
``UploadStatus`` in its documented order so a UI can read a bucket without
guarding for a missing key. ``by_project`` only lists projects that have at
least one upload ticket and is deterministically ordered. An optional
``project_id`` narrows the same derivation to one project.

Mirrored in ``frontend/src/types/uploadStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp

#: Canonical upload-ticket lifecycle states (single source of truth for the
#: repository's ``UploadRecord.status`` and the zero-filled breakdown below).
UploadStatus = Literal["pending", "complete"]


class UploadStatusCount(ContractModel):
    """Number of upload tickets in one canonical lifecycle state."""

    status: UploadStatus
    count: int = Field(ge=0)


class UploadProjectCount(ContractModel):
    """Upload activity for one project."""

    project_id: UUID
    total: int = Field(ge=0)
    completed: int = Field(ge=0)
    bytes_uploaded: int = Field(ge=0)


class UploadStats(ContractModel):
    """Upload-ticket metrics derived from the authoritative upload store.

    ``bytes_uploaded`` sums ``size_bytes`` over *completed* tickets only.
    ``by_status`` is zero-filled over every canonical status. ``by_project`` is
    ordered by descending ticket count then project id so the wire shape is
    identical across storage backends. ``newest_upload_at`` is ``None`` when
    there are no tickets in scope.
    """

    total_tickets: int = Field(ge=0)
    pending: int = Field(ge=0)
    completed: int = Field(ge=0)
    bytes_uploaded: int = Field(ge=0)
    by_status: list[UploadStatusCount] = Field(default_factory=list)
    by_project: list[UploadProjectCount] = Field(default_factory=list)
    newest_upload_at: Timestamp | None = None
    generated_at: Timestamp


__all__ = [
    "UploadStatus",
    "UploadStatusCount",
    "UploadProjectCount",
    "UploadStats",
]

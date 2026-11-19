"""Authoritative upload-ticket feed contracts.

``GET /uploads/feed`` is the feed companion to ``GET /uploads/stats``: a newest-
first view of upload tickets, each projected from the records in the authoritative
``UPLOADS`` collection (see ``repositories/uploads.py``). It is derived fresh on
every call (no second index), so the feed can never drift from the upload snapshot
or from what actually exists.

Every item carries the ticket and project identity (id + project display name),
the filename/content type, the canonical lifecycle status, the declared and
actually-uploaded byte sizes, and the creation/expiry timestamps. The internal
storage path is deliberately not exposed. Feed ordering is by descending
``(created_at, upload_id)``, giving a byte-for-byte identical wire shape across the
in-memory and SQLite stores. An optional ``project_id`` narrows the same
derivation to one project.

Mirrored in ``frontend/src/types/uploadFeed.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp
from .upload_stats import UploadStatus


class UploadFeedItem(ContractModel):
    """One upload ticket projected from the authoritative upload store."""

    upload_id: UUID
    project_id: UUID
    project_name: str
    filename: str
    content_type: str
    status: UploadStatus
    declared_size: int = Field(ge=0)
    size_bytes: int = Field(ge=0)
    created_at: Timestamp
    expires_at: Timestamp


class UploadFeed(ContractModel):
    """A bounded, newest-first page of upload tickets with a whole-scope total.

    ``total`` counts every upload ticket in scope before the ``limit`` page is
    applied, so a consumer can show the feed size and the newest page in one
    call. ``items`` is empty when there are no tickets in scope.
    """

    items: list[UploadFeedItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    generated_at: Timestamp


__all__ = [
    "UploadFeedItem",
    "UploadFeed",
]

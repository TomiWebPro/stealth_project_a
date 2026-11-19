"""Authoritative search index statistics contracts.

The cross-domain search (``schemas/search``) derives project/asset/conversation
matches from the authoritative stores on every call — there is no second index
to drift. This snapshot reports the size of that searchable document set: how
many documents exist, how they are distributed across the canonical search
result kinds, how recent the newest indexed document is and when the snapshot
was generated.

Everything is computed fresh from the authoritative stores on every call.
``by_kind`` is zero-filled over every canonical ``SearchResultKind`` in its
documented order so a UI can read a bucket without guarding for a missing key.
Soft-deleted assets are excluded, matching ``/search``. An optional
``project_id`` narrows the same derivation to one project.

Mirrored in ``frontend/src/types/searchStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from pydantic import Field

from .common import ContractModel, Timestamp
from .search import SearchResultKind


class SearchKindCount(ContractModel):
    """Number of searchable documents of one canonical kind."""

    kind: SearchResultKind
    count: int = Field(ge=0)


class SearchStats(ContractModel):
    """Searchable-document metrics derived from the authoritative stores.

    ``by_kind`` is zero-filled over every canonical search kind so a UI can read
    a bucket without guarding for a missing key. Soft-deleted assets are excluded.
    ``newest_document_at`` is ``None`` when there are no documents in scope.
    """

    total_documents: int = Field(ge=0)
    by_kind: list[SearchKindCount] = Field(default_factory=list)
    newest_document_at: Timestamp | None = None
    generated_at: Timestamp


__all__ = [
    "SearchKindCount",
    "SearchStats",
]

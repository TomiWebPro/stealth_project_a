"""Authoritative extension installation feed contracts.

``GET /extensions/feed`` is a newest-first, workspace-wide view of installed
extensions derived fresh from the authoritative ``EXTENSIONS`` collection — the
same store ``GET /extensions`` lists and ``GET /extensions/stats`` aggregates —
so there is no second index and no cached feed to drift. It complements
``GET /extensions`` (registry-ordered list) and ``GET /extensions/stats``
(aggregates) by projecting every installed extension with its manifest display
fields and trust flags in install-recency order.

Each item carries the deterministic extension id (derived from the manifest id,
matching installation), manifest identity, name/version/publisher/type, lifecycle
status, trust flags and the recorded install time. ``ExtensionFeed`` carries a
whole-scope ``total`` counted before the ``limit`` page is applied, so a UI can
show both the feed depth and a bounded page in a single call. Optional ``type``
and ``status`` filters narrow the same derivation; invalid filter values use the
shared 422 envelope at the router.

Mirrored in ``frontend/src/types/extensionFeed.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp
from .provider import ExtensionStatus, ExtensionType


class ExtensionFeedItem(ContractModel):
    """One installed extension projected from the authoritative store."""

    extension_id: UUID
    manifest_id: str
    name: str
    version: str
    publisher: str
    type: ExtensionType
    status: ExtensionStatus
    signed: bool
    verified: bool
    installed_at: Timestamp


class ExtensionFeed(ContractModel):
    """A bounded, newest-first page of installed extensions with a total.

    ``total`` counts every installed extension in scope before paging. ``items``
    holds at most ``limit`` entries in descending ``(installed_at,
    extension_id)`` order.
    """

    items: list[ExtensionFeedItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    generated_at: Timestamp


__all__ = [
    "ExtensionFeed",
    "ExtensionFeedItem",
]

"""Authoritative operation catalog feed contracts.

``GET /operations/feed`` is a bounded, deterministic view of the versioned
application-level operation catalog — the same authoritative, static registry
``POST /jobs`` validates submissions against and ``GET /operations/stats``
aggregates. It carries no second index: each item is projected fresh from the
catalog so the feed can never drift from what can actually be submitted.

Each item is a compact "operation card": identity/display fields, the canonical
``schema_version``, input/output asset types, the number of user-facing settings,
the streaming flag and the bound provider ids (sorted and deduplicated, like the
provider feed's advertised operation ids). ``provider_count`` is the size of that
deduplicated binding list. The catalog has no registration timestamp, so items are
ordered deterministically ascending by ``(title, operation_id)``; ``total`` counts
every operation in scope before the ``limit`` page is applied.

Optional ``streaming`` and ``provider_id`` filters narrow the same derivation.
Invalid filters or ``limit`` use the shared 422 envelope at the router.

Mirrored in ``frontend/src/types/operationFeed.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from pydantic import Field

from .common import ContractModel, Timestamp, NonEmptyStr, SemVer


class OperationFeedItem(ContractModel):
    """One operation projected from the authoritative catalog."""

    operation_id: NonEmptyStr
    title: NonEmptyStr
    description: str | None = None
    schema_version: SemVer
    input_types: list[str] = Field(default_factory=list)
    output_types: list[str] = Field(default_factory=list)
    settings_count: int = Field(ge=0)
    streaming: bool = False
    provider_ids: list[str] = Field(default_factory=list)
    provider_count: int = Field(ge=0)


class OperationFeed(ContractModel):
    """A bounded, deterministic page of operations with a whole-scope total.

    ``total`` counts every operation in scope before paging. ``items`` holds at
    most ``limit`` entries in ascending ``(title, operation_id)`` order.
    """

    items: list[OperationFeedItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    generated_at: Timestamp


__all__ = [
    "OperationFeed",
    "OperationFeedItem",
]

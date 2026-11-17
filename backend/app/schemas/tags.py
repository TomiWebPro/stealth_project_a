"""Authoritative asset tag facet contracts.

Assets carry free-form tags. This index derives a deduplicated, counted set of
tags from the authoritative asset store so clients can render a tag cloud or
filter facet without rebuilding the aggregation or keeping a second index in
sync. Deleted assets are excluded.

Mirrored in ``frontend/src/types/tags.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from pydantic import Field

from .common import ContractModel, NonEmptyStr


class TagFacet(ContractModel):
    """A single tag and the number of non-deleted assets carrying it."""

    name: NonEmptyStr
    count: int = Field(ge=1)


class TagIndex(ContractModel):
    """Most-used-first tag facets plus the total distinct tags before limiting."""

    tags: list[TagFacet] = Field(default_factory=list)
    total: int = Field(ge=0)


__all__ = ["TagFacet", "TagIndex"]

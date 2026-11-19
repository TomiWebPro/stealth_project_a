"""Authoritative operation catalog feed repository.

The feed is derived fresh from ``OPERATION_CATALOG`` — the same authoritative,
versioned, static registry ``JobRepository.submit`` validates against and
``OperationStatsRepository`` aggregates. It is a projection, not a second index:
there is no persisted feed collection and removing this router leaves nothing
behind.

The catalog has no registration timestamp, so items are ordered deterministically
ascending by ``(title, operation_id)`` for stable cross-backend output. Provider
bindings are sorted and deduplicated (matching the provider feed's advertised
operation ids) so the wire shape is byte-for-byte identical regardless of how a
future registry adapter orders them. ``total`` counts every operation in scope
before the ``limit`` page is applied. Optional ``streaming``/``provider_id``
filters narrow the same derivation; bounds/type validation happens at the router
(shared 422 envelope).

Mirrors ``frontend/src/types/operationFeed.ts`` contracts.
"""

from __future__ import annotations

from ..catalog import OPERATION_CATALOG
from ..schemas.common import utcnow
from ..schemas.operation_feed import OperationFeed, OperationFeedItem
from ..storage.base import DocumentStore
from .base import BaseRepository


class OperationFeedRepository(BaseRepository):
    def __init__(self, store: DocumentStore, clock=utcnow) -> None:
        super().__init__(store, clock)

    def feed(
        self,
        *,
        streaming: bool | None = None,
        provider_id: str | None = None,
        limit: int = 50,
    ) -> OperationFeed:
        """Build the deterministic operation feed, optionally filtered.

        ``total`` counts every operation in scope before the ``limit`` page is
        applied. Filters use exact equality on the catalog's declared flags and
        provider bindings.
        """
        items: list[OperationFeedItem] = []
        for spec in OPERATION_CATALOG.operations:
            if streaming is not None and spec.streaming != streaming:
                continue
            provider_ids = sorted(set(spec.provider_ids))
            if provider_id is not None and provider_id not in provider_ids:
                continue
            items.append(
                OperationFeedItem(
                    operation_id=spec.id,
                    title=spec.title,
                    description=spec.description,
                    schema_version=spec.schema_version,
                    input_types=list(spec.input.asset_types),
                    output_types=list(spec.output.asset_types),
                    settings_count=len(spec.settings),
                    streaming=spec.streaming,
                    provider_ids=provider_ids,
                    provider_count=len(provider_ids),
                )
            )

        items.sort(key=lambda item: (item.title, item.operation_id))

        return OperationFeed(
            items=items[:limit],
            total=len(items),
            generated_at=self.clock(),
        )


__all__ = ["OperationFeedRepository"]

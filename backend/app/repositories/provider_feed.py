"""Authoritative provider-feed repository.

The feed is derived fresh from the authoritative ``PROVIDERS`` collection — the
same store ``ProviderRepository`` reads and ``ProviderStatsRepository`` aggregates
— so it can never drift from ``GET /providers`` or ``GET /providers/stats``. There
is no persisted feed or second index; removing this router leaves no collection
behind.

The registry is static and has no registration timestamp, so items are ordered by
ascending ``(name, provider_id)`` for a stable cross-backend sequence. Operation
ids are the deduplicated ``operation_id`` values of the provider's authoritative
capabilities, sorted alphabetically; ``capability_count`` is the number of raw
capability records (so duplicate advertising is still visible). Optional
``location``/``status`` filters narrow the derivation before ``total`` is
counted. Bounds are validated at the router (shared 422 envelope).

Mirrors ``frontend/src/types/providerFeed.ts`` contracts.
"""

from __future__ import annotations

from ..schemas.common import utcnow
from ..schemas.provider import Provider, ProviderLocation, ProviderStatus
from ..schemas.provider_feed import ProviderFeed, ProviderFeedItem
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository


class ProviderFeedRepository(BaseRepository):
    def __init__(self, store: DocumentStore, clock=utcnow) -> None:
        super().__init__(store, clock)

    def feed(
        self,
        *,
        location: ProviderLocation | None = None,
        status: ProviderStatus | None = None,
        limit: int = 50,
    ) -> ProviderFeed:
        """Build the deterministic provider feed with the given scope/page.

        ``total`` counts every provider matching the filters before the ``limit``
        page is applied. ``items`` holds at most ``limit`` entries in ascending
        ``(name, provider_id)`` order.
        """
        providers = [
            provider
            for provider in self._load_all(Collections.PROVIDERS, Provider)
            if (location is None or provider.location == location)
            and (status is None or provider.status == status)
        ]
        providers.sort(key=lambda provider: (provider.name, provider.id))

        items = [
            ProviderFeedItem(
                provider_id=provider.id,
                name=provider.name,
                location=provider.location,
                status=provider.status,
                operation_ids=sorted(
                    {capability.operation_id for capability in provider.capabilities}
                ),
                capability_count=len(provider.capabilities),
            )
            for provider in providers
        ]

        return ProviderFeed(
            items=items[:limit],
            total=len(items),
            generated_at=self.clock(),
        )


__all__ = ["ProviderFeedRepository"]

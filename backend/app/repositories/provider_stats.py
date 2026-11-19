"""Authoritative provider fleet statistics repository.

Statistics are derived from the authoritative provider store on every call,
like ``ProjectStatsRepository`` and ``AssetStatsRepository``: there is no second
index to drift and removing the router leaves no collection behind.

``by_status`` and ``by_location`` are zero-filled over the canonical value
orders (from the schema Literals) so the wire shape is stable across the
in-memory and SQLite stores. ``by_operation`` aggregates advertised operations
with a deterministic ``(-providers, operation_id)`` ordering. Optional
``location``/``status`` filters narrow the derivation before any metric is
computed, so the snapshot always agrees with the filtered provider slice.

Mirrors ``frontend/src/types/providerStats.ts`` contracts.
"""

from __future__ import annotations

from collections import defaultdict
from typing import get_args

from ..schemas.common import utcnow
from ..schemas.provider import Provider, ProviderLocation, ProviderStatus
from ..schemas.provider_stats import (
    ProviderLocationCount,
    ProviderOperationStat,
    ProviderStats,
    ProviderStatusCount,
)
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository

_STATUSES = tuple(get_args(ProviderStatus))
_LOCATIONS = tuple(get_args(ProviderLocation))


class ProviderStatsRepository(BaseRepository):
    def __init__(self, store: DocumentStore, clock=utcnow) -> None:
        super().__init__(store, clock)

    def stats(
        self,
        *,
        location: ProviderLocation | None = None,
        status: ProviderStatus | None = None,
    ) -> ProviderStats:
        """Build fresh provider fleet metrics, optionally filtered."""
        providers = [
            provider
            for provider in self._load_all(Collections.PROVIDERS, Provider)
            if (location is None or provider.location == location)
            and (status is None or provider.status == status)
        ]

        status_counts: dict[str, int] = defaultdict(int)
        location_counts: dict[str, int] = defaultdict(int)
        operation_providers: dict[str, int] = defaultdict(int)
        operation_available: dict[str, int] = defaultdict(int)
        total_capabilities = 0

        for provider in providers:
            status_counts[provider.status] += 1
            location_counts[provider.location] += 1
            for capability in provider.capabilities:
                total_capabilities += 1
                operation = capability.operation_id
                operation_providers[operation] += 1
                if provider.status == "available":
                    operation_available[operation] += 1

        by_status = [
            ProviderStatusCount(status=value, count=status_counts.get(value, 0))
            for value in _STATUSES
        ]
        by_location = [
            ProviderLocationCount(location=value, count=location_counts.get(value, 0))
            for value in _LOCATIONS
        ]
        by_operation = [
            ProviderOperationStat(
                operation_id=operation,
                providers=count,
                available=operation_available.get(operation, 0),
            )
            for operation, count in sorted(
                operation_providers.items(),
                key=lambda item: (-item[1], item[0]),
            )
        ]

        return ProviderStats(
            total=len(providers),
            by_status=by_status,
            by_location=by_location,
            available=status_counts.get("available", 0),
            degraded=status_counts.get("degraded", 0),
            unavailable=status_counts.get("unavailable", 0),
            total_capabilities=total_capabilities,
            unique_operations=len(operation_providers),
            by_operation=by_operation,
            generated_at=self.clock(),
        )


__all__ = ["ProviderStatsRepository"]

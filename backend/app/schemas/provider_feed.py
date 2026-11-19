"""Authoritative provider-feed contracts.

``GET /providers/feed`` is a bounded, deterministic view of the provider registry
derived fresh from the authoritative ``PROVIDERS`` collection — the same store
``ProviderRepository`` reads for ``GET /providers`` and
``ProviderStatsRepository`` aggregates for ``GET /providers/stats``. There is no
second index and no cached feed to drift; removing the router leaves no
collection behind.

The provider registry is a static set of local/studio/cloud runtimes and carries
no registration timestamp, so the feed is ordered deterministically by ascending
``(name, provider_id)`` rather than by recency. Optional ``location``/``status``
filters narrow the same derivation before the ``total`` is counted, so the feed
always agrees with the filtered slice of ``/providers`` and ``/providers/stats``.
Each item projects identity/health plus a sorted list of advertised operation ids
(from the authoritative ``ProviderCapability`` records) and a capability count.

``ProviderFeed`` carries the whole-scope ``total`` counted before the ``limit``
page is applied, so a browser can show both the feed depth and a bounded page in
a single call. An invalid ``limit`` uses the shared 422 envelope at the router.

Mirrored in ``frontend/src/types/providerFeed.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from pydantic import Field

from .common import ContractModel, Timestamp
from .provider import ProviderLocation, ProviderStatus


class ProviderFeedItem(ContractModel):
    """One provider projected from the authoritative registry."""

    provider_id: str
    name: str
    location: ProviderLocation
    status: ProviderStatus
    operation_ids: list[str] = Field(default_factory=list)
    capability_count: int = Field(ge=0)


class ProviderFeed(ContractModel):
    """A bounded, deterministic page of providers with a whole-scope total.

    ``total`` counts every provider in scope before paging. ``items`` holds at
    most ``limit`` entries in ascending ``(name, provider_id)`` order.
    """

    items: list[ProviderFeedItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    generated_at: Timestamp


__all__ = [
    "ProviderFeed",
    "ProviderFeedItem",
]

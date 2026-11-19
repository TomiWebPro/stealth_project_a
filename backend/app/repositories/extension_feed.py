"""Authoritative extension installation feed repository.

The feed is derived fresh from the ``EXTENSIONS`` collection — the same store
``GET /extensions`` lists and ``GET /extensions/stats`` aggregates — so it can
never drift from either. There is no persisted feed or second index; removing
this router leaves no collection behind.

Each installed extension is projected with its manifest display fields and trust
flags. The extension id is derived deterministically from the manifest id (the
same ``uuid5`` derivation installation uses), so the feed agrees with
``GET /extensions/{id}`` without reading the store key. Items are sorted
descending ``(installed_at, extension_id)`` so the newest install comes first and
ties break deterministically across the in-memory and SQLite adapters.
``total`` counts the whole filtered feed before the ``limit`` page is applied.
Optional ``type``/``status`` filters narrow the same derivation; bound/filter
validation happens at the router (shared 422 envelope).

Mirrors ``frontend/src/types/extensionFeed.ts`` contracts.
"""

from __future__ import annotations

from uuid import NAMESPACE_URL, UUID, uuid5

from ..schemas.common import utcnow
from ..schemas.extension_feed import ExtensionFeed, ExtensionFeedItem
from ..schemas.provider import Extension, ExtensionStatus, ExtensionType
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository


def _extension_id(manifest_id: str) -> UUID:
    """Match ``ExtensionRepository._extension_id`` (installation derivation)."""
    return uuid5(NAMESPACE_URL, f"studio-extension:{manifest_id}")


class ExtensionFeedRepository(BaseRepository):
    def __init__(self, store: DocumentStore, clock=utcnow) -> None:
        super().__init__(store, clock)

    def feed(
        self,
        *,
        type: ExtensionType | None = None,
        status: ExtensionStatus | None = None,
        limit: int = 50,
    ) -> ExtensionFeed:
        """Build the newest-first installed-extension feed, optionally filtered."""
        items: list[ExtensionFeedItem] = []
        for extension in self._load_all(Collections.EXTENSIONS, Extension):
            manifest = extension.manifest
            if type is not None and manifest.type != type:
                continue
            if status is not None and extension.status != status:
                continue
            # A recorded install time is required for a recency-ordered feed.
            # Installations always set it; skip a malformed/partial document.
            if extension.installed_at is None:
                continue
            items.append(
                ExtensionFeedItem(
                    extension_id=_extension_id(manifest.id),
                    manifest_id=manifest.id,
                    name=manifest.name,
                    version=manifest.version,
                    publisher=manifest.publisher,
                    type=manifest.type,
                    status=extension.status,
                    signed=extension.signed,
                    verified=extension.verified,
                    installed_at=extension.installed_at,
                )
            )

        items.sort(
            key=lambda item: (item.installed_at, str(item.extension_id)),
            reverse=True,
        )

        return ExtensionFeed(
            items=items[:limit],
            total=len(items),
            generated_at=self.clock(),
        )


__all__ = ["ExtensionFeedRepository"]

"""Authoritative publish statistics repository.

Statistics are derived directly from the ``ASSETS`` collection — the same
authoritative store ``PublishService`` writes a ``publish_receipt`` into on
every publish — so the snapshot can never drift from what actually exists.
There is no second index and removing the router leaves no collection behind.

Only live (non-deleted) assets with a well-formed receipt are counted; a receipt
whose version, byte size or publish time is missing/malformed is ignored the
same way an orphan record is, keeping totals and the per-project breakdown
consistent. ``by_version`` is ordered by ascending version number and
``by_project`` by descending published count then project id, giving
byte-for-byte identical wire shapes across the in-memory and SQLite stores. An
unknown ``project_id`` raises ``NotFoundError`` so the shared 404 envelope is
used, matching the other project-scoped routers.

Mirrors ``frontend/src/types/publishStats.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime
from typing import Any
from uuid import UUID

from ..schemas.asset import Asset
from ..schemas.common import utcnow
from ..schemas.publish_stats import (
    PublishProjectCount,
    PublishStats,
    PublishVersionCount,
)
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository


def _parse_receipt(receipt: Any) -> tuple[int, int, datetime] | None:
    """Return ``(version, size_bytes, published_at)`` for a usable receipt."""
    if not isinstance(receipt, dict):
        return None
    version = receipt.get("version")
    size_bytes = receipt.get("size_bytes")
    published_at = receipt.get("published_at")
    if not isinstance(version, int) or isinstance(version, bool) or version < 1:
        return None
    if not isinstance(size_bytes, int) or isinstance(size_bytes, bool) or size_bytes < 0:
        return None
    if not isinstance(published_at, str):
        return None
    try:
        published = datetime.fromisoformat(published_at)
    except ValueError:
        return None
    return version, size_bytes, published


class PublishStatsRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def stats(self, *, project_id: UUID | None = None) -> PublishStats:
        """Build fresh publish metrics, optionally scoped to a project."""
        if project_id is not None:
            # Unknown-but-well-formed id uses the shared 404 envelope.
            self.projects.get_or_raise(project_id)

        receipts: list[tuple[Asset, int, int, datetime]] = []
        for asset in self._load_all(Collections.ASSETS, Asset):
            if asset.status == "deleted":
                continue
            parsed = _parse_receipt(asset.metadata.get("publish_receipt"))
            if parsed is None:
                continue
            if project_id is not None and asset.project_id != project_id:
                continue
            version, size_bytes, published = parsed
            receipts.append((asset, version, size_bytes, published))

        version_counts: Counter[int] = Counter()
        published_by_project: Counter[UUID] = Counter()
        bytes_by_project: Counter[UUID] = Counter()
        newest: datetime | None = None
        for _asset, version, size_bytes, published in receipts:
            version_counts[version] += 1
            published_by_project[_asset.project_id] += 1
            bytes_by_project[_asset.project_id] += size_bytes
            if newest is None or published > newest:
                newest = published

        by_version = [
            PublishVersionCount(version=number, count=version_counts[number])
            for number in sorted(version_counts)
        ]
        # Most-published projects first; stable project-id tie-break keeps the
        # order identical across the memory and SQLite stores.
        by_project = [
            PublishProjectCount(
                project_id=current_id,
                published=count,
                bytes=bytes_by_project[current_id],
            )
            for current_id, count in sorted(
                published_by_project.items(), key=lambda item: (-item[1], str(item[0]))
            )
        ]

        return PublishStats(
            total_published=len(receipts),
            total_bytes=sum(size_bytes for _asset, _version, size_bytes, _time in receipts),
            by_version=by_version,
            by_project=by_project,
            newest_published_at=newest,
            generated_at=self.clock(),
        )


__all__ = ["PublishStatsRepository"]

"""Authoritative activity statistics repository.

Activity statistics are aggregated from the same event derivation as the
workspace activity feed (``ActivityRepository.feed``), so the feed and the
snapshot can never drift: there is no second index to maintain and removing the
router leaves no collection behind.

``by_kind`` is zero-filled over the canonical activity kinds so the wire shape is
identical across the in-memory and SQLite stores; ``by_project`` is sorted by
descending event count then project id for deterministic cross-backend ordering.
An unknown ``project_id`` raises ``NotFoundError`` (via the feed) so the shared
404 envelope is used, matching the other project-scoped routers.

Mirrors ``frontend/src/types/activityStats.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import get_args
from uuid import UUID

from ..schemas.activity import ActivityKind
from ..schemas.activity_stats import (
    ActivityKindCount,
    ActivityProjectCount,
    ActivityStats,
)
from ..schemas.common import utcnow
from .activity import ActivityRepository
from .base import BaseRepository

_KINDS = tuple(get_args(ActivityKind))
# The feed caps its page at the HTTP layer (Query le=200); the repository itself
# has no cap, so an effectively unlimited limit yields every derived event.
_ALL_EVENTS = 10**9


class ActivityStatsRepository(BaseRepository):
    def __init__(self, activity: ActivityRepository, clock=utcnow) -> None:
        super().__init__(activity.store, clock)
        self.activity = activity

    def stats(self, *, project_id: UUID | None = None) -> ActivityStats:
        """Build fresh activity metrics, optionally scoped to a project."""
        # feed() validates/404s an unknown project and derives every event from
        # the authoritative stores; reuse it so stats and the feed stay in sync.
        feed = self.activity.feed(project_id=project_id, limit=_ALL_EVENTS)
        events = feed.events

        kind_counts: Counter[str] = Counter(event.kind for event in events)
        by_kind = [
            ActivityKindCount(kind=kind, count=kind_counts.get(kind, 0))
            for kind in _KINDS
        ]

        events_by_project: Counter[UUID] = Counter(event.project_id for event in events)
        actors_by_project: dict[UUID, set[UUID]] = defaultdict(set)
        for event in events:
            actors_by_project[event.project_id].add(event.actor_id)
        by_project = [
            ActivityProjectCount(
                project_id=current_id,
                events=events_by_project.get(current_id, 0),
                participants=len(actors_by_project.get(current_id, set())),
            )
            for current_id in sorted(
                events_by_project,
                key=lambda item: (-events_by_project[item], str(item)),
            )
        ]

        participants = {event.actor_id for event in events}
        newest_event = max(
            events,
            key=lambda event: (event.timestamp, event.id),
            default=None,
        )

        return ActivityStats(
            total_events=feed.total,
            total_participants=len(participants),
            by_kind=by_kind,
            by_project=by_project,
            newest_event_at=newest_event.timestamp if newest_event is not None else None,
            generated_at=self.clock(),
        )


__all__ = ["ActivityStatsRepository"]

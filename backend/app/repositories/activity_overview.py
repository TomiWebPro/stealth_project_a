"""Authoritative single activity event overview repository.

The snapshot is derived fresh from the same authoritative event derivation as
``ActivityRepository.feed`` (which backs ``GET /activity`` and ``GET /activity/stats``)
on every call: there is no second index to drift and removing the router leaves no
collection behind. The event is found by its stable ``<kind>-<entity-id>`` id; its
project-scoped ``by_kind`` buckets and totals use the exact canonical derivation as
``/activity/stats``, and its sibling page reuses the canonical ``ActivityEvent``
wire shape, so the views cannot disagree.

A malformed id (unknown kind prefix or non-UUID entity id) raises
``InvalidRequestError`` for the shared 422 envelope; a well-formed id with no
matching live event raises ``NotFoundError`` for the shared 404
``activity_not_found`` envelope. Bounds validation happens at the router.

Mirrors ``frontend/src/types/activityOverview.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter
from typing import get_args
from uuid import UUID

from ..errors import InvalidRequestError, NotFoundError
from ..schemas.activity import ActivityKind
from ..schemas.activity_overview import ActivityOverview, ActivityOverviewCounts
from ..schemas.activity_stats import ActivityKindCount
from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..storage.base import Collections, DocumentStore
from .activity import ActivityRepository
from .asset_feed import _UNKNOWN_PROJECT_NAME
from .base import BaseRepository
from .projects import ProjectRepository

_KINDS = tuple(get_args(ActivityKind))
# The feed caps its page at the HTTP layer (Query le=200); the repository itself
# has no cap, so an effectively unlimited limit yields every derived event.
_ALL_EVENTS = 10**9


class ActivityOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        activity: ActivityRepository,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.activity = activity
        self.projects = projects

    def overview(self, event_id: str, *, recent_limit: int = 5) -> ActivityOverview:
        """Build a fresh snapshot for one activity event."""
        prefix, separator, raw_entity = event_id.partition("-")
        if separator == "" or prefix not in _KINDS:
            raise InvalidRequestError(
                f"Malformed activity event id '{event_id}'.",
                code="validation_error",
                details=[("event_id", "Expected '<kind>-<uuid>' with a known kind")],
            )
        try:
            UUID(raw_entity)
        except ValueError as exc:
            raise InvalidRequestError(
                f"Malformed activity event id '{event_id}'.",
                code="validation_error",
                details=[("event_id", "Expected a UUID after the kind prefix")],
            ) from exc

        # Reuse the canonical feed derivation so this view cannot drift from
        # /activity and /activity/stats (no second index to maintain).
        feed = self.activity.feed(limit=_ALL_EVENTS)
        events = feed.events
        event = next((candidate for candidate in events if candidate.id == event_id), None)
        if event is None:
            raise NotFoundError("activity", event_id, code="activity_not_found")

        project_names = {
            candidate.id: candidate.name
            for candidate in self._load_all(Collections.PROJECTS, Project)
        }
        project_events = [
            candidate for candidate in events if candidate.project_id == event.project_id
        ]

        kind_counts: Counter[str] = Counter(item.kind for item in project_events)
        by_kind = [
            ActivityKindCount(kind=kind, count=kind_counts.get(kind, 0))
            for kind in _KINDS
        ]
        counts = ActivityOverviewCounts(
            total_events=len(project_events),
            total_participants=len({item.actor_id for item in project_events}),
            workspace_events=feed.total,
            by_kind=by_kind,
        )

        siblings = sorted(
            project_events,
            key=lambda item: (item.timestamp, item.id),
            reverse=True,
        )

        return ActivityOverview(
            id=event.id,
            kind=event.kind,
            project_id=event.project_id,
            project_name=project_names.get(event.project_id, _UNKNOWN_PROJECT_NAME),
            actor_id=event.actor_id,
            label=event.label,
            detail=event.detail,
            timestamp=event.timestamp,
            tone=event.tone,
            counts=counts,
            recent_events=siblings[:recent_limit],
            generated_at=self.clock(),
        )


__all__ = ["ActivityOverviewRepository"]

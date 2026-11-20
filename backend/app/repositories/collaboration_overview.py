"""Authoritative single collaboration-signal overview repository.

The snapshot is derived fresh from the same authoritative feed derivation as
``CollaborationFeedRepository.feed`` (which backs ``GET /collaboration/feed`` and
shares the presence/comment stores ``GET /collaboration/stats`` aggregates) on
every call: there is no second index to drift and removing the router leaves no
collection behind. The signal is found by its stable
``<signal>:<project_id>:<signal_id>`` key; its project-scoped ``by_state`` buckets
and totals use the canonical ``PresenceState`` set and ``PresenceStateCount``
shape as ``/collaboration/stats``, and its sibling page reuses the canonical
``CollaborationFeedItem`` wire shape, so the views cannot disagree.

A malformed key (unknown signal kind, missing/extra components or non-UUID ids)
raises ``InvalidRequestError`` for the shared 422 envelope; a well-formed key with
no matching live signal raises ``NotFoundError`` for the shared 404
``collaboration_signal_not_found`` envelope. Bounds validation happens at the
router.

Mirrors ``frontend/src/types/collaborationOverview.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter
from typing import get_args
from uuid import UUID

from ..errors import InvalidRequestError, NotFoundError
from ..schemas.auth import Project
from ..schemas.collaboration_feed import CollaborationFeedItem, CollaborationSignal
from ..schemas.collaboration_overview import (
    CollaborationOverview,
    CollaborationOverviewCounts,
)
from ..schemas.collaboration_stats import PresenceStateCount
from ..schemas.common import utcnow
from ..schemas.orchestration import PresenceState
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .collaboration_feed import CollaborationFeedRepository

_SIGNALS = tuple(get_args(CollaborationSignal))
_STATES = tuple(get_args(PresenceState))
# The feed caps its page at the HTTP layer (Query le=200); the repository itself
# has no cap, so an effectively unlimited limit yields every derived signal.
_ALL_SIGNALS = 10**9
_UNKNOWN_PROJECT_NAME = "Unknown project"
_SEPARATOR = ":"


class CollaborationOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        feed: CollaborationFeedRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.feed = feed

    def overview(self, signal_key: str, *, recent_limit: int = 5) -> CollaborationOverview:
        """Build a fresh snapshot for one collaboration signal."""
        parts = signal_key.split(_SEPARATOR)
        if len(parts) != 3 or not all(parts) or parts[0] not in _SIGNALS:
            raise InvalidRequestError(
                f"Malformed collaboration signal key '{signal_key}'.",
                code="validation_error",
                details=[
                    (
                        "signal_key",
                        "Expected '<signal>:<project-id>:<signal-id>' with a known signal",
                    )
                ],
            )
        raw_signal, raw_project, raw_signal_id = parts
        for field, value in (("project_id", raw_project), ("signal_id", raw_signal_id)):
            try:
                UUID(value)
            except ValueError as exc:
                raise InvalidRequestError(
                    f"Malformed collaboration signal key '{signal_key}'.",
                    code="validation_error",
                    details=[(field, "Expected a UUID")],
                ) from exc

        project_id = UUID(raw_project)
        signal_id = UUID(raw_signal_id)

        # Reuse the canonical feed derivation so this view cannot drift from
        # /collaboration/feed and /collaboration/stats (no second index).
        feed = self.feed.feed(limit=_ALL_SIGNALS)
        signal = next(
            (
                item
                for item in feed.items
                if item.signal == raw_signal
                and item.project_id == project_id
                and item.signal_id == signal_id
            ),
            None,
        )
        if signal is None:
            raise NotFoundError(
                "collaboration_signal", signal_key, code="collaboration_signal_not_found"
            )

        project_names = {
            candidate.id: candidate.name
            for candidate in self._load_all(Collections.PROJECTS, Project)
        }
        project_signals = [
            item for item in feed.items if item.project_id == signal.project_id
        ]

        presence_states = Counter(
            item.state for item in project_signals if item.signal == "presence"
        )
        by_state = [
            PresenceStateCount(state=state, count=presence_states.get(state, 0))
            for state in _STATES
        ]
        counts = CollaborationOverviewCounts(
            project_signals=len(project_signals),
            project_presence=presence_states.total(),
            project_comments=sum(1 for item in project_signals if item.signal == "comment"),
            project_participants=len({item.actor_id for item in project_signals}),
            workspace_signals=feed.total,
            by_state=by_state,
        )

        siblings = sorted(
            project_signals,
            key=lambda item: (
                item.occurred_at,
                str(item.signal_id),
                item.signal,
                str(item.project_id),
            ),
            reverse=True,
        )

        return CollaborationOverview(
            signal_id=signal.signal_id,
            signal=signal.signal,
            project_id=signal.project_id,
            project_name=project_names.get(signal.project_id, _UNKNOWN_PROJECT_NAME),
            actor_id=signal.actor_id,
            state=signal.state,
            body=signal.body,
            asset_id=signal.asset_id,
            occurred_at=signal.occurred_at,
            counts=counts,
            recent_signals=siblings[:recent_limit],
            generated_at=self.clock(),
        )


__all__ = ["CollaborationOverviewRepository"]

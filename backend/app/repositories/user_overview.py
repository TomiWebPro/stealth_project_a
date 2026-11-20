"""Authoritative single-user overview repository.

The snapshot is derived fresh from the authoritative auth/project/conversation/
comment/presence stores on every call, like ``OrganizationOverviewRepository``
and ``ProjectOverviewRepository``: there is no second index to drift and removing
the router leaves no collection behind. Membership is read from the authoritative
``MEMBERS`` collection with organization names joined from ``ORGANIZATIONS``, so
role/identity data cannot disagree with ``GET /orgs/{id}/members``.

Malformed membership documents (missing/invalid ``_org_id`` or an unparseable
member) are skipped so one bad record cannot break the whole profile. Unknown
organization names use a stable "Unknown organization" fallback. ``counts``
describe the whole scope and are never bounded by ``recent_limit``; the two
recent pages use the same ``(created_at, id)`` newest-first tie-break across both
storage adapters.

An unknown user uses the shared 404 ``user_not_found`` envelope; the
``recent_limit`` bound is validated at the router (shared 422 envelope).

Mirrors ``frontend/src/types/userOverview.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import ValidationError

from ..errors import NotFoundError
from ..schemas.auth import Member, Organization, Project, User
from ..schemas.common import utcnow
from ..schemas.conversation import Conversation
from ..schemas.orchestration import Comment, Presence
from ..schemas.user_overview import UserMembership, UserOverview, UserOverviewCounts
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository

_UNKNOWN_ORG_NAME = "Unknown organization"


class UserOverviewRepository(BaseRepository):
    def __init__(self, store: DocumentStore, clock=utcnow) -> None:
        super().__init__(store, clock)

    def overview(self, user_id: UUID, *, recent_limit: int = 5) -> UserOverview:
        """Build a fresh snapshot for one user, newest authored items first."""
        user = self._load(Collections.USERS, str(user_id), User)
        if user is None:
            raise NotFoundError("user", str(user_id), code="user_not_found")

        org_names = {
            org.id: org.name
            for org in self._load_all(Collections.ORGANIZATIONS, Organization)
        }

        # Read memberships from the authoritative MEMBERS collection, joining the
        # org id stored in `_org_id`. Skip malformed/orphan documents so one bad
        # record cannot break the profile.
        memberships: list[UserMembership] = []
        for document in self.store.all(Collections.MEMBERS):
            if document.get("user_id") != str(user_id):
                continue
            try:
                org_id = UUID(str(document["_org_id"]))
                member = Member.model_validate(
                    {key: value for key, value in document.items() if key != "_org_id"}
                )
            except (KeyError, TypeError, ValueError, ValidationError):
                continue
            memberships.append(
                UserMembership(
                    org_id=org_id,
                    org_name=org_names.get(org_id, _UNKNOWN_ORG_NAME),
                    role=member.role,
                    joined_at=member.joined_at,
                )
            )

        projects = [
            project
            for project in self._load_all(Collections.PROJECTS, Project)
            if project.created_by == user_id
        ]
        conversations = [
            conversation
            for conversation in self._load_all(Collections.CONVERSATIONS, Conversation)
            if conversation.created_by == user_id
        ]
        comments = [
            comment
            for comment in self._load_all(Collections.COMMENTS, Comment)
            if comment.author_id == user_id
        ]
        presence = [
            signal
            for signal in self._load_all(Collections.PRESENCE, Presence)
            if signal.user_id == user_id
        ]

        counts = UserOverviewCounts(
            organizations=len(memberships),
            projects=len(projects),
            conversations=len(conversations),
            comments=len(comments),
            presence=len(presence),
        )
        recent_memberships = sorted(
            memberships,
            key=lambda membership: (membership.joined_at, str(membership.org_id)),
            reverse=True,
        )
        recent_projects = sorted(
            projects, key=lambda project: (project.created_at, str(project.id)), reverse=True
        )[:recent_limit]
        recent_comments = sorted(
            comments, key=lambda comment: (comment.created_at, str(comment.id)), reverse=True
        )[:recent_limit]

        return UserOverview(
            user_id=user.id,
            email=user.email,
            display_name=user.display_name,
            avatar_url=user.avatar_url,
            created_at=user.created_at,
            counts=counts,
            memberships=recent_memberships,
            recent_projects=recent_projects,
            recent_comments=recent_comments,
            generated_at=self.clock(),
        )


__all__ = ["UserOverviewRepository", "_UNKNOWN_ORG_NAME"]

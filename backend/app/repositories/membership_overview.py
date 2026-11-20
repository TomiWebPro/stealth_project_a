"""Authoritative single-membership overview repository.

The snapshot is derived fresh from the authoritative auth/project/conversation/
comment/presence stores on every call, like ``UserOverviewRepository`` and
``OrganizationOverviewRepository``: there is no second index to drift and
removing the router leaves no collection behind. The membership row is read from
the authoritative ``MEMBERS`` collection with ``_org_id`` scoping, and org/user
identity from ``ORGANIZATIONS``/``USERS``, so it cannot disagree with
``GET /orgs/{id}/members``.

Activity counts are scoped to projects that belong to the requested org and were
authored by the requested user; conversations/comments/presence are further
restricted to that user and those projects. Malformed membership documents
(wrong ``_org_id``, missing/invalid fields) are skipped so one bad record cannot
break the snapshot. ``counts`` describe the whole scope and are never bounded by
``recent_limit``; the two recent pages use the same ``(created_at, id)``
newest-first tie-break across both storage adapters.

Unknown org → shared 404 ``organization_not_found``; unknown user → shared 404
``user_not_found``; no membership row → shared 404 ``membership_not_found``.
The ``recent_limit`` bound is validated at the router (shared 422 envelope).

Mirrors ``frontend/src/types/membershipOverview.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import ValidationError

from ..errors import NotFoundError
from ..schemas.auth import Member, Organization, Project, User
from ..schemas.common import utcnow
from ..schemas.conversation import Conversation
from ..schemas.membership_overview import (
    MembershipOverview,
    MembershipOverviewCounts,
)
from ..schemas.orchestration import Comment, Presence
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository


class MembershipOverviewRepository(BaseRepository):
    def __init__(self, store: DocumentStore, clock=utcnow) -> None:
        super().__init__(store, clock)

    def overview(
        self, org_id: UUID, user_id: UUID, *, recent_limit: int = 5
    ) -> MembershipOverview:
        """Build a fresh snapshot for one org membership, newest activity first."""
        organization = self._load(Collections.ORGANIZATIONS, str(org_id), Organization)
        if organization is None:
            raise NotFoundError("organization", str(org_id), code="organization_not_found")

        user = self._load(Collections.USERS, str(user_id), User)
        if user is None:
            raise NotFoundError("user", str(user_id), code="user_not_found")

        # The membership row is authoritative for role/join date. Skip malformed
        # or org-mismatched documents so one bad record cannot break the view.
        membership: Member | None = None
        for document in self.store.all(Collections.MEMBERS):
            if document.get("user_id") != str(user_id):
                continue
            if str(document.get("_org_id")) != str(org_id):
                continue
            try:
                membership = Member.model_validate(
                    {key: value for key, value in document.items() if key != "_org_id"}
                )
            except (TypeError, ValueError, ValidationError):
                continue
            break
        if membership is None:
            raise NotFoundError(
                "membership", f"{org_id}:{user_id}", code="membership_not_found"
            )

        projects = self._load_all(Collections.PROJECTS, Project)
        org_project_ids = {project.id for project in projects if project.org_id == org_id}

        authored_projects = [
            project
            for project in projects
            if project.org_id == org_id and project.created_by == user_id
        ]
        conversations = [
            conversation
            for conversation in self._load_all(Collections.CONVERSATIONS, Conversation)
            if conversation.created_by == user_id
            and conversation.project_id in org_project_ids
        ]
        comments = [
            comment
            for comment in self._load_all(Collections.COMMENTS, Comment)
            if comment.author_id == user_id and comment.project_id in org_project_ids
        ]
        presence = [
            signal
            for signal in self._load_all(Collections.PRESENCE, Presence)
            if signal.user_id == user_id and signal.project_id in org_project_ids
        ]

        counts = MembershipOverviewCounts(
            projects=len(authored_projects),
            conversations=len(conversations),
            comments=len(comments),
            presence=len(presence),
        )
        recent_projects = sorted(
            authored_projects, key=lambda project: (project.created_at, str(project.id)), reverse=True
        )[:recent_limit]
        recent_comments = sorted(
            comments, key=lambda comment: (comment.created_at, str(comment.id)), reverse=True
        )[:recent_limit]

        return MembershipOverview(
            org_id=organization.id,
            org_name=organization.name,
            org_slug=organization.slug,
            user_id=user.id,
            email=user.email,
            display_name=user.display_name,
            avatar_url=user.avatar_url,
            role=membership.role,
            joined_at=membership.joined_at,
            counts=counts,
            recent_projects=recent_projects,
            recent_comments=recent_comments,
            generated_at=self.clock(),
        )


__all__ = ["MembershipOverviewRepository"]

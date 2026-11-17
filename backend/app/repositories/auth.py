"""Dev-local auth adapter: sessions, organizations and memberships.

This is intentionally self-contained: no external IdP, no password hashing
dependency and no network calls. Tokens are opaque random strings stored in the
same document store as everything else, so the API contract holds identically
under the in-memory and SQLite adapters. A production adapter can replace this
repository without changing any router or schema.
"""

from __future__ import annotations

import secrets
from datetime import timedelta
from uuid import NAMESPACE_URL, UUID, uuid4, uuid5

from ..errors import ApiError, ConflictError
from ..schemas.auth import (
    LoginRequest,
    Member,
    MemberInvite,
    Organization,
    OrganizationCreate,
    RefreshRequest,
    SessionResponse,
    TokenPair,
    User,
)
from ..schemas.common import utcnow
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository

DEV_EMAIL = "dev@studio.local"
DEV_PASSWORD = "studio-dev"
DEV_DISPLAY_NAME = "Studio Developer"
ACCESS_TTL = timedelta(hours=1)
REFRESH_TTL = timedelta(days=30)


def _unauthorized(code: str, message: str) -> ApiError:
    return ApiError(message, status_code=401, code=code)


class AuthRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        *,
        default_user_id: UUID,
        default_org_id: UUID,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.default_user_id = default_user_id
        self.default_org_id = default_org_id
        self._seed()

    # --- Seeding ------------------------------------------------------------

    def _seed(self) -> None:
        now = self.clock()
        user = User(
            id=self.default_user_id,
            email=DEV_EMAIL,
            display_name=DEV_DISPLAY_NAME,
            avatar_url=None,
            created_at=now,
        )
        org = Organization(
            id=self.default_org_id,
            name="Studio Org",
            slug="studio",
            created_at=now,
            metadata={},
        )
        member = Member(
            user_id=user.id,
            email=user.email,
            display_name=user.display_name,
            role="owner",
            joined_at=now,
        )
        self._save(Collections.USERS, str(user.id), user)
        self._save(Collections.ORGANIZATIONS, str(org.id), org)
        self._save_member(org.id, member)
        self._password = DEV_PASSWORD

    # --- Sessions -----------------------------------------------------------

    def login(self, payload: LoginRequest) -> SessionResponse:
        user = self._find_user_by_email(payload.email)
        if user is None or payload.password != self._password:
            raise _unauthorized("invalid_credentials", "Invalid email or password.")
        return SessionResponse(user=user, tokens=self._issue_tokens(user))

    def refresh(self, payload: RefreshRequest) -> TokenPair:
        record = self._token(payload.refresh_token)
        if record is None or record["kind"] != "refresh":
            raise _unauthorized("invalid_refresh_token", "Invalid refresh token.")
        if self._expired(record):
            raise _unauthorized("token_expired", "Refresh token has expired.")
        user = self._load(Collections.USERS, record["user_id"], User)
        if user is None:
            raise _unauthorized("invalid_refresh_token", "Invalid refresh token.")
        # Rotate: invalidate the presented refresh token and issue a fresh pair.
        self.store.delete(Collections.AUTH_TOKENS, payload.refresh_token)
        return self._issue_tokens(user)

    def session(self, access_token: str) -> SessionResponse:
        record = self._token(access_token)
        if record is None or record["kind"] != "access":
            raise _unauthorized("invalid_token", "Invalid access token.")
        if self._expired(record):
            raise _unauthorized("token_expired", "Access token has expired.")
        user = self._load(Collections.USERS, record["user_id"], User)
        if user is None:
            raise _unauthorized("invalid_token", "Invalid access token.")
        refresh_token = record.get("refresh_token")
        refresh_record = self._token(refresh_token) if refresh_token else None
        if (
            refresh_record is None
            or refresh_record.get("kind") != "refresh"
            or self._expired(refresh_record)
        ):
            # The paired refresh token was rotated away — issue a fresh pair.
            tokens = self._issue_tokens(user)
        else:
            tokens = TokenPair(
                access_token=access_token,
                refresh_token=refresh_token,
                expires_in=int(ACCESS_TTL.total_seconds()),
            )
        return SessionResponse(user=user, tokens=tokens)

    def current_user(self, access_token: str) -> User:
        return self.session(access_token).user

    # --- Organizations / members -------------------------------------------

    def list_organizations(self) -> list[Organization]:
        orgs = self._load_all(Collections.ORGANIZATIONS, Organization)
        orgs.sort(key=lambda org: (org.created_at, str(org.id)))
        return orgs

    def get_organization(self, org_id: UUID) -> Organization | None:
        return self._load(Collections.ORGANIZATIONS, str(org_id), Organization)

    def get_organization_or_raise(self, org_id: UUID) -> Organization:
        org = self.get_organization(org_id)
        if org is None:
            from ..errors import NotFoundError

            raise NotFoundError("Organization", str(org_id))
        return org

    def create_organization(
        self, payload: OrganizationCreate, *, user_id: UUID
    ) -> Organization:
        for org in self.list_organizations():
            if org.slug == payload.slug:
                raise ConflictError(
                    f"Organization slug '{payload.slug}' is already in use.",
                    code="slug_exists",
                    details=[("slug", "must be unique")],
                )
        now = self.clock()
        org = Organization(
            id=uuid4(),
            name=payload.name,
            slug=payload.slug,
            created_at=now,
            metadata={},
        )
        self._save(Collections.ORGANIZATIONS, str(org.id), org)
        self._save_member(
            org.id,
            Member(
                user_id=user_id,
                email=self.default_email(),
                display_name=DEV_DISPLAY_NAME,
                role="owner",
                joined_at=now,
            ),
        )
        return org

    def list_members(self, org_id: UUID) -> list[Member]:
        self.get_organization_or_raise(org_id)
        members = [
            Member.model_validate(
                {key: value for key, value in document.items() if key != "_org_id"}
            )
            for document in self.store.all(Collections.MEMBERS)
            if document.get("_org_id") == str(org_id)
        ]
        members.sort(key=lambda member: (member.joined_at, str(member.user_id)))
        return members

    def invite_member(self, org_id: UUID, payload: MemberInvite) -> Member:
        self.get_organization_or_raise(org_id)
        user_id = uuid5(NAMESPACE_URL, f"studio-member:{payload.email}")
        key = f"{org_id}:{user_id}"
        if self.store.get(Collections.MEMBERS, key) is not None:
            raise ConflictError(
                f"'{payload.email}' is already a member of this organization.",
                code="member_exists",
            )
        member = Member(
            user_id=user_id,
            email=payload.email,
            display_name=payload.email.split("@", 1)[0],
            role=payload.role,
            joined_at=self.clock(),
        )
        self._save_member(org_id, member)
        return member

    # --- Internals ----------------------------------------------------------

    def _save_member(self, org_id: UUID, member: Member) -> None:
        document = member.model_dump(mode="json")
        document["_org_id"] = str(org_id)
        self.store.put(
            Collections.MEMBERS, f"{org_id}:{member.user_id}", document
        )

    def default_email(self) -> str:
        return DEV_EMAIL

    def _find_user_by_email(self, email: str) -> User | None:
        needle = email.strip().lower()
        for user in self._load_all(Collections.USERS, User):
            if user.email.lower() == needle:
                return user
        return None

    def _issue_tokens(self, user: User) -> TokenPair:
        now = self.clock()
        access_token = secrets.token_urlsafe(32)
        refresh_token = secrets.token_urlsafe(32)
        self._store_token(
            access_token, "access", user.id, now + ACCESS_TTL, refresh_token
        )
        self._store_token(
            refresh_token, "refresh", user.id, now + REFRESH_TTL
        )
        return TokenPair(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=int(ACCESS_TTL.total_seconds()),
        )

    def _store_token(
        self,
        token: str,
        kind: str,
        user_id: UUID,
        expires_at,
        refresh_token: str | None = None,
    ) -> None:
        document = {
            "kind": kind,
            "user_id": str(user_id),
            "expires_at": expires_at.isoformat(),
        }
        if refresh_token is not None:
            document["refresh_token"] = refresh_token
        self.store.put(Collections.AUTH_TOKENS, token, document)

    def _token(self, token: str) -> dict | None:
        return self.store.get(Collections.AUTH_TOKENS, token)

    def _expired(self, record: dict) -> bool:
        from datetime import datetime

        expires = datetime.fromisoformat(record["expires_at"])
        if expires.tzinfo is None:
            from datetime import UTC

            expires = expires.replace(tzinfo=UTC)
        return self.clock() >= expires


__all__ = ["AuthRepository", "DEV_EMAIL", "DEV_PASSWORD"]

"""Auth and organization/membership contracts."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import Field

from .common import ContractModel, Email, Metadata, NonEmptyStr, Timestamp

MemberRole = Literal["owner", "admin", "member", "viewer"]


# --- Auth -------------------------------------------------------------------


class User(ContractModel):
    id: UUID
    email: Email
    display_name: NonEmptyStr
    avatar_url: str | None = None
    created_at: Timestamp


class LoginRequest(ContractModel):
    email: Email
    password: NonEmptyStr


class TokenPair(ContractModel):
    access_token: NonEmptyStr
    refresh_token: NonEmptyStr
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(gt=0, description="Access token lifetime in seconds")


class RefreshRequest(ContractModel):
    refresh_token: NonEmptyStr


class SessionResponse(ContractModel):
    user: User
    tokens: TokenPair


# --- Organizations ----------------------------------------------------------


class Organization(ContractModel):
    id: UUID
    name: NonEmptyStr
    slug: str
    created_at: Timestamp
    metadata: Metadata = Field(default_factory=dict)


class OrganizationCreate(ContractModel):
    name: NonEmptyStr
    slug: str


class Member(ContractModel):
    user_id: UUID
    email: Email
    display_name: NonEmptyStr
    role: MemberRole
    joined_at: Timestamp


class MemberInvite(ContractModel):
    email: Email
    role: MemberRole = "member"


# --- Projects ---------------------------------------------------------------


class Project(ContractModel):
    id: UUID
    org_id: UUID
    name: NonEmptyStr
    description: str | None = None
    created_by: UUID
    created_at: Timestamp
    updated_at: Timestamp
    archived: bool = False


class ProjectCreate(ContractModel):
    name: NonEmptyStr
    description: str | None = None


class ProjectUpdate(ContractModel):
    name: NonEmptyStr | None = None
    description: str | None = None
    archived: bool | None = None


__all__ = [
    "Member",
    "MemberInvite",
    "MemberRole",
    "LoginRequest",
    "Organization",
    "OrganizationCreate",
    "Project",
    "ProjectCreate",
    "ProjectUpdate",
    "RefreshRequest",
    "SessionResponse",
    "TokenPair",
    "User",
]

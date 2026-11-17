"""Dev-local auth/session and organization/membership endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from ..deps import (
    get_auth_repository,
    get_bearer_token,
    get_current_user_id,
)
from ..repositories.auth import AuthRepository
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

router = APIRouter(tags=["auth", "organizations"])


# --- Sessions ---------------------------------------------------------------


@router.post("/auth/login", response_model=SessionResponse)
def login(
    payload: LoginRequest,
    auth: Annotated[AuthRepository, Depends(get_auth_repository)],
) -> SessionResponse:
    return auth.login(payload)


@router.post("/auth/refresh", response_model=TokenPair)
def refresh(
    payload: RefreshRequest,
    auth: Annotated[AuthRepository, Depends(get_auth_repository)],
) -> TokenPair:
    return auth.refresh(payload)


@router.get("/auth/session", response_model=SessionResponse)
def session(
    token: Annotated[str, Depends(get_bearer_token)],
    auth: Annotated[AuthRepository, Depends(get_auth_repository)],
) -> SessionResponse:
    return auth.session(token)


@router.get("/auth/me", response_model=User)
def current_user(
    token: Annotated[str, Depends(get_bearer_token)],
    auth: Annotated[AuthRepository, Depends(get_auth_repository)],
) -> User:
    """Current user — the seam the desktop live client calls."""
    return auth.current_user(token)


# --- Organizations ----------------------------------------------------------


@router.get("/orgs", response_model=list[Organization])
@router.get("/organizations", response_model=list[Organization], include_in_schema=False)
def list_organizations(
    auth: Annotated[AuthRepository, Depends(get_auth_repository)],
) -> list[Organization]:
    return auth.list_organizations()


@router.post("/orgs", response_model=Organization, status_code=status.HTTP_201_CREATED)
def create_organization(
    payload: OrganizationCreate,
    auth: Annotated[AuthRepository, Depends(get_auth_repository)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> Organization:
    return auth.create_organization(payload, user_id=user_id)


@router.get("/orgs/{org_id}", response_model=Organization)
def get_organization(
    org_id: UUID,
    auth: Annotated[AuthRepository, Depends(get_auth_repository)],
) -> Organization:
    return auth.get_organization_or_raise(org_id)


@router.get("/orgs/{org_id}/members", response_model=list[Member])
def list_members(
    org_id: UUID,
    auth: Annotated[AuthRepository, Depends(get_auth_repository)],
) -> list[Member]:
    return auth.list_members(org_id)


@router.post(
    "/orgs/{org_id}/members",
    response_model=Member,
    status_code=status.HTTP_201_CREATED,
)
def invite_member(
    org_id: UUID,
    payload: MemberInvite,
    auth: Annotated[AuthRepository, Depends(get_auth_repository)],
) -> Member:
    return auth.invite_member(org_id, payload)


__all__ = ["router"]

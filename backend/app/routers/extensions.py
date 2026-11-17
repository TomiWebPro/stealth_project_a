"""Extension registry and installed-extension lifecycle endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from ..deps import get_extension_repository
from ..permissions import ExtensionPermissionGuard
from ..repositories.extensions import ExtensionRepository
from ..schemas.provider import (
    Extension,
    ExtensionInstallRequest,
    ExtensionInstallResult,
    ExtensionManifest,
    ExtensionStatus,
)

router = APIRouter(tags=["extensions"])


# Response/request models are local to this router (not wire contracts in
# `app.schemas`), matching the pattern used by the adapters router.
class ExtensionScopeView(BaseModel):
    extension_id: UUID
    status: ExtensionStatus
    enabled: bool
    permissions: list[str]
    capabilities: list[str]
    provider_ids: list[str]
    ui_contributions: list[str]
    signed: bool
    verified: bool


class AuthorizationRequest(BaseModel):
    permission: str | None = None
    capability: str | None = None


class AuthorizationView(BaseModel):
    extension_id: UUID
    allowed: bool
    permission: str | None = None
    capability: str | None = None
    reason: str
    scope: ExtensionScopeView


@router.get("/extensions/registry", response_model=list[ExtensionManifest])
def list_registry(
    extensions: Annotated[ExtensionRepository, Depends(get_extension_repository)],
) -> list[ExtensionManifest]:
    """Available (not necessarily installed) extensions from the stub registry."""
    return extensions.list_registry()


@router.get("/extensions", response_model=list[Extension])
def list_installed(
    extensions: Annotated[ExtensionRepository, Depends(get_extension_repository)],
) -> list[Extension]:
    return extensions.list_installed()


@router.post(
    "/extensions/install",
    response_model=ExtensionInstallResult,
    status_code=status.HTTP_201_CREATED,
)
def install_extension(
    payload: ExtensionInstallRequest,
    extensions: Annotated[ExtensionRepository, Depends(get_extension_repository)],
) -> ExtensionInstallResult:
    return extensions.install(payload)


@router.get("/extensions/{extension_id}", response_model=Extension)
def get_extension(
    extension_id: UUID,
    extensions: Annotated[ExtensionRepository, Depends(get_extension_repository)],
) -> Extension:
    return extensions.get_or_raise(extension_id)


@router.post("/extensions/{extension_id}/enable", response_model=Extension)
def enable_extension(
    extension_id: UUID,
    extensions: Annotated[ExtensionRepository, Depends(get_extension_repository)],
) -> Extension:
    return extensions.set_status(extension_id, "enabled")


@router.post("/extensions/{extension_id}/disable", response_model=Extension)
def disable_extension(
    extension_id: UUID,
    extensions: Annotated[ExtensionRepository, Depends(get_extension_repository)],
) -> Extension:
    return extensions.set_status(extension_id, "disabled")


@router.delete("/extensions/{extension_id}", status_code=status.HTTP_204_NO_CONTENT)
def uninstall_extension(
    extension_id: UUID,
    extensions: Annotated[ExtensionRepository, Depends(get_extension_repository)],
):
    extensions.uninstall(extension_id)


# --- Permission enforcement / isolation boundary -----------------------------


def _guard(
    extensions: Annotated[ExtensionRepository, Depends(get_extension_repository)],
) -> ExtensionPermissionGuard:
    return ExtensionPermissionGuard(extensions)


@router.get("/extensions/{extension_id}/permissions", response_model=ExtensionScopeView)
def extension_permissions(
    extension_id: UUID,
    guard: Annotated[ExtensionPermissionGuard, Depends(_guard)],
) -> ExtensionScopeView:
    """Effective isolation scope: declared permissions/capabilities and targets."""
    return ExtensionScopeView(**guard.scope(extension_id))


@router.post("/extensions/{extension_id}/authorize", response_model=AuthorizationView)
def authorize_extension(
    extension_id: UUID,
    payload: AuthorizationRequest,
    guard: Annotated[ExtensionPermissionGuard, Depends(_guard)],
) -> AuthorizationView:
    """Authorize a permission or capability within the extension's live scope."""
    return AuthorizationView(
        **guard.authorize(
            extension_id,
            permission=payload.permission,
            capability=payload.capability,
        )
    )


__all__ = ["router"]

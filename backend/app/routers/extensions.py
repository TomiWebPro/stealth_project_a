"""Extension registry and installed-extension lifecycle endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from ..deps import get_extension_repository
from ..repositories.extensions import ExtensionRepository
from ..schemas.provider import (
    Extension,
    ExtensionInstallRequest,
    ExtensionInstallResult,
    ExtensionManifest,
)

router = APIRouter(tags=["extensions"])


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


__all__ = ["router"]

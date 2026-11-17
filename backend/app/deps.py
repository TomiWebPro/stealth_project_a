"""FastAPI dependency providers."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, Request

from .config import Settings
from .repositories import Repositories
from .repositories.assets import AssetRepository
from .repositories.conversations import ConversationRepository
from .repositories.jobs import JobRepository
from .repositories.projects import ProjectRepository
from .repositories.providers import ProviderRepository
from .repositories.uploads import UploadRepository
from .storage.base import DocumentStore


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_store(request: Request) -> DocumentStore:
    return request.app.state.store


def get_repositories(request: Request) -> Repositories:
    return request.app.state.repositories


def get_project_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> ProjectRepository:
    return repositories.projects


def get_asset_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> AssetRepository:
    return repositories.assets


def get_conversation_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> ConversationRepository:
    return repositories.conversations


def get_upload_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> UploadRepository:
    return repositories.uploads


def get_job_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> JobRepository:
    return repositories.jobs


def get_provider_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> ProviderRepository:
    return repositories.providers


def get_current_user_id(
    settings: Annotated[Settings, Depends(get_settings)],
    x_user_id: Annotated[UUID | None, Header(alias="X-User-Id")] = None,
) -> UUID:
    """Resolve the acting user.

    Until the auth service lands, callers may supply ``X-User-Id``/``X-Org-Id``
    headers; otherwise the configured development identity is used.
    """
    return x_user_id or settings.default_user_id


def get_current_org_id(
    settings: Annotated[Settings, Depends(get_settings)],
    x_org_id: Annotated[UUID | None, Header(alias="X-Org-Id")] = None,
) -> UUID:
    return x_org_id or settings.default_org_id


__all__ = [
    "get_asset_repository",
    "get_conversation_repository",
    "get_current_org_id",
    "get_current_user_id",
    "get_job_repository",
    "get_project_repository",
    "get_provider_repository",
    "get_repositories",
    "get_settings",
    "get_store",
    "get_upload_repository",
]

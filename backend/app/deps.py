"""FastAPI dependency providers."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, Request

from .adapters import AdapterRegistry
from .config import Settings
from .errors import ApiError
from .links import ReferenceLinkService
from .publish import PublishService
from .repositories import Repositories
from .repositories.auth import AuthRepository
from .repositories.assets import AssetRepository
from .repositories.conversations import ConversationRepository
from .repositories.extensions import ExtensionRepository
from .repositories.jobs import JobRepository
from .repositories.orchestration import OrchestrationRepository
from .repositories.projects import ProjectRepository
from .repositories.providers import ProviderRepository
from .repositories.uploads import UploadRepository
from .storage.base import DocumentStore
from .tree import ProjectTree
from .training import TrainingChainService


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_store(request: Request) -> DocumentStore:
    return request.app.state.store


def get_adapter_registry() -> AdapterRegistry:
    return AdapterRegistry()


def get_project_tree(settings: Annotated[Settings, Depends(get_settings)]) -> ProjectTree:
    return ProjectTree(settings.studio_root)


def get_publish_service(
    assets: Annotated[AssetRepository, Depends(get_asset_repository)],
    projects: Annotated[ProjectRepository, Depends(get_project_repository)],
    tree: Annotated[ProjectTree, Depends(get_project_tree)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> PublishService:
    return PublishService(assets, projects, tree, settings.upload_dir)


def get_link_service(
    tree: Annotated[ProjectTree, Depends(get_project_tree)],
) -> ReferenceLinkService:
    return ReferenceLinkService(tree)


def get_training_service(
    store: Annotated[DocumentStore, Depends(get_store)],
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> TrainingChainService:
    return TrainingChainService(
        store,
        repositories.projects,
        repositories.assets,
        repositories.jobs,
    )


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


def get_orchestration_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> OrchestrationRepository:
    return repositories.orchestration


def get_auth_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> AuthRepository:
    return repositories.auth


def get_extension_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> ExtensionRepository:
    return repositories.extensions


def get_bearer_token(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> str:
    """Extract an access token from ``Authorization: Bearer <token>``."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ApiError(
            "A bearer access token is required.",
            status_code=401,
            code="unauthorized",
        )
    token = authorization.split(None, 1)[1].strip()
    if not token:
        raise ApiError("A bearer access token is required.", status_code=401, code="unauthorized")
    return token


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
    "get_adapter_registry",
    "get_asset_repository",
    "get_auth_repository",
    "get_bearer_token",
    "get_conversation_repository",
    "get_extension_repository",
    "get_current_org_id",
    "get_current_user_id",
    "get_job_repository",
    "get_link_service",
    "get_orchestration_repository",
    "get_project_repository",
    "get_project_tree",
    "get_provider_repository",
    "get_publish_service",
    "get_repositories",
    "get_settings",
    "get_store",
    "get_training_service",
    "get_upload_repository",
]

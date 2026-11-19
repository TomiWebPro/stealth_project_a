"""FastAPI dependency providers."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, Request

from .adapters import AdapterRegistry
from .config import Settings
from .errors import ApiError
from .exports import ExportService
from .links import ReferenceLinkService
from .publish import PublishService
from .repositories import Repositories
from .repositories.activity import ActivityRepository
from .repositories.activity_stats import ActivityStatsRepository
from .repositories.auth import AuthRepository
from .repositories.assets import AssetRepository
from .repositories.asset_stats import AssetStatsRepository
from .repositories.audit import AuditRepository
from .repositories.conversations import ConversationRepository
from .repositories.conversation_stats import ConversationStatsRepository
from .repositories.collaboration_stats import CollaborationStatsRepository
from .repositories.dashboard import DashboardRepository
from .repositories.event_stats import EventStatsRepository
from .repositories.extensions import ExtensionRepository
from .repositories.extension_stats import ExtensionStatsRepository
from .repositories.impact import ImpactRepository
from .repositories.lineage_stats import LineageStatsRepository
from .repositories.job_stats import JobStatsRepository
from .repositories.jobs import JobRepository
from .repositories.operation_stats import OperationStatsRepository
from .repositories.pipeline_stats import PipelineStatsRepository
from .repositories.organization_stats import OrganizationStatsRepository
from .repositories.orchestration import OrchestrationRepository
from .repositories.orchestration_stats import OrchestrationStatsRepository
from .repositories.projects import ProjectRepository
from .repositories.project_stats import ProjectStatsRepository
from .repositories.provider_stats import ProviderStatsRepository
from .repositories.providers import ProviderRepository
from .repositories.retry_stats import RetryStatsRepository
from .repositories.search import SearchRepository
from .repositories.search_stats import SearchStatsRepository
from .repositories.tags import TagRepository
from .repositories.uploads import UploadRepository
from .repositories.upload_stats import UploadStatsRepository
from .storage.base import DocumentStore
from .tree import ProjectTree
from .shots import ShotPipelineService
from .splat import SplatPipelineService
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


def get_export_service(
    repositories: Annotated[Repositories, Depends(get_repositories)],
    tree: Annotated[ProjectTree, Depends(get_project_tree)],
) -> ExportService:
    return ExportService(repositories.assets, repositories.projects, tree)


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


def get_shot_service(
    store: Annotated[DocumentStore, Depends(get_store)],
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> ShotPipelineService:
    return ShotPipelineService(
        store,
        repositories.projects,
        repositories.assets,
        repositories.jobs,
    )


def get_splat_service(
    store: Annotated[DocumentStore, Depends(get_store)],
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> SplatPipelineService:
    return SplatPipelineService(
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


def get_project_stats_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> ProjectStatsRepository:
    return repositories.project_stats


def get_asset_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> AssetRepository:
    return repositories.assets


def get_asset_stats_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> AssetStatsRepository:
    return repositories.asset_stats


def get_conversation_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> ConversationRepository:
    return repositories.conversations


def get_conversation_stats_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> ConversationStatsRepository:
    return repositories.conversation_stats


def get_collaboration_stats_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> CollaborationStatsRepository:
    return repositories.collaboration_stats


def get_upload_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> UploadRepository:
    return repositories.uploads


def get_upload_stats_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> UploadStatsRepository:
    return repositories.upload_stats


def get_job_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> JobRepository:
    return repositories.jobs


def get_job_stats_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> JobStatsRepository:
    return repositories.job_stats


def get_lineage_stats_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> LineageStatsRepository:
    return repositories.lineage_stats


def get_operation_stats_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> OperationStatsRepository:
    return repositories.operation_stats


def get_pipeline_stats_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> PipelineStatsRepository:
    return repositories.pipeline_stats


def get_organization_stats_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> OrganizationStatsRepository:
    return repositories.organization_stats


def get_provider_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> ProviderRepository:
    return repositories.providers


def get_provider_stats_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> ProviderStatsRepository:
    return repositories.provider_stats


def get_retry_stats_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> RetryStatsRepository:
    return repositories.retry_stats


def get_orchestration_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> OrchestrationRepository:
    return repositories.orchestration


def get_orchestration_stats_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> OrchestrationStatsRepository:
    return repositories.orchestration_stats


def get_auth_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> AuthRepository:
    return repositories.auth


def get_audit_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> AuditRepository:
    return repositories.audit


def get_activity_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> ActivityRepository:
    return repositories.activity


def get_activity_stats_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> ActivityStatsRepository:
    return repositories.activity_stats


def get_event_stats_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> EventStatsRepository:
    return repositories.event_stats


def get_extension_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> ExtensionRepository:
    return repositories.extensions


def get_extension_stats_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> ExtensionStatsRepository:
    return repositories.extension_stats


def get_search_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> SearchRepository:
    return repositories.search


def get_search_stats_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> SearchStatsRepository:
    return repositories.search_stats


def get_dashboard_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> DashboardRepository:
    return repositories.dashboard


def get_tag_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> TagRepository:
    return repositories.tags


def get_impact_repository(
    repositories: Annotated[Repositories, Depends(get_repositories)],
) -> ImpactRepository:
    return repositories.impact


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
    "get_activity_repository",
    "get_activity_stats_repository",
    "get_adapter_registry",
    "get_asset_repository",
    "get_asset_stats_repository",
    "get_audit_repository",
    "get_auth_repository",
    "get_bearer_token",
    "get_collaboration_stats_repository",
    "get_conversation_repository",
    "get_conversation_stats_repository",
    "get_dashboard_repository",
    "get_event_stats_repository",
    "get_extension_repository",
    "get_extension_stats_repository",
    "get_impact_repository",
    "get_current_org_id",
    "get_export_service",
    "get_current_user_id",
    "get_job_repository",
    "get_job_stats_repository",
    "get_lineage_stats_repository",
    "get_link_service",
    "get_operation_stats_repository",
    "get_pipeline_stats_repository",
    "get_organization_stats_repository",
    "get_orchestration_repository",
    "get_orchestration_stats_repository",
    "get_project_repository",
    "get_project_stats_repository",
    "get_project_tree",
    "get_provider_repository",
    "get_provider_stats_repository",
    "get_retry_stats_repository",
    "get_publish_service",
    "get_repositories",
    "get_settings",
    "get_shot_service",
    "get_splat_service",
    "get_search_repository",
    "get_search_stats_repository",
    "get_tag_repository",
    "get_store",
    "get_training_service",
    "get_upload_repository",
    "get_upload_stats_repository",
]

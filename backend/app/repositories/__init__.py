"""Repository composition root."""

from __future__ import annotations

from dataclasses import dataclass

from ..config import Settings
from ..schemas.common import utcnow
from ..storage.base import DocumentStore
from .assets import AssetRepository
from .auth import AuthRepository
from .conversations import ConversationRepository
from .jobs import JobRepository
from .orchestration import OrchestrationRepository
from .projects import ProjectRepository
from .providers import ProviderRepository
from .uploads import UploadRepository


@dataclass(slots=True)
class Repositories:
    projects: ProjectRepository
    assets: AssetRepository
    conversations: ConversationRepository
    uploads: UploadRepository
    jobs: JobRepository
    providers: ProviderRepository
    orchestration: OrchestrationRepository
    auth: AuthRepository

    @classmethod
    def build(
        cls,
        store: DocumentStore,
        settings: Settings,
        clock=utcnow,
    ) -> "Repositories":
        projects = ProjectRepository(store, clock=clock)
        assets = AssetRepository(store, projects, clock=clock)
        conversations = ConversationRepository(store, projects, assets, clock=clock)
        uploads = UploadRepository(
            store, projects, upload_dir=settings.upload_dir, clock=clock
        )
        jobs = JobRepository(store, projects, clock=clock)
        providers = ProviderRepository(store, clock=clock)
        orchestration = OrchestrationRepository(
            store,
            projects,
            assets,
            storage_quota_bytes=settings.storage_quota_bytes,
            clock=clock,
        )
        auth = AuthRepository(
            store,
            default_user_id=settings.default_user_id,
            default_org_id=settings.default_org_id,
            clock=clock,
        )
        return cls(
            projects=projects,
            assets=assets,
            conversations=conversations,
            uploads=uploads,
            jobs=jobs,
            providers=providers,
            orchestration=orchestration,
            auth=auth,
        )


__all__ = ["Repositories"]

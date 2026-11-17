"""Shot video generation with automatic LoRA mounting.

Given first/last frame assets, the service discovers the project's ready LoRA
assets, groups them by slot (Char/Prop/Env) and mounts them onto a video job.
The produced video asset carries lineage to every input and mounted LoRA.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from .errors import InvalidRequestError, NotFoundError
from .repositories.assets import AssetRepository
from .repositories.base import BaseRepository
from .repositories.jobs import JobRepository
from .repositories.projects import ProjectRepository
from .schemas.asset import AssetRegisterRequest, AssetUpdate, StorageRef
from .schemas.common import utcnow
from .schemas.operation import OperationRequest
from .storage.base import Collections, DocumentStore
from .tree import normalize_kind, shot_token


class MountedLora(BaseModel):
    asset_id: UUID
    slot: str


class ShotChainRequest(BaseModel):
    project_id: UUID
    first_frame_id: UUID
    last_frame_id: UUID | None = None
    sequence: str = Field(min_length=1)
    shot: str = Field(min_length=1)
    prompt: str | None = None
    slots: list[str] | None = None


class ShotChain(BaseModel):
    id: UUID
    project_id: UUID
    shot_token: str
    job_id: UUID
    video_asset_id: UUID
    mounted_loras: list[MountedLora]
    operation_id: str
    created_at: datetime
    created_by: UUID


class ShotPipelineService(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        assets: AssetRepository,
        jobs: JobRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects
        self.assets = assets
        self.jobs = jobs

    def _frame(self, asset_id: UUID, project_id: UUID) -> None:
        asset = self.assets.get(asset_id)
        if asset is None or asset.project_id != project_id:
            raise InvalidRequestError(
                f"Frame asset '{asset_id}' does not belong to this project.",
                code="invalid_frame",
                details=[("asset_id", "asset not found in this project")],
            )
        if asset.type != "image":
            raise InvalidRequestError(
                f"Asset '{asset_id}' is not an image frame.",
                code="invalid_frame",
                details=[("asset_id", "must be type 'image'")],
            )

    def _mounted_loras(
        self, project_id: UUID, slots: list[str] | None
    ) -> list[MountedLora]:
        wanted = {normalize_kind(slot) for slot in slots} if slots else None
        mounted: list[MountedLora] = []
        for asset in self.assets.list(project_id=project_id, asset_type="lora"):
            if asset.status != "ready":
                continue
            slot = normalize_kind(str(asset.metadata.get("lora_slot", "Char")))
            if wanted is not None and slot not in wanted:
                continue
            mounted.append(MountedLora(asset_id=asset.id, slot=slot))
        mounted.sort(key=lambda item: (item.slot, str(item.asset_id)))
        return mounted

    def create_chain(
        self, payload: ShotChainRequest, *, user_id: UUID
    ) -> ShotChain:
        project = self.projects.get_or_raise(payload.project_id)
        if project.archived:
            raise InvalidRequestError(
                f"Project '{project.id}' is archived; shots cannot be generated.",
                code="project_archived",
            )
        self._frame(payload.first_frame_id, project.id)
        if payload.last_frame_id is not None:
            self._frame(payload.last_frame_id, project.id)
            if payload.last_frame_id == payload.first_frame_id:
                raise InvalidRequestError(
                    "First and last frame must be different assets.",
                    code="invalid_frame",
                )

        mounted = self._mounted_loras(project.id, payload.slots)
        token = shot_token(payload.sequence, payload.shot)
        chain_id = uuid4()
        now = self.clock()

        inputs = [payload.first_frame_id]
        if payload.last_frame_id is not None:
            inputs.append(payload.last_frame_id)
        inputs.extend(item.asset_id for item in mounted)

        video = self.assets.register(
            AssetRegisterRequest(
                project_id=project.id,
                type="video",
                name=f"{token}_video",
                storage=StorageRef(
                    backend="local",
                    key=f"shots/{chain_id}/{token}.mp4",
                    size_bytes=0,
                    content_type="video/mp4",
                ),
                parent_asset_ids=inputs,
            ),
            user_id=user_id,
        )
        self.assets.update(
            video.id,
            AssetUpdate(
                metadata={
                    "shot": token,
                    "mounted_loras": [item.model_dump(mode="json") for item in mounted],
                }
            ),
        )

        operation_id = "flf2v" if payload.last_frame_id is not None else "image-to-video"
        job = self.jobs.submit(
            OperationRequest(
                operation_id=operation_id,
                schema_version="1.0.0",
                project_id=project.id,
                input_asset_ids=inputs,
                prompt=payload.prompt,
                settings={
                    "shot": token,
                    "loras": [item.model_dump(mode="json") for item in mounted],
                },
            ),
            user_id=user_id,
        )

        chain = ShotChain(
            id=chain_id,
            project_id=project.id,
            shot_token=token,
            job_id=job.id,
            video_asset_id=video.id,
            mounted_loras=mounted,
            operation_id=operation_id,
            created_at=now,
            created_by=user_id,
        )
        self._save(Collections.SHOT_CHAINS, str(chain.id), chain)
        return chain

    def get(self, chain_id: UUID) -> ShotChain:
        chain = self._load(Collections.SHOT_CHAINS, str(chain_id), ShotChain)
        if chain is None:
            raise NotFoundError("Shot chain", str(chain_id))
        return chain

    def list(self, project_id: UUID | None = None) -> list[ShotChain]:
        chains = self._load_all(Collections.SHOT_CHAINS, ShotChain)
        if project_id is not None:
            chains = [chain for chain in chains if chain.project_id == project_id]
        chains.sort(key=lambda chain: (chain.created_at, str(chain.id)), reverse=True)
        return chains


__all__ = [
    "MountedLora",
    "ShotChain",
    "ShotChainRequest",
    "ShotPipelineService",
]

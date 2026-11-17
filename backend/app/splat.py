"""Splat/COLMAP + camera-path bridge pipeline (CPU smoke mode by default).

The bridge turns source footage into a COLMAP-style reconstruction, trains a
Gaussian splat and records a sampled camera path on the scene asset. All jobs
run through the simulated adapters, so the chain works without a GPU.
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
from .tree import sanitize_name


class CameraKeyframe(BaseModel):
    t: float = Field(ge=0.0, le=1.0)
    position: list[float] = Field(min_length=3, max_length=3)
    rotation: list[float] = Field(min_length=3, max_length=3)


class SplatChainRequest(BaseModel):
    project_id: UUID
    footage_asset_ids: list[UUID] = Field(min_length=1)
    scene_name: str = Field(min_length=1)
    keyframes: list[CameraKeyframe] = Field(min_length=2)
    samples: int = Field(default=8, ge=2, le=256)
    smoke: bool = True


class SplatChain(BaseModel):
    id: UUID
    project_id: UUID
    scene_asset_id: UUID
    model_asset_id: UUID
    splat_asset_id: UUID
    job_ids: list[UUID]
    camera_path: list[dict]
    smoke: bool
    created_at: datetime
    created_by: UUID


def build_camera_path(
    keyframes: list[CameraKeyframe], samples: int
) -> list[dict]:
    """Sample a linear camera path from sorted keyframes."""
    ordered = sorted(keyframes, key=lambda frame: frame.t)
    if ordered[0].t != 0.0 or ordered[-1].t != 1.0:
        raise InvalidRequestError(
            "Camera keyframes must span t=0.0 to t=1.0.",
            code="invalid_camera_path",
        )
    path: list[dict] = []
    segment = 0
    for index in range(samples):
        t = index / (samples - 1)
        while segment < len(ordered) - 2 and ordered[segment + 1].t < t:
            segment += 1
        start, end = ordered[segment], ordered[segment + 1]
        span = end.t - start.t
        alpha = 0.0 if span <= 0 else (t - start.t) / span
        path.append(
            {
                "t": round(t, 6),
                "position": [
                    round(a + (b - a) * alpha, 6)
                    for a, b in zip(start.position, end.position)
                ],
                "rotation": [
                    round(a + (b - a) * alpha, 6)
                    for a, b in zip(start.rotation, end.rotation)
                ],
            }
        )
    return path


class SplatPipelineService(BaseRepository):
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

    def create_chain(
        self, payload: SplatChainRequest, *, user_id: UUID
    ) -> SplatChain:
        project = self.projects.get_or_raise(payload.project_id)
        if project.archived:
            raise InvalidRequestError(
                f"Project '{project.id}' is archived; splat chains cannot be created.",
                code="project_archived",
            )

        footage: list[UUID] = []
        for asset_id in payload.footage_asset_ids:
            asset = self.assets.get(asset_id)
            if asset is None or asset.project_id != project.id:
                raise InvalidRequestError(
                    f"Footage asset '{asset_id}' does not belong to this project.",
                    code="invalid_footage",
                )
            if asset.type not in {"video", "image"}:
                raise InvalidRequestError(
                    f"Asset '{asset_id}' is not footage (video/image).",
                    code="invalid_footage",
                )
            if asset_id not in footage:
                footage.append(asset_id)

        camera_path = build_camera_path(payload.keyframes, payload.samples)
        chain_id = uuid4()
        now = self.clock()
        mode = "cpu-smoke" if payload.smoke else "full"

        def register(asset_type, name, key, parents):
            return self.assets.register(
                AssetRegisterRequest(
                    project_id=project.id,
                    type=asset_type,
                    name=name,
                    storage=StorageRef(
                        backend="local",
                        key=f"splat/{chain_id}/{key}",
                        size_bytes=0,
                        content_type="application/octet-stream",
                    ),
                    parent_asset_ids=parents,
                ),
                user_id=user_id,
            )

        scene = register("scene", payload.scene_name, "scene.json", footage)
        self.assets.update(
            scene.id,
            AssetUpdate(
                metadata={
                    "camera_path": camera_path,
                    "shot": sanitize_name(payload.scene_name),
                    "mode": mode,
                }
            ),
        )
        model = register("model3d", f"{payload.scene_name}_colmap", "poses.bin", footage)
        splat = register(
            "splat", f"{payload.scene_name}_splat", "splat.splat", [model.id, scene.id]
        )

        job_ids = [
            self.jobs.submit(
                OperationRequest(
                    operation_id="3d-reconstruction",
                    schema_version="1.0.0",
                    project_id=project.id,
                    input_asset_ids=footage,
                    settings={"mode": mode, "solver": "colmap"},
                ),
                user_id=user_id,
            ).id,
            self.jobs.submit(
                OperationRequest(
                    operation_id="splat-train",
                    schema_version="1.0.0",
                    project_id=project.id,
                    input_asset_ids=[model.id],
                    settings={"mode": mode, "samples": payload.samples},
                ),
                user_id=user_id,
            ).id,
        ]

        chain = SplatChain(
            id=chain_id,
            project_id=project.id,
            scene_asset_id=scene.id,
            model_asset_id=model.id,
            splat_asset_id=splat.id,
            job_ids=job_ids,
            camera_path=camera_path,
            smoke=payload.smoke,
            created_at=now,
            created_by=user_id,
        )
        self._save(Collections.SPLAT_CHAINS, str(chain.id), chain)
        return chain

    def get(self, chain_id: UUID) -> SplatChain:
        chain = self._load(Collections.SPLAT_CHAINS, str(chain_id), SplatChain)
        if chain is None:
            raise NotFoundError("Splat chain", str(chain_id))
        return chain

    def list(self, project_id: UUID | None = None) -> list[SplatChain]:
        chains = self._load_all(Collections.SPLAT_CHAINS, SplatChain)
        if project_id is not None:
            chains = [chain for chain in chains if chain.project_id == project_id]
        chains.sort(key=lambda chain: (chain.created_at, str(chain.id)), reverse=True)
        return chains


__all__ = [
    "CameraKeyframe",
    "SplatChain",
    "SplatChainRequest",
    "SplatPipelineService",
    "build_camera_path",
]

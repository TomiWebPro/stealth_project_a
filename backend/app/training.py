"""dataset-prep -> ai-toolkit YAML -> lora-train operation chain.

The chain is a real, executable sequence of jobs: each step submits a job via
the jobs repository, and the resulting assets are linked with lineage. The YAML
is generated deterministically so it can be shipped to a training worker later;
this Phase 4 build simulates execution through the P4.1 adapters (CPU only).
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from .errors import InvalidRequestError, NotFoundError
from .repositories.assets import AssetRepository
from .repositories.base import BaseRepository
from .repositories.jobs import JobRepository
from .repositories.projects import ProjectRepository
from .schemas.asset import AssetRegisterRequest, AssetUpdate, StorageRef
from .schemas.common import Metadata, utcnow
from .schemas.operation import OperationRequest
from .storage.base import Collections, DocumentStore


class LoraChainRequest(BaseModel):
    project_id: UUID
    dataset_name: str = Field(min_length=1)
    trigger_word: str = Field(min_length=1)
    base_model: str = "sdxl-1.0"
    steps: int = Field(default=1000, ge=1, le=100000)
    lora_slot: str = "char"
    resolution: int = Field(default=1024, ge=64)


class LoraChain(BaseModel):
    id: UUID
    project_id: UUID
    dataset_asset_id: UUID
    config_asset_id: UUID
    lora_asset_id: UUID
    job_ids: list[UUID]
    yaml: str
    config_hash: str
    created_at: datetime
    created_by: UUID


def ai_toolkit_yaml(request: LoraChainRequest) -> str:
    """Render an ai-toolkit compatible training config (dependency-free)."""
    return "\n".join(
        [
            "job: extension_train",
            "config:",
            "  name: lora-chain",
            "  process:",
            "    - type: sd_trainer",
            "      training_folder: /workspace/train",
            "      device: cuda:0",
            f"      trigger_word: {request.trigger_word}",
            f"      base_model: {request.base_model}",
            "      network:",
            "        type: lora",
            "        linear: 16",
            "      datasets:",
            "        - folder: /workspace/dataset",
            f"          resolution: {request.resolution}",
            "      train:",
            f"        steps: {request.steps}",
            "",
        ]
    )


class TrainingChainService(BaseRepository):
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
        self, payload: LoraChainRequest, *, user_id: UUID
    ) -> LoraChain:
        project = self.projects.get_or_raise(payload.project_id)
        if project.archived:
            raise InvalidRequestError(
                f"Project '{project.id}' is archived; training chains cannot be created.",
                code="project_archived",
            )

        yaml = ai_toolkit_yaml(payload)
        config_hash = hashlib.sha256(yaml.encode("utf-8")).hexdigest()
        chain_id = uuid4()
        now = self.clock()

        def storage_ref(name: str) -> StorageRef:
            return StorageRef(
                backend="local",
                key=f"pipelines/{chain_id}/{name}",
                size_bytes=0,
                content_type="application/json",
            )

        dataset = self.assets.register(
            AssetRegisterRequest(
                project_id=project.id,
                type="dataset",
                name=payload.dataset_name,
                storage=storage_ref("dataset"),
            ),
            user_id=user_id,
        )
        self.assets.update(
            dataset.id,
            AssetUpdate(
                metadata={
                    "dataset_spec": {
                        "trigger_word": payload.trigger_word,
                        "resolution": payload.resolution,
                        "base_model": payload.base_model,
                    }
                }
            ),
        )
        config = self.assets.register(
            AssetRegisterRequest(
                project_id=project.id,
                type="resource",
                name=f"{payload.dataset_name}_config",
                storage=storage_ref("aitoolkit.yaml"),
            ),
            user_id=user_id,
        )
        self.assets.update(
            config.id,
            AssetUpdate(metadata={"yaml": yaml, "config_hash": config_hash}),
        )
        lora = self.assets.register(
            AssetRegisterRequest(
                project_id=project.id,
                type="lora",
                name=f"{payload.dataset_name}_lora",
                storage=storage_ref("lora.safetensors"),
                parent_asset_ids=[dataset.id, config.id],
            ),
            user_id=user_id,
        )
        self.assets.update(
            lora.id,
            AssetUpdate(
                metadata={
                    "lora_slot": payload.lora_slot,
                    "dataset_spec": {"trigger_word": payload.trigger_word},
                    "config_hash": config_hash,
                }
            ),
        )

        job_ids = [
            self.jobs.submit(
                OperationRequest(
                    operation_id="dataset-prep",
                    schema_version="1.0.0",
                    project_id=project.id,
                    input_asset_ids=[dataset.id],
                    settings={"trigger_word": payload.trigger_word},
                ),
                user_id=user_id,
            ).id,
            self.jobs.submit(
                OperationRequest(
                    operation_id="lora-train",
                    schema_version="1.0.0",
                    project_id=project.id,
                    input_asset_ids=[dataset.id, config.id],
                    settings={
                        "steps": payload.steps,
                        "base_model": payload.base_model,
                        "config_hash": config_hash,
                    },
                ),
                user_id=user_id,
            ).id,
        ]

        chain = LoraChain(
            id=chain_id,
            project_id=project.id,
            dataset_asset_id=dataset.id,
            config_asset_id=config.id,
            lora_asset_id=lora.id,
            job_ids=job_ids,
            yaml=yaml,
            config_hash=config_hash,
            created_at=now,
            created_by=user_id,
        )
        self._save(Collections.TRAINING_CHAINS, str(chain.id), chain)
        return chain

    def get(self, chain_id: UUID) -> LoraChain:
        chain = self._load(Collections.TRAINING_CHAINS, str(chain_id), LoraChain)
        if chain is None:
            raise NotFoundError("Training chain", str(chain_id))
        return chain

    def list(self, project_id: UUID | None = None) -> list[LoraChain]:
        chains = self._load_all(Collections.TRAINING_CHAINS, LoraChain)
        if project_id is not None:
            chains = [chain for chain in chains if chain.project_id == project_id]
        chains.sort(key=lambda chain: (chain.created_at, str(chain.id)), reverse=True)
        return chains


__all__ = ["LoraChain", "LoraChainRequest", "TrainingChainService", "ai_toolkit_yaml"]

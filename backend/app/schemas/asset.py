"""Asset, lineage, version and relationship contracts.

Every uploaded/generated/imported/derived item is a registered Asset with a
stable ID. Large media live in object storage; the API exposes references and
short-lived download URLs only.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import Field

from .common import ContractModel, Metadata, NonEmptyStr, Timestamp

AssetType = Literal[
    "image",
    "video",
    "audio",
    "model3d",
    "splat",
    "texture",
    "dataset",
    "lora",
    "scene",
    "resource",
]
AssetStatus = Literal["pending", "processing", "ready", "failed", "deleted"]
RelationshipType = Literal[
    "derived_from",
    "variant_of",
    "uses_input",
    "related_to",
    "duplicate_of",
]


class StorageRef(ContractModel):
    """Where the bytes live. `url` is a short-lived signed URL when present."""

    backend: Literal["s3", "local"] = "s3"
    bucket: str | None = None
    key: NonEmptyStr
    size_bytes: int = Field(ge=0)
    content_type: NonEmptyStr
    etag: str | None = None
    url: str | None = None


class AssetProps(ContractModel):
    width: int | None = Field(default=None, ge=0)
    height: int | None = Field(default=None, ge=0)
    duration_ms: int | None = Field(default=None, ge=0)
    fps: float | None = Field(default=None, ge=0)
    format: str | None = None


class Provenance(ContractModel):
    """Traceable production history for a generated/derived asset."""

    operation_id: str | None = None
    operation_version: str | None = None
    conversation_id: UUID | None = None
    message_id: UUID | None = None
    job_id: UUID | None = None
    prompt: str | None = None
    provider_id: str | None = None
    workflow: str | None = None
    params: Metadata = Field(default_factory=dict)


class Asset(ContractModel):
    id: UUID
    project_id: UUID
    type: AssetType
    name: NonEmptyStr
    status: AssetStatus = "ready"
    creator_id: UUID
    version: int = Field(ge=1, default=1)
    tags: list[str] = Field(default_factory=list)
    storage: StorageRef
    props: AssetProps = Field(default_factory=AssetProps)
    preview_url: str | None = None
    thumbnail_url: str | None = None
    provenance: Provenance = Field(default_factory=Provenance)
    parent_asset_ids: list[UUID] = Field(default_factory=list)
    metadata: Metadata = Field(default_factory=dict)
    created_at: Timestamp
    updated_at: Timestamp


class AssetRegisterRequest(ContractModel):
    """Register a client-known asset (upload already completed)."""

    project_id: UUID
    type: AssetType
    name: NonEmptyStr
    storage: StorageRef
    props: AssetProps = Field(default_factory=AssetProps)
    provenance: Provenance = Field(default_factory=Provenance)
    parent_asset_ids: list[UUID] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    upload_id: UUID | None = None


class AssetVersionCreate(ContractModel):
    """Create a new version of an existing asset (storage already uploaded)."""

    storage: StorageRef
    upload_id: UUID | None = None


class AssetVersionCreateRequest(ContractModel):
    """Create a new version of an existing asset (storage already uploaded)."""

    storage: StorageRef
    upload_id: UUID | None = None


class AssetVersionRegisterRequest(ContractModel):
    """Register a new version of an existing asset (upload already completed)."""

    storage: StorageRef
    upload_id: UUID | None = None


class AssetVersionRequest(ContractModel):
    """Request payload for adding a version to an existing asset."""

    storage: StorageRef
    upload_id: UUID | None = None


class CreateAssetVersionRequest(ContractModel):
    """Request payload for creating a new asset version."""

    storage: StorageRef
    upload_id: UUID | None = None


class AssetUpdate(ContractModel):
    name: NonEmptyStr | None = None
    tags: list[str] | None = None
    metadata: Metadata | None = None


class AssetVersion(ContractModel):
    asset_id: UUID
    version: int = Field(ge=1)
    storage: StorageRef
    created_at: Timestamp
    created_by: UUID


class AssetRelationship(ContractModel):
    id: UUID
    from_asset_id: UUID
    to_asset_id: UUID
    type: RelationshipType
    created_at: Timestamp


class AssetLineageNode(ContractModel):
    asset_id: UUID
    relationship: RelationshipType | None = None
    depth: int = Field(ge=0, default=0)


class AssetLineage(ContractModel):
    root_asset_id: UUID
    nodes: list[AssetLineageNode] = Field(default_factory=list)


# --- Uploads ----------------------------------------------------------------


class UploadRequest(ContractModel):
    project_id: UUID
    filename: NonEmptyStr
    content_type: NonEmptyStr
    size_bytes: int = Field(gt=0)


class UploadTicket(ContractModel):
    """Presigned upload target; the client PUTs bytes directly to `url`."""

    upload_id: UUID
    url: NonEmptyStr
    method: Literal["PUT"] = "PUT"
    headers: dict[str, str] = Field(default_factory=dict)
    expires_at: Timestamp


class DownloadTicket(ContractModel):
    url: NonEmptyStr
    expires_at: Timestamp


__all__ = [
    "Asset",
    "AssetLineage",
    "AssetLineageNode",
    "AssetProps",
    "AssetRegisterRequest",
    "AssetRelationship",
    "AssetStatus",
    "AssetType",
    "AssetUpdate",
    "AssetVersion",
    "AssetVersionCreate",
    "AssetVersionCreateRequest",
    "AssetVersionRegisterRequest",
    "AssetVersionRequest",
    "CreateAssetVersionRequest",
    "DownloadTicket",
    "Provenance",
    "RelationshipType",
    "StorageRef",
    "UploadRequest",
    "UploadTicket",
]

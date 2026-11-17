"""Publish ceremony endpoints (immutable copies + receipt sidecars)."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field

from ..deps import get_current_user_id, get_publish_service
from ..publish import PublishService

router = APIRouter(tags=["publish"])


class PublishRequest(BaseModel):
    comment: str = Field(min_length=1)
    thumbnail: str | None = None


class PublishReceipt(BaseModel):
    asset_id: str
    project_id: str
    version: int
    version_folder: str
    comment: str
    thumbnail: str | None
    published_by: str
    published_at: str
    source_key: str
    published_path: str
    checksum_sha256: str
    size_bytes: int


@router.post(
    "/assets/{asset_id}/publish",
    response_model=PublishReceipt,
    status_code=status.HTTP_201_CREATED,
)
def publish_asset(
    asset_id: UUID,
    payload: PublishRequest,
    publish: Annotated[PublishService, Depends(get_publish_service)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> PublishReceipt:
    return PublishReceipt(
        **publish.publish(
            asset_id,
            comment=payload.comment,
            user_id=user_id,
            thumbnail=payload.thumbnail,
        )
    )


@router.get("/assets/{asset_id}/publish", response_model=PublishReceipt)
def get_publish_receipt(
    asset_id: UUID,
    publish: Annotated[PublishService, Depends(get_publish_service)],
) -> PublishReceipt:
    return PublishReceipt(**publish.receipt(asset_id))


__all__ = ["router", "PublishRequest", "PublishReceipt"]

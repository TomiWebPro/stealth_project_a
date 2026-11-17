"""Engine export path endpoints (Unreal / Blender)."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..deps import get_export_service
from ..exports import ExportService

router = APIRouter(tags=["exports"])


class ExportTargetInfo(BaseModel):
    target: str
    label: str
    path: str
    ready: bool
    source_exists: bool


class ExportRow(BaseModel):
    asset_id: str
    asset_name: str
    asset_type: str
    source_key: str
    targets: list[ExportTargetInfo]


@router.get("/projects/{project_id}/exports", response_model=list[ExportRow])
def project_exports(
    project_id: UUID,
    exports: Annotated[ExportService, Depends(get_export_service)],
) -> list[ExportRow]:
    """Authoritative export rows for every published asset in a project."""
    return [ExportRow(**row) for row in exports.project_exports(project_id)]


@router.get("/assets/{asset_id}/exports", response_model=list[ExportRow])
def asset_exports(
    asset_id: UUID,
    exports: Annotated[ExportService, Depends(get_export_service)],
) -> list[ExportRow]:
    return [ExportRow(**row) for row in exports.asset_exports(asset_id)]


__all__ = ["router", "ExportRow", "ExportTargetInfo"]

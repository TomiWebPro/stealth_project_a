"""Asset library, version, relationship, lineage and transfer endpoints."""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.responses import FileResponse, RedirectResponse

from ..config import Settings
from ..deps import (
    get_asset_repository,
    get_current_user_id,
    get_settings,
)
from ..errors import ApiError, NotFoundError
from ..repositories.assets import AssetRepository
from ..schemas.asset import (
    Asset,
    AssetLineage,
    AssetRegisterRequest,
    AssetVersion,
    AssetVersionCreate,
    AssetRelationship,
    AssetType,
    AssetUpdate,
    DownloadTicket,
    RelationshipType,
)
from ..schemas.common import utcnow

router = APIRouter(prefix="/assets", tags=["assets"])

DOWNLOAD_TICKET_TTL = timedelta(minutes=15)


@router.get("", response_model=list[Asset])
def list_assets(
    assets: Annotated[AssetRepository, Depends(get_asset_repository)],
    project_id: Annotated[UUID | None, Query(description="Filter by project")] = None,
    asset_type: Annotated[
        AssetType | None, Query(alias="type", description="Filter by asset type")
    ] = None,
    tag: Annotated[str | None, Query(description="Filter by a single tag")] = None,
    search: Annotated[str | None, Query(description="Case-insensitive name/tag search")] = None,
    cursor: Annotated[
        UUID | None,
        Query(description="Last asset ID from the previous page (keyset pagination)"),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    include_deleted: Annotated[bool, Query()] = False,
) -> list[Asset]:
    """List assets, newest first.

    Pagination is keyset-based: pass the ID of the last asset in the previous
    page as ``cursor``. Soft-deleted assets are excluded unless
    ``include_deleted=true``.
    """
    return assets.list(
        project_id=project_id,
        asset_type=asset_type,
        tag=tag,
        search=search,
        cursor=cursor,
        limit=limit,
        include_deleted=include_deleted,
    )


@router.post(
    "/register", response_model=Asset, status_code=status.HTTP_201_CREATED
)
def register_asset(
    payload: AssetRegisterRequest,
    assets: Annotated[AssetRepository, Depends(get_asset_repository)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> Asset:
    """Register metadata for an uploaded/generated asset."""
    return assets.register(payload, user_id=user_id)


@router.get("/{asset_id}", response_model=Asset)
def get_asset(
    asset_id: UUID,
    assets: Annotated[AssetRepository, Depends(get_asset_repository)],
) -> Asset:
    return assets.get_or_raise(asset_id)


@router.patch("/{asset_id}", response_model=Asset)
def update_asset(
    asset_id: UUID,
    payload: AssetUpdate,
    assets: Annotated[AssetRepository, Depends(get_asset_repository)],
) -> Asset:
    return assets.update(asset_id, payload)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def soft_delete_asset(
    asset_id: UUID,
    assets: Annotated[AssetRepository, Depends(get_asset_repository)],
) -> Response:
    """Soft-delete an asset (status becomes ``deleted``; recoverable)."""
    assets.soft_delete(asset_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{asset_id}/versions", response_model=list[AssetVersion])
def list_asset_versions(
    asset_id: UUID,
    assets: Annotated[AssetRepository, Depends(get_asset_repository)],
) -> list[AssetVersion]:
    return assets.list_versions(asset_id)




@router.post(
    "/{asset_id}/versions", response_model=AssetVersion, status_code=status.HTTP_201_CREATED
)
def create_asset_version(
    asset_id: UUID,
    payload: AssetVersionCreate,
    assets: Annotated[AssetRepository, Depends(get_asset_repository)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> AssetVersion:
    """Create a new version of an existing asset."""
    return assets.create_version(asset_id, payload, user_id=user_id)

@router.get(
    "/{asset_id}/relationships", response_model=list[AssetRelationship]
)
def list_asset_relationships(
    asset_id: UUID,
    assets: Annotated[AssetRepository, Depends(get_asset_repository)],
    relationship_type: Annotated[
        RelationshipType | None, Query(alias="type")
    ] = None,
) -> list[AssetRelationship]:
    return assets.list_relationships(asset_id, relationship_type)


@router.get("/{asset_id}/lineage", response_model=AssetLineage)
def asset_lineage(
    asset_id: UUID,
    assets: Annotated[AssetRepository, Depends(get_asset_repository)],
    depth: Annotated[int, Query(ge=0, le=20)] = 5,
) -> AssetLineage:
    """Asset lineage graph rooted at ``asset_id`` (root included at depth 0)."""
    return assets.lineage(asset_id, depth)


@router.get("/{asset_id}/download", response_model=DownloadTicket)
def asset_download_ticket(
    asset_id: UUID,
    request: Request,
    assets: Annotated[AssetRepository, Depends(get_asset_repository)],
) -> DownloadTicket:
    asset = assets.get_or_raise(asset_id)
    if asset.status == "deleted":
        raise NotFoundError("Asset", str(asset_id))
    url = asset.storage.url or str(
        request.url_for("asset_content", asset_id=str(asset.id))
    )
    return DownloadTicket(
        url=url, expires_at=utcnow() + DOWNLOAD_TICKET_TTL
    )


@router.get("/{asset_id}/content", name="asset_content")
def asset_content(
    asset_id: UUID,
    assets: Annotated[AssetRepository, Depends(get_asset_repository)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    """Dev-local byte access.

    When the asset carries a signed URL (future S3 adapter) it is used directly.
    Otherwise local keys are served from the configured upload directory. The
    stable API contract remains the download ticket.
    """
    asset = assets.get_or_raise(asset_id)
    if asset.status == "deleted":
        raise NotFoundError("Asset", str(asset_id))
    if asset.storage.url:
        return RedirectResponse(asset.storage.url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
    if asset.storage.backend == "local":
        relative = Path(asset.storage.key)
        if relative.is_absolute() or ".." in relative.parts:
            raise ApiError(
                f"Content for asset '{asset_id}' is not available from this backend.",
                status_code=404,
                code="asset_content_unavailable",
            )
        path = (settings.upload_dir / relative).resolve()
        upload_root = settings.upload_dir.resolve()
        if upload_root not in path.parents and path != upload_root:
            raise ApiError(
                f"Content for asset '{asset_id}' is not available from this backend.",
                status_code=404,
                code="asset_content_unavailable",
            )
        if path.is_file():
            return FileResponse(
                path,
                media_type=asset.storage.content_type,
                filename=path.name,
            )
    raise ApiError(
        f"Content for asset '{asset_id}' is not available from this backend.",
        status_code=404,
        code="asset_content_unavailable",
    )


__all__ = ["DOWNLOAD_TICKET_TTL", "router"]

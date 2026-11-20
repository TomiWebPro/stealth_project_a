"""Authoritative single-upload-ticket overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from ..deps import get_upload_overview_repository
from ..repositories.upload_overview import UploadOverviewRepository
from ..schemas.upload_overview import UploadOverview

router = APIRouter(tags=["uploads", "overview"])


@router.get("/uploads/{upload_id}/overview", response_model=UploadOverview)
def upload_overview(
    upload_id: UUID,
    overview: Annotated[
        UploadOverviewRepository, Depends(get_upload_overview_repository)
    ],
) -> UploadOverview:
    """Return a compact snapshot of one upload ticket, derived from authoritative stores.

    An unknown upload returns the shared 404 ``upload_not_found`` envelope; a
    malformed id uses the shared 422 ``validation_error`` envelope.
    """
    return overview.overview(upload_id)


__all__ = ["router"]

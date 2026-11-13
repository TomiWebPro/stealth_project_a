"""Upload ticket endpoints (dev-local storage adapter)."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import FileResponse

from ..config import Settings
from ..deps import get_settings, get_upload_repository
from ..errors import ApiError, InvalidRequestError, PayloadTooLargeError
from ..repositories.uploads import UploadRepository
from ..schemas.asset import UploadRequest, UploadTicket

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("", response_model=UploadTicket, status_code=status.HTTP_201_CREATED)
def create_upload(
    payload: UploadRequest,
    request: Request,
    uploads: Annotated[UploadRepository, Depends(get_upload_repository)],
) -> UploadTicket:
    """Issue a presigned-style upload target.

    The dev-local adapter accepts a direct PUT at the returned URL; an S3
    adapter will return a real presigned URL later without changing this
    contract.
    """
    upload_id = uuid4()
    url = str(request.url_for("upload_content", upload_id=str(upload_id)))
    return uploads.create_ticket(payload, upload_id=upload_id, url=url)


@router.put(
    "/{upload_id}",
    name="upload_content",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def upload_content(
    upload_id: UUID,
    request: Request,
    uploads: Annotated[UploadRepository, Depends(get_upload_repository)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Response:
    record = uploads.get_record_or_raise(upload_id)
    uploads.ensure_writable(record)
    target = uploads.target_path(record)

    size_bytes = 0
    try:
        with target.open("wb") as handle:
            async for chunk in request.stream():
                if not chunk:
                    continue
                size_bytes += len(chunk)
                if size_bytes > settings.max_upload_bytes:
                    raise PayloadTooLargeError(
                        f"Upload exceeds the {settings.max_upload_bytes} byte limit.",
                        details=[("size_bytes", "upload is too large")],
                    )
                handle.write(chunk)
        if size_bytes == 0:
            raise InvalidRequestError(
                "Uploaded file is empty.",
                details=[("size_bytes", "must be greater than zero")],
            )
    except Exception:
        target.unlink(missing_ok=True)
        raise

    uploads.mark_complete(record, size_bytes=size_bytes)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{upload_id}/content")
def upload_content_download(
    upload_id: UUID,
    uploads: Annotated[UploadRepository, Depends(get_upload_repository)],
):
    record = uploads.get_record_or_raise(upload_id)
    path = uploads.content_path(record)
    if path is None:
        raise ApiError(
            f"Upload '{upload_id}' has not been completed.",
            status_code=404,
            code="upload_content_unavailable",
        )
    return FileResponse(
        path, media_type=record.content_type, filename=record.filename
    )


__all__ = ["router"]

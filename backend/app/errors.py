"""Machine-readable API errors.

Every non-2xx response uses the shared ``ErrorResponse`` envelope:

    {"error": {"code": "...", "message": "...", "details": [], "request_id": "..."}}

Exception handlers for this envelope are registered in :mod:`app.main`.
"""

from __future__ import annotations

from typing import Iterable

from .schemas.common import ErrorBody, ErrorDetail, ErrorResponse


class ApiError(Exception):
    """Base class for errors that map directly onto the API error envelope."""

    status_code: int = 500
    code: str = "internal_error"

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        code: str | None = None,
        details: Iterable[ErrorDetail | tuple[str | None, str]] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        if code is not None:
            self.code = code
        self.details = [
            detail
            if isinstance(detail, ErrorDetail)
            else ErrorDetail(field=detail[0], message=detail[1])
            for detail in (details or [])
        ]

    def to_response(self, request_id: str | None = None) -> ErrorResponse:
        return ErrorResponse(
            error=ErrorBody(
                code=self.code,
                message=self.message,
                details=self.details,
                request_id=request_id,
            )
        )


class NotFoundError(ApiError):
    status_code = 404

    def __init__(self, resource: str, identifier: str, *, code: str | None = None):
        super().__init__(
            f"{resource} '{identifier}' was not found.",
            code=code or f"{resource.lower()}_not_found",
        )
        self.resource = resource
        self.identifier = identifier


class ConflictError(ApiError):
    status_code = 409
    code = "conflict"


class InvalidRequestError(ApiError):
    status_code = 422
    code = "invalid_request"


class PayloadTooLargeError(ApiError):
    status_code = 413
    code = "payload_too_large"


class GoneError(ApiError):
    status_code = 410
    code = "gone"


__all__ = [
    "ApiError",
    "ConflictError",
    "GoneError",
    "InvalidRequestError",
    "NotFoundError",
    "PayloadTooLargeError",
]

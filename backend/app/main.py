"""FastAPI application factory.

Mounts the stable application API under ``/api/v1`` (see
docs/API.md). All non-2xx responses use the shared error envelope.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import APP_VERSION, Settings
from .errors import ApiError
from .repositories import Repositories
from .routers import (
    activity,
    adapters,
    asset_stats,
    assets,
    audit,
    auth,
    conversations,
    conversation_stats,
    dashboard,
    events,
    exports,
    extension_stats,
    extensions,
    health,
    impact,
    job_stats,
    jobs,
    lineage_stats,
    links,
    operation_stats,
    pipeline_stats,
    organization_stats,
    orchestration,
    pipelines,
    projects,
    project_stats,
    provider_stats,
    providers,
    publish,
    search,
    shots,
    splat,
    tags,
    tree,
    uploads,
)
from .schemas.common import API_PREFIX, ErrorBody, ErrorDetail, ErrorResponse, HealthResponse
from .storage import create_store

logger = logging.getLogger(__name__)

_HTTP_ERROR_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    410: "gone",
    413: "payload_too_large",
    415: "unsupported_media_type",
    422: "invalid_request",
    429: "rate_limited",
}


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def _error_response(
    request: Request,
    *,
    status_code: int,
    code: str,
    message: str,
    details: list[ErrorDetail] | None = None,
) -> JSONResponse:
    response = ErrorResponse(
        error=ErrorBody(
            code=code,
            message=message,
            details=details or [],
            request_id=_request_id(request),
        )
    )
    json_response = JSONResponse(
        status_code=status_code,
        content=response.model_dump(mode="json"),
    )
    # Exception-handler responses bypass the request-id middleware (notably the
    # catch-all 500 handler), so the header is set here for every error path.
    request_id = _request_id(request)
    if request_id:
        json_response.headers["X-Request-ID"] = request_id
    return json_response


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    store = create_store(settings)
    repositories = Repositories.build(store, settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield
        store.close()

    app = FastAPI(
        title="Studio Platform API",
        version=APP_VERSION,
        description=(
            "Stable application API for the Professional AI Creative Studio "
            "Platform. Frontend never depends on execution/provider internals."
        ),
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.store = store
    app.state.repositories = repositories

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_origins),
            allow_credentials=settings.allow_cors_credentials,
            allow_methods=["*"],
            allow_headers=["*"],
            expose_headers=["X-Request-ID"],
        )

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request.state.request_id = request.headers.get("X-Request-ID") or str(uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    # --- Error envelope -----------------------------------------------------

    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
        json_response = JSONResponse(
            status_code=exc.status_code,
            content=exc.to_response(_request_id(request)).model_dump(mode="json"),
        )
        request_id = _request_id(request)
        if request_id:
            json_response.headers["X-Request-ID"] = request_id
        return json_response

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details: list[ErrorDetail] = []
        for error in exc.errors():
            location = [
                str(part)
                for part in error.get("loc", ())
                if part not in {"body", "query", "path", "header"}
            ]
            details.append(
                ErrorDetail(
                    field=".".join(location) or None,
                    message=error.get("msg", "invalid value"),
                )
            )
        return _error_response(
            request,
            status_code=422,
            code="validation_error",
            message="Request validation failed.",
            details=details,
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        code = _HTTP_ERROR_CODES.get(exc.status_code, "http_error")
        message = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        return _error_response(
            request,
            status_code=exc.status_code,
            code=code,
            message=message,
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled API error", exc_info=exc)
        return _error_response(
            request,
            status_code=500,
            code="internal_error",
            message="An internal server error occurred.",
        )

    # --- Routes -------------------------------------------------------------

    # "/operations/stats" must be registered before "/operations/{operation_id}"
    # so the literal path wins over the operation-id-templated one.
    app.include_router(operation_stats.router, prefix=API_PREFIX)

    app.include_router(health.router, prefix=API_PREFIX)
    app.include_router(activity.router, prefix=API_PREFIX)
    app.include_router(audit.router, prefix=API_PREFIX)
    app.include_router(adapters.router, prefix=API_PREFIX)
    # "/projects/stats" must be registered before "/projects/{project_id}" so
    # the literal path wins over the UUID-templated one.
    app.include_router(project_stats.router, prefix=API_PREFIX)
    app.include_router(projects.router, prefix=API_PREFIX)
    # "/conversations/stats" must be registered before "/conversations/{id}" so
    # the literal path wins over the UUID-templated one.
    app.include_router(conversation_stats.router, prefix=API_PREFIX)
    app.include_router(conversations.router, prefix=API_PREFIX)
    # "/assets/stats" must be registered before "/assets/{asset_id}" so the
    # literal path wins over the UUID-templated one.
    app.include_router(asset_stats.router, prefix=API_PREFIX)
    app.include_router(assets.router, prefix=API_PREFIX)
    app.include_router(uploads.router, prefix=API_PREFIX)
    # "/jobs/stats" must be registered before "/jobs/{job_id}" so the literal
    # path wins over the UUID-templated one.
    app.include_router(job_stats.router, prefix=API_PREFIX)
    app.include_router(jobs.router, prefix=API_PREFIX)
    # "/providers/stats" must be registered before "/providers/{provider_id}" so
    # the literal path wins over the dynamic one.
    app.include_router(provider_stats.router, prefix=API_PREFIX)
    app.include_router(providers.router, prefix=API_PREFIX)
    app.include_router(orchestration.router, prefix=API_PREFIX)
    app.include_router(events.router, prefix=API_PREFIX)
    # "/orgs/stats" must be registered before "/orgs/{org_id}" in auth.router so
    # the literal path wins over the UUID-templated one.
    app.include_router(organization_stats.router, prefix=API_PREFIX)
    app.include_router(auth.router, prefix=API_PREFIX)
    # "/extensions/stats" must be registered before "/extensions/{extension_id}"
    # so the literal path wins over the UUID-templated one.
    app.include_router(extension_stats.router, prefix=API_PREFIX)
    app.include_router(extensions.router, prefix=API_PREFIX)
    app.include_router(tree.router, prefix=API_PREFIX)
    app.include_router(publish.router, prefix=API_PREFIX)
    app.include_router(links.router, prefix=API_PREFIX)
    # "/pipelines/stats" is a literal path; register before the chain routers so
    # it is unambiguous against the "/pipelines/{kind}/{chain_id}" detail routes.
    app.include_router(pipeline_stats.router, prefix=API_PREFIX)
    app.include_router(pipelines.router, prefix=API_PREFIX)
    app.include_router(shots.router, prefix=API_PREFIX)
    app.include_router(splat.router, prefix=API_PREFIX)
    app.include_router(exports.router, prefix=API_PREFIX)
    app.include_router(search.router, prefix=API_PREFIX)
    app.include_router(dashboard.router, prefix=API_PREFIX)
    app.include_router(tags.router, prefix=API_PREFIX)
    app.include_router(impact.router, prefix=API_PREFIX)
    app.include_router(lineage_stats.router, prefix=API_PREFIX)

    # Backwards-compatible unprefixed probe from the original scaffold.
    @app.get("/health", response_model=HealthResponse, include_in_schema=False)
    def legacy_health() -> HealthResponse:
        return HealthResponse(
            status="ok" if store.ping() else "down",
            version=APP_VERSION,
        )

    return app


app = create_app()


__all__ = ["app", "create_app"]

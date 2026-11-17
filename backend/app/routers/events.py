"""Server-Sent Events (SSE) stream for recoverable job events.

Contract:
    GET /api/v1/jobs/{job_id}/events/stream?since=<seq>&idle_timeout=<seconds>

    Streams ``text/event-stream`` frames, one per ``JobEvent``::

        event: job
        id: <seq>
        data: <JobEvent JSON>

    ``since`` is the last observed sequence number; replay resumes at
    ``seq >= since``. ``idle_timeout`` (default 5s, 0 = drain-and-close) closes
    the stream after that many seconds with no new events, so clients can simply
    reconnect. Clients that cannot hold an SSE connection can use the polling
    fallback ``GET /api/v1/jobs/{job_id}/events`` which returns the same events
    in a ``JobEventFrame`` with a ``next_seq`` resume cursor. Presence is read
    via ``GET /api/v1/presence?project_id=...`` and polled; it is intentionally
    not pushed on this stream so the contract stays single-purpose.
"""

from __future__ import annotations

import asyncio
import time
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from ..deps import get_job_repository
from ..repositories.jobs import JobRepository

router = APIRouter(tags=["events"])

_POLL_INTERVAL = 0.2


@router.get("/jobs/{job_id}/events/stream")
async def stream_job_events(
    job_id: UUID,
    request: Request,
    jobs: Annotated[JobRepository, Depends(get_job_repository)],
    since: Annotated[
        int,
        Query(ge=0, description="Replay events with seq >= since"),
    ] = 0,
    idle_timeout: Annotated[
        float,
        Query(ge=0, le=60, description="Close after N seconds with no new events"),
    ] = 5.0,
) -> StreamingResponse:
    """SSE stream of job events with a polling fallback (see module docstring)."""
    # Validate up front so a missing job returns the shared 404 envelope rather
    # than an error midway through a stream.
    jobs.get_or_raise(job_id)

    async def generate():
        cursor = since
        last_emit = time.monotonic()
        while True:
            frame = jobs.event_frame(job_id, since=cursor)
            for event in frame.events:
                yield (
                    f"event: job\n"
                    f"id: {event.seq}\n"
                    f"data: {event.model_dump_json()}\n\n"
                )
                cursor = event.seq + 1
                last_emit = time.monotonic()
            if await request.is_disconnected():
                break
            if time.monotonic() - last_emit >= idle_timeout:
                break
            await asyncio.sleep(_POLL_INTERVAL)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


__all__ = ["router"]

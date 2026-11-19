"""Authoritative project portfolio statistics contracts.

The project browser and workspace overview need aggregate portfolio metrics
(project lifecycle mix, cross-domain volume per project, recency). Deriving them
on the backend — where projects, assets, conversations and jobs are
authoritative — keeps every client reading the same numbers and avoids
reproducing aggregation rules per screen.

Everything is computed fresh from the authoritative stores on every call: there
is no second index to drift and removing the router leaves no collection behind.
Soft-deleted assets are excluded from every metric (matching ``/assets``, the
dashboard and the other stats endpoints), so the snapshot agrees with the
resource routers. An optional ``org_id`` narrows the same derivation to one
organization's projects (and the assets/conversations/jobs belonging to them),
matching the ``list_projects?org_id=`` filter.

Mirrored in ``frontend/src/types/projectStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from .common import ContractModel, Timestamp

ProjectLifecycle = Literal["active", "archived"]


class ProjectLifecycleCount(ContractModel):
    """Number of projects in one lifecycle state."""

    lifecycle: ProjectLifecycle
    count: int = Field(ge=0)


class ProjectStats(ContractModel):
    """Project portfolio metrics derived from the authoritative stores.

    ``by_lifecycle`` is zero-filled over every canonical lifecycle state so a UI
    can read a bucket without guarding for a missing key; ``active`` and
    ``archived`` are the same totals surfaced as convenience scalars. Asset,
    conversation and job totals are workspace-wide (or restricted to the
    ``org_id`` scope); the per-project averages divide those totals by ``total``
    and are ``0.0`` when there are no projects. ``newest_project_at`` is the
    newest project's ``created_at`` (``None`` when there are no projects).
    """

    total: int = Field(ge=0)
    by_lifecycle: list[ProjectLifecycleCount] = Field(default_factory=list)
    active: int = Field(ge=0)
    archived: int = Field(ge=0)
    total_assets: int = Field(ge=0)
    total_conversations: int = Field(ge=0)
    total_jobs: int = Field(ge=0)
    average_assets_per_project: float = Field(ge=0.0, default=0.0)
    average_jobs_per_project: float = Field(ge=0.0, default=0.0)
    newest_project_at: Timestamp | None = None
    generated_at: Timestamp


__all__ = ["ProjectLifecycle", "ProjectLifecycleCount", "ProjectStats"]

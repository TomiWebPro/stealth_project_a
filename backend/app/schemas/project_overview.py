"""Authoritative project overview contracts.

The project-detail screen needs a compact, single-project snapshot (entity
counts plus a few recent jobs/assets). Deriving it on the backend — where
projects, assets, conversations and jobs are authoritative — keeps the numbers
consistent with every resource router and with the workspace ``/dashboard``,
and avoids reproducing aggregation rules per screen.

Everything is computed fresh from the authoritative stores on every call: there
is no second index to drift and removing the router leaves no collection behind.
Soft-deleted assets are excluded from counts and recency (matching ``/assets``,
``/assets/stats`` and the dashboard), so the snapshot agrees with the resource
routers. Mirrors ``frontend/src/types/projectOverview.ts`` — parity is enforced
by ``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .asset import Asset
from .common import ContractModel, NonEmptyStr, Timestamp
from .operation import Job
from .project_stats import ProjectLifecycle


class ProjectOverviewCounts(ContractModel):
    """Cross-domain totals for one project, derived from the authoritative stores."""

    assets: int = Field(ge=0)
    conversations: int = Field(ge=0)
    jobs: int = Field(ge=0)
    comments: int = Field(ge=0)
    publishes: int = Field(ge=0)
    versions: int = Field(ge=0)
    collaborators: int = Field(ge=0)


class ProjectOverview(ContractModel):
    """A single-project snapshot: identity, counts and a few recent items.

    ``lifecycle`` is the same canonical ``active``/``archived`` label used by
    ``/projects/stats`` and ``/projects/feed``. ``counts.collaborators`` is the
    number of distinct presence participants; ``counts.publishes`` counts live
    assets carrying a well-formed publish receipt; ``counts.versions`` counts
    version records whose asset is still live in this project. ``recent_jobs``
    and ``recent_assets`` are newest-first and bounded by ``recent_limit``.
    """

    project_id: UUID
    project_name: NonEmptyStr
    lifecycle: ProjectLifecycle
    created_at: Timestamp
    counts: ProjectOverviewCounts
    recent_jobs: list[Job] = Field(default_factory=list)
    recent_assets: list[Asset] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = ["ProjectOverview", "ProjectOverviewCounts"]

"""Authoritative dashboard summary contracts.

The desktop home screen needs a compact snapshot of the whole workspace.
Deriving it on the backend — where projects, assets, jobs and extensions are
authoritative — keeps the counts consistent with every resource router and
avoids reproducing aggregation rules per screen.

Mirrored in ``frontend/src/types/dashboard.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from pydantic import Field

from .asset import Asset
from .common import ContractModel, Timestamp
from .operation import Job


class DashboardCounts(ContractModel):
    """Entity totals derived from the authoritative stores on every call."""

    projects: int = Field(ge=0)
    assets: int = Field(ge=0)
    conversations: int = Field(ge=0)
    jobs: int = Field(ge=0)
    providers: int = Field(ge=0)
    enabled_extensions: int = Field(ge=0)


class DashboardSummary(ContractModel):
    """A home-screen snapshot: counts, breakdowns and a few recent items."""

    counts: DashboardCounts
    generated_at: Timestamp
    jobs_by_status: dict[str, int] = Field(default_factory=dict)
    assets_by_type: dict[str, int] = Field(default_factory=dict)
    recent_jobs: list[Job] = Field(default_factory=list)
    recent_assets: list[Asset] = Field(default_factory=list)


__all__ = ["DashboardCounts", "DashboardSummary"]

"""Authoritative asset version statistics contracts.

Every registered asset records a version-1 entry in the authoritative
``ASSET_VERSIONS`` collection, and ``POST /assets/{id}/versions`` appends a new
entry for each subsequent revision. This snapshot reports the size and shape of
that collection: how many version records exist, how many distinct assets they
cover, how many are revisions beyond the initial registration, the distribution
of records across version numbers, per-project activity, the newest version's
creation time and when the snapshot was generated.

Everything is computed fresh from the authoritative store on every call; there
is no second index to drift. Versions whose asset is soft-deleted or unknown are
excluded (matching every other asset-derived metric), so ``by_project`` and the
totals cannot disagree. ``by_version`` is ordered by ascending version number
and ``by_project`` by descending version count then project id, keeping the wire
shape deterministic across the in-memory and SQLite stores. An optional
``project_id`` narrows the same derivation to one project.

Mirrored in ``frontend/src/types/versionStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp


class VersionNumberCount(ContractModel):
    """Number of version records that share a version number."""

    version: int = Field(ge=1)
    count: int = Field(ge=0)


class VersionProjectCount(ContractModel):
    """Version activity recorded for one project."""

    project_id: UUID
    versions: int = Field(ge=0)
    assets: int = Field(ge=0)


class VersionStats(ContractModel):
    """Version metrics derived from the authoritative asset version store.

    ``total_versions`` counts every version record of a live asset (at least one
    per asset). ``total_assets`` is the number of distinct live assets with at
    least one version record. ``revisions`` counts records with a version number
    of 2 or higher — updates beyond the initial registration. ``by_version``
    groups records by their version number in ascending order; ``by_project`` is
    ordered by descending version count then project id. ``newest_version_at``
    is ``None`` when there are no version records in scope.
    """

    total_versions: int = Field(ge=0)
    total_assets: int = Field(ge=0)
    revisions: int = Field(ge=0)
    by_version: list[VersionNumberCount] = Field(default_factory=list)
    by_project: list[VersionProjectCount] = Field(default_factory=list)
    newest_version_at: Timestamp | None = None
    generated_at: Timestamp


__all__ = [
    "VersionNumberCount",
    "VersionProjectCount",
    "VersionStats",
]

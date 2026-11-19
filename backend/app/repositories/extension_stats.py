"""Authoritative extension registry/installation statistics repository.

Registry metrics (type mix, permission/capability coverage) are derived from the
``EXTENSION_REGISTRY`` collection and installation metrics (status mix, trust
flags) from the ``EXTENSIONS`` collection, both on every call — exactly like the
other stats repositories, so there is no second index to drift.

``by_type`` and ``by_status`` are zero-filled over the canonical Literal orders
so the wire shape is stable across the in-memory and SQLite stores. Optional
``type``/``status`` filters narrow the registry/installed slices before any
metric is computed, so the snapshot always agrees with the filtered slice.

Mirrors ``frontend/src/types/extensionStats.ts`` contracts.
"""

from __future__ import annotations

from collections import defaultdict
from typing import get_args

from ..schemas.common import utcnow
from ..schemas.extension_stats import (
    ExtensionPermissionStat,
    ExtensionStats,
    ExtensionStatusCount,
    ExtensionTypeCount,
)
from ..schemas.provider import Extension, ExtensionManifest, ExtensionStatus, ExtensionType
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository

_TYPES = tuple(get_args(ExtensionType))
_STATUSES = tuple(get_args(ExtensionStatus))


class ExtensionStatsRepository(BaseRepository):
    def __init__(self, store: DocumentStore, clock=utcnow) -> None:
        super().__init__(store, clock)

    def stats(
        self,
        *,
        type: ExtensionType | None = None,
        status: ExtensionStatus | None = None,
    ) -> ExtensionStats:
        """Build fresh extension metrics, optionally filtered per slice."""
        manifests = [
            manifest
            for manifest in self._load_all(Collections.EXTENSION_REGISTRY, ExtensionManifest)
            if type is None or manifest.type == type
        ]
        extensions = [
            extension
            for extension in self._load_all(Collections.EXTENSIONS, Extension)
            if status is None or extension.status == status
        ]

        type_counts: dict[str, int] = defaultdict(int)
        permission_counts: dict[str, int] = defaultdict(int)
        total_permissions = 0
        total_capabilities = 0
        for manifest in manifests:
            type_counts[manifest.type] += 1
            for permission in manifest.requirements.permissions:
                total_permissions += 1
                permission_counts[permission.name] += 1
            total_capabilities += len(manifest.requirements.capabilities)

        status_counts: dict[str, int] = defaultdict(int)
        signed = 0
        verified = 0
        for extension in extensions:
            status_counts[extension.status] += 1
            if extension.signed:
                signed += 1
            if extension.verified:
                verified += 1

        by_type = [
            ExtensionTypeCount(type=value, count=type_counts.get(value, 0))
            for value in _TYPES
        ]
        by_status = [
            ExtensionStatusCount(status=value, count=status_counts.get(value, 0))
            for value in _STATUSES
        ]
        by_permission = [
            ExtensionPermissionStat(permission=name, extensions=count)
            for name, count in sorted(
                permission_counts.items(),
                key=lambda item: (-item[1], item[0]),
            )
        ]

        return ExtensionStats(
            total_registered=len(manifests),
            total_installed=len(extensions),
            by_type=by_type,
            by_status=by_status,
            enabled=status_counts.get("enabled", 0),
            signed=signed,
            verified=verified,
            total_permissions=total_permissions,
            unique_permissions=len(permission_counts),
            by_permission=by_permission,
            total_capabilities=total_capabilities,
            generated_at=self.clock(),
        )


__all__ = ["ExtensionStatsRepository"]

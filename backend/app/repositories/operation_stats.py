"""Authoritative operation catalog statistics repository.

Metrics are derived from ``app.catalog.OPERATION_CATALOG`` on every call — the
same authoritative list ``GET /operations`` serves — so there is no second index
to drift and the snapshot always agrees with the live catalog.

``by_output_type``/``by_input_type`` count how many operations consume or produce
each asset-type string and are sorted by descending count then name for
deterministic cross-backend ordering.

Mirrors ``frontend/src/types/operationStats.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter

from ..catalog import OPERATION_CATALOG
from ..schemas.common import utcnow
from ..schemas.operation_stats import OperationStats, OperationTypeCount
from .base import BaseRepository


class OperationStatsRepository(BaseRepository):
    def stats(self) -> OperationStats:
        """Build fresh catalog metrics from the authoritative operation list."""
        operations = OPERATION_CATALOG.operations

        output_counts: Counter[str] = Counter()
        input_counts: Counter[str] = Counter()
        streaming = 0
        with_provider = 0
        total_settings = 0
        for spec in operations:
            for asset_type in spec.output.asset_types:
                output_counts[asset_type] += 1
            for asset_type in spec.input.asset_types:
                input_counts[asset_type] += 1
            if spec.streaming:
                streaming += 1
            if spec.provider_ids:
                with_provider += 1
            total_settings += len(spec.settings)

        by_output_type = [
            OperationTypeCount(asset_type=name, operations=count)
            for name, count in sorted(
                output_counts.items(), key=lambda item: (-item[1], item[0])
            )
        ]
        by_input_type = [
            OperationTypeCount(asset_type=name, operations=count)
            for name, count in sorted(
                input_counts.items(), key=lambda item: (-item[1], item[0])
            )
        ]

        return OperationStats(
            total=len(operations),
            streaming=streaming,
            with_provider=with_provider,
            without_provider=len(operations) - with_provider,
            total_settings=total_settings,
            unique_output_types=len(output_counts),
            by_output_type=by_output_type,
            by_input_type=by_input_type,
            generated_at=self.clock(),
        )


__all__ = ["OperationStatsRepository"]

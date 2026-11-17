"""Execution adapter contract.

Adapters translate an application-level operation into a concrete runtime. They
never appear in the public API schemas: the jobs API remains the stable seam.
Phase 4 ships deterministic CPU-only simulations behind this boundary.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Callable, Protocol

from ..schemas.operation import JobResult
from ..schemas.provider import ProviderLocation, ProviderStatus

ProgressEmitter = Callable[..., None]


class ExecutionAdapter(ABC):
    provider_id: str
    name: str
    location: ProviderLocation

    @abstractmethod
    def health(self) -> ProviderStatus:
        """Current runtime health (used by the health/degraded states work)."""

    @abstractmethod
    def supports(self, operation_id: str) -> bool:
        """Whether this adapter can execute the given operation."""

    @abstractmethod
    def execute(
        self,
        operation_id: str,
        payload: dict,
        *,
        emit: ProgressEmitter,
    ) -> JobResult:
        """Run the operation, emitting progress events, and return its result."""


class AdapterLike(Protocol):  # pragma: no cover - typing helper
    provider_id: str

    def supports(self, operation_id: str) -> bool: ...

    def execute(self, operation_id: str, payload: dict, *, emit: ProgressEmitter) -> JobResult: ...


__all__ = ["AdapterLike", "ExecutionAdapter", "ProgressEmitter"]

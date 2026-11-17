"""Adapter selection for operation execution."""

from __future__ import annotations

from .base import ExecutionAdapter
from .cloud import CloudRuntimeAdapter
from .local import LocalRuntimeAdapter


class AdapterRegistry:
    def __init__(self) -> None:
        self._adapters: dict[str, ExecutionAdapter] = {}
        for adapter in (LocalRuntimeAdapter(), CloudRuntimeAdapter()):
            self._adapters[adapter.provider_id] = adapter

    def list(self) -> list[ExecutionAdapter]:
        return sorted(self._adapters.values(), key=lambda adapter: adapter.provider_id)

    def get(self, provider_id: str) -> ExecutionAdapter | None:
        return self._adapters.get(provider_id)

    def for_operation(
        self, operation_id: str, *, preferred: str | None = None
    ) -> ExecutionAdapter | None:
        if preferred is not None:
            adapter = self.get(preferred)
            return adapter if adapter and adapter.supports(operation_id) else None
        for adapter in self.list():
            if adapter.supports(operation_id):
                return adapter
        return None


__all__ = ["AdapterRegistry"]

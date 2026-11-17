"""Provider execution adapters (one contract, simulated runtimes)."""

from .base import ExecutionAdapter
from .cloud import CloudRuntimeAdapter
from .local import LocalRuntimeAdapter
from .registry import AdapterRegistry

__all__ = [
    "AdapterRegistry",
    "CloudRuntimeAdapter",
    "ExecutionAdapter",
    "LocalRuntimeAdapter",
]

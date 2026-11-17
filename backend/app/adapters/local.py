"""Local runtime adapter (simulated ComfyUI execution)."""

from __future__ import annotations

from ..schemas.operation import JobResult
from ..schemas.provider import ProviderLocation, ProviderStatus
from .base import ExecutionAdapter, ProgressEmitter

LOCAL_OPERATIONS = (
    "text-to-text",
    "text-to-image",
    "image-to-image",
    "upscale",
)


class LocalRuntimeAdapter(ExecutionAdapter):
    provider_id = "local-comfyui"
    name = "Local ComfyUI (simulated)"
    location: ProviderLocation = "local"

    def health(self) -> ProviderStatus:
        return "available"

    def supports(self, operation_id: str) -> bool:
        return operation_id in LOCAL_OPERATIONS

    def execute(
        self,
        operation_id: str,
        payload: dict,
        *,
        emit: ProgressEmitter,
    ) -> JobResult:
        emit(progress=0.1, message=f"Local runtime preparing {operation_id}.")
        emit(progress=0.5, message="Nodes queued (simulated).")
        emit(progress=0.9, message="Collecting outputs (simulated).")
        text = None
        if operation_id == "text-to-text":
            text = f"[simulated local completion] {payload.get('prompt', '')}".strip()
        return JobResult(
            text=text,
            metadata={
                "adapter": self.provider_id,
                "mode": "simulated",
                "operation_id": operation_id,
                "runtime": "local-cpu",
            },
        )


__all__ = ["LOCAL_OPERATIONS", "LocalRuntimeAdapter"]

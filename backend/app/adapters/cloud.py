"""Cloud/RunPod runtime adapter (simulated execution)."""

from __future__ import annotations

from ..schemas.operation import JobResult
from ..schemas.provider import ProviderLocation, ProviderStatus
from .base import ExecutionAdapter, ProgressEmitter

CLOUD_OPERATIONS = (
    "text-to-image",
    "image-to-image",
    "image-to-video",
    "lora-train",
)


class CloudRuntimeAdapter(ExecutionAdapter):
    provider_id = "cloud-render"
    name = "Cloud Render (simulated)"
    location: ProviderLocation = "cloud"

    def health(self) -> ProviderStatus:
        return "degraded"  # no real credentials in Phase 4 dev mode

    def supports(self, operation_id: str) -> bool:
        return operation_id in CLOUD_OPERATIONS

    def execute(
        self,
        operation_id: str,
        payload: dict,
        *,
        emit: ProgressEmitter,
    ) -> JobResult:
        emit(progress=0.2, message="Cloud worker reserved (simulated).")
        emit(progress=0.7, message="Remote execution in progress (simulated).")
        return JobResult(
            text=None,
            metadata={
                "adapter": self.provider_id,
                "mode": "simulated",
                "operation_id": operation_id,
                "runtime": "cloud-cpu",
                "queue": "runpod-simulated",
            },
        )


__all__ = ["CLOUD_OPERATIONS", "CloudRuntimeAdapter"]

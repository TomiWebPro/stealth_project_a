"""Provider registry backed by the document store.

Phase 2 seeds a static set of local/studio/cloud providers so capability
discovery works without external services. The repository is the seam a real
provider adapter/health-check will replace later.
"""

from __future__ import annotations

from ..errors import NotFoundError
from ..schemas.common import utcnow
from ..schemas.provider import (
    CapabilityQuery,
    Provider,
    ProviderCapability,
)
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository

_SEED_PROVIDERS: list[Provider] = [
    Provider(
        id="local-comfyui",
        name="Local ComfyUI",
        location="local",
        status="available",
        capabilities=[
            ProviderCapability(operation_id=op, schema_versions=["1.0.0"])
            for op in ("text-to-image", "image-to-image", "upscale")
        ],
        metadata={"runtime": "comfyui", "gpu": "local"},
    ),
    Provider(
        id="local-llm",
        name="Local LLM",
        location="local",
        status="unavailable",
        capabilities=[
            ProviderCapability(operation_id="text-to-text", schema_versions=["1.0.0"])
        ],
    ),
    Provider(
        id="cloud-render",
        name="Cloud Render",
        location="cloud",
        status="available",
        capabilities=[
            ProviderCapability(operation_id=op, schema_versions=["1.0.0"])
            for op in ("text-to-image", "image-to-image", "image-to-video")
        ],
    ),
    Provider(
        id="studio-trainer",
        name="Studio Trainer",
        location="studio",
        status="available",
        capabilities=[
            ProviderCapability(operation_id=op, schema_versions=["1.0.0"])
            for op in ("lora-train", "splat-train")
        ],
    ),
    Provider(
        id="cloud-trainer",
        name="Cloud Trainer",
        location="cloud",
        status="degraded",
        capabilities=[
            ProviderCapability(operation_id="lora-train", schema_versions=["1.0.0"])
        ],
    ),
]


class ProviderRepository(BaseRepository):
    def __init__(self, store: DocumentStore, clock=utcnow) -> None:
        super().__init__(store, clock)
        self._seed()

    def _seed(self) -> None:
        for provider in _SEED_PROVIDERS:
            self.store.put(
                Collections.PROVIDERS,
                provider.id,
                provider.model_dump(mode="json"),
            )

    def get(self, provider_id: str) -> Provider | None:
        return self._load(Collections.PROVIDERS, provider_id, Provider)

    def get_or_raise(self, provider_id: str) -> Provider:
        provider = self.get(provider_id)
        if provider is None:
            raise NotFoundError("Provider", provider_id)
        return provider

    def list(self) -> list[Provider]:
        providers = self._load_all(Collections.PROVIDERS, Provider)
        providers.sort(key=lambda provider: provider.id)
        return providers

    def capabilities(self, query: CapabilityQuery) -> list[Provider]:
        """Providers matching the query, with capabilities narrowed to the op.

        Returns ``Provider`` contracts (rather than a new response type) so the
        capability query reuses the existing mirrored schema unchanged.
        """
        result: list[Provider] = []
        for provider in self.list():
            if query.location is not None and provider.location != query.location:
                continue
            capabilities = provider.capabilities
            if query.operation_id is not None:
                capabilities = [
                    capability
                    for capability in capabilities
                    if capability.operation_id == query.operation_id
                ]
            if query.operation_id is not None and not capabilities:
                continue
            result.append(provider.model_copy(update={"capabilities": capabilities}))
        return result


__all__ = ["ProviderRepository"]

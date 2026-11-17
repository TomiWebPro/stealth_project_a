"""Built-in operation catalog.

Phase 2 ships a static, versioned catalog of the application-level creative
operations. It is the authoritative list used to validate job submissions; a
future provider/registry adapter can extend it without changing the API shape.
"""

from __future__ import annotations

from copy import deepcopy

from .schemas.operation import OperationCatalog, OperationIO, OperationSetting, OperationSpec


def _spec(
    operation_id: str,
    title: str,
    *,
    description: str,
    settings: list[OperationSetting] | None = None,
    input_types: list[str] | None = None,
    output_types: list[str] | None = None,
    streaming: bool = False,
    provider_ids: list[str] | None = None,
) -> OperationSpec:
    return OperationSpec(
        id=operation_id,
        title=title,
        description=description,
        schema_version="1.0.0",
        input=OperationIO(asset_types=input_types or [], required=bool(input_types)),
        output=OperationIO(asset_types=output_types or [], required=bool(output_types)),
        settings=settings or [],
        streaming=streaming,
        provider_ids=provider_ids or [],
    )


_OPERATIONS: list[OperationSpec] = [
    _spec(
        "text-to-text",
        "Text to text",
        description="Generate or transform text from a prompt.",
        settings=[
            OperationSetting(
                key="max_tokens",
                label="Max tokens",
                type="integer",
                default=1024,
                minimum=1,
            )
        ],
        output_types=["document"],
        streaming=True,
    ),
    _spec(
        "text-to-image",
        "Text to image",
        description="Generate an image from a text prompt.",
        settings=[
            OperationSetting(key="width", label="Width", type="integer", default=1024),
            OperationSetting(key="height", label="Height", type="integer", default=1024),
            OperationSetting(key="seed", label="Seed", type="integer"),
        ],
        output_types=["image"],
        provider_ids=["local-comfyui", "cloud-render"],
    ),
    _spec(
        "image-to-image",
        "Image to image",
        description="Transform an input image with a prompt.",
        settings=[
            OperationSetting(key="strength", label="Strength", type="number", default=0.6)
        ],
        input_types=["image"],
        output_types=["image"],
        provider_ids=["local-comfyui", "cloud-render"],
    ),
    _spec(
        "upscale",
        "Upscale",
        description="Increase image resolution while preserving detail.",
        settings=[
            OperationSetting(
                key="factor",
                label="Scale factor",
                type="enum",
                default="2",
                choices=["2", "4"],
            )
        ],
        input_types=["image"],
        output_types=["image"],
    ),
    _spec(
        "image-to-video",
        "Image to video",
        description="Animate a still image into a short clip.",
        input_types=["image"],
        output_types=["video"],
        provider_ids=["cloud-render"],
    ),
    _spec(
        "flf2v",
        "First/last frame to video",
        description="Interpolate a video between a first and last frame.",
        input_types=["image"],
        output_types=["video"],
    ),
    _spec(
        "dataset-prep",
        "Dataset preparation",
        description="Prepare and caption a training dataset.",
        settings=[
            OperationSetting(
                key="trigger_word", label="Trigger word", type="string", required=True
            )
        ],
        input_types=["image"],
        output_types=["dataset"],
    ),
    _spec(
        "lora-train",
        "LoRA training",
        description="Train a LoRA adapter from a prepared dataset.",
        settings=[
            OperationSetting(key="steps", label="Steps", type="integer", default=1000)
        ],
        input_types=["dataset"],
        output_types=["lora"],
        provider_ids=["studio-trainer", "cloud-trainer"],
    ),
    _spec(
        "3d-reconstruction",
        "3D reconstruction",
        description="Reconstruct geometry from footage with COLMAP.",
        input_types=["video"],
        output_types=["model3d"],
    ),
    _spec(
        "splat-train",
        "Gaussian splat training",
        description="Train a Gaussian splat environment from reconstructed poses.",
        input_types=["model3d"],
        output_types=["splat"],
        provider_ids=["studio-trainer"],
    ),
]

OPERATION_CATALOG = OperationCatalog(
    version="1.0.0",
    operations=deepcopy(_OPERATIONS),
)


def get_operation_spec(operation_id: str) -> OperationSpec | None:
    """Return a copy of the spec for ``operation_id`` or ``None``."""
    for spec in OPERATION_CATALOG.operations:
        if spec.id == operation_id:
            return deepcopy(spec)
    return None


__all__ = ["OPERATION_CATALOG", "get_operation_spec"]

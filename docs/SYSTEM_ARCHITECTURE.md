# System Architecture

## Layers

1. **Desktop client (Tauri 2 + React/TS)** — app shell, project/asset/shot
   browsers, task panel, version UI, workspaces, extensions, backend connections.
   No file browser, no typed paths: pickers and galleries are live views of the
   project tree.
2. **Backend services (Python/FastAPI + PostgreSQL + S3 + Redis)** — auth,
   projects, conversations, assets/lineage/versions, operations/jobs,
   providers/capabilities, extensions, orchestration, storage, collaboration.
   Authoritative for jobs and assets.
3. **Production pipeline** — the five pipeline stages from
   `docs/PRODUCTION_PIPELINE.md`: project/asset layer, LoRA consistency chain,
   shot/video generation, splat environments, publish/delivery.
4. **Provider adapters** — ComfyUI (first citizen), image/video/3D/splatting,
   Blender hooks, training (ai-toolkit on RunPod/vast.ai), custom workers,
   third-party services (local / studio / cloud).

## Principles

- Stable API contracts; frontend never depends on execution internals.
- Application services separate from GPU execution. No local GPU required for
  the desktop shell.
- ComfyUI-first, not ComfyUI-bound: nodes are Python and must stay portable so
  the pipeline can run standalone later.
- Modular monolith first; split only when justified.
- Capability/provider abstraction; model-agnostic operations (`text-to-image`,
  `dataset-prep`, `lora-train`, `image-to-video`, `flf2v`, `3d-reconstruction`,
  `splat-train`, `upscale`, …).
- Asset lineage on every generated output; `Output/` vs `Publish/` discipline.
- Extension platform with permissions and isolation.

## Key flows

- **Shot generation:** pick project → sequence → shot → frames + LoRAs →
  submit operation → job (progress/intermediates) → assets + lineage → publish.
- **LoRA training:** dataset spec → YAML gen → training job on rented GPU →
  `lora` asset → auto-baked into shot workflows.
- **Splat environment:** footage → COLMAP poses → splat-train → environment +
  camera path → drives shot camera moves.
- **Frontend independence:** the `ApiClient` contract (`frontend/src/lib/`)
  is the seam. Mock transport implements it until the backend is wired;
  screens depend on the interface, never on ComfyUI/GPU internals.

## Frontend-first rule (current phase)

Until the backend is hooked up: **frontend only**. Extend mocks, screens, and
frontend view models. Do not change `frontend/src/types` (parity with
`backend/app/schemas`, checked by contract tests) or any `backend/` code.
See `docs/FRONTEND_MOCK_SCOPE.md`.

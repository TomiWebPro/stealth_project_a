# Development Roadmap

## Phase 0 — Foundation (current): discovery, requirements, architecture, contracts, agent workflow, dev env, CI.

## Phase 1 — Desktop shell + frontend mocks (current focus, frontend only)

- Tauri app, React frontend, navigation, design system, project/chat interfaces,
  backend connection config, mock API.
- **Mock-first:** every screen ships against `frontend/src/lib/mock` fakes that
  mirror the real API shapes in `frontend/src/types`. No backend changes.
- Exit criteria: Home + Projects render from mocks; Assets/Shots/Jobs/Providers
  have mock-backed screens or explicit placeholder contracts; `npm run lint`,
  `npm test`, `npm run build` green.

## Phase 1b — Pipeline screens on mocks (next, still frontend only)

1. Project/asset/shot browser (template tree: `Pipeline/`, `Projects/Default/`,
   `Assets/Char|Prop|Env`, `Shots/s01_c01`, `Output/` vs `Publish/`).
2. Task panel (jobs: queued/running with progress, failed with retry,
   canceled; dataset-prep, lora-train, video-gen, splat-train examples).
3. Version UI (`Ver_001` chains, publish ceremony: comment + thumbnail +
   sidecar note).
4. LoRA/dataset lineage view (design → dataset → LoRA → frames → video).
5. Workflow template gallery (standard ComfyUI templates as data, not embedded JSON).

Mock scope and builder rules: see `docs/FRONTEND_MOCK_SCOPE.md`.

## Phase 2 — Core services (backend hookup — OPEN 2026-11-17)

Auth, projects, conversations, asset metadata, real API integration, real-time
job state. Frontend swaps mock transport for HTTP against the same
`ApiClient` interface — no screen rewrites. The backend agent is active and
works the ordered checklist in `docs/AUTONOMOUS_BACKLOG.md`; no human gate
remains. Phases 3–6 are likewise open and queued in the same backlog.

## GPU validation gate (blocks Phase 4 quality claims, not UI work)

One 2–6 h real GPU end-to-end run required before claiming: real Wan/LTX
frames → COLMAP stability, frame-filter thresholds on AI video, real splat
training quality, full LTX-2.5 flow (~96 GB GPU). Until then, filter/splat
numbers in mocks and docs are clearly marked provisional.

GPU reality: the project has no big-GPU budget. What exists is one small
shared box — Tesla M60, 8 GB VRAM, passwordless over `ssh gpu-resource`
(Torch + COLMAP ready; machine-local details in `~/GPU-RESOURCE.md`). Good
enough for smoke validation (CUDA checks, COLMAP pose checks, small recon
tests) if really needed, not for video-model training or LTX-2.5 runs. Those
stay rented (RunPod/vast.ai) and gated behind explicit human approval.

Phase 1b needs no GPU at all: screens and mocks build and verify fully on
CPU with fakes, so treat that as the default and reach for the small box
only for a concrete validation question.

## Phase 3 — Asset management

Library, details, upload/registration, previews, metadata, relationships,
versions, search/filter. `Ver_NNN` ↔ `AssetVersion`; publish ceremony;
reference links + `.links.json` with dry-run plan mode.

## Phase 4 — First production capability

End-to-end image generation with lineage (one model, one operation family,
fully traceable), then dataset-prep → lora-train → shot video chain.

## Phase 5 — Extension platform

Manifest, SDK, registration, install/remove, permissions, connectors, registry.

## Phase 6 — Professional capabilities

Workspaces, multiple providers, local runtimes, studio integrations,
collaboration, advanced lineage, audio integration, UE/Blender export paths.

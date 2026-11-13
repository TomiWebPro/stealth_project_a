# Frontend Mock Scope (frontend-only phase)

Normative for builder agents until the backend is hooked up. **Frontend only:**
`frontend/src/**` plus `docs/`. Never touch `backend/` or the shared contract
types in `frontend/src/types` (parity with `backend/app/schemas`, enforced by
`backend/tests/test_contract_parity.py`).

## 1. What mocks must cover (minimum fakes before backend hookup)

All fakes live in `frontend/src/lib/mock/` and implement the `ApiClient`
interface in `frontend/src/lib/apiClient.ts`. Shapes must stay identical to
`src/types` so screens need no changes when live mode lands.

Required fake domains (use existing `AssetType` / `Job` / `Provider` — no new
contract types):

1. **Projects (film-shaped).** At least one full production project
   (e.g. short-film project) alongside the generic seeds: template-root shape,
   sequences/shots implied by asset metadata, archived vs active.
2. **Assets across the whole chain.** Minimum one of each:
   - `image` concept/design frame (with preview URL),
   - `dataset` (dataset spec in metadata: counts, prompts,603a seeds, model version),
   - `lora` × 3 slots (character / prop / environment, via tags + metadata),
   - `image` shot first/last frames,
   - `video` generated shot(s),
   - `splat` environment + `scene` camera path,
   - `resource` workflow template entry.
   - Lineage: `parent_asset_ids` + `provenance` (operation, prompt, model,
     provider, LoRA ids) forming design → dataset → LoRA → frames → video.
3. **Jobs across the lifecycle.** Minimum: `dataset-prep` running with progress,
   `lora-train` running + one queued, `image-to-video` running, one
   `3d-reconstruction`/`splat-train`, one `succeeded` (implies asset), one
   `failed` with retryable error, one `canceled`. Every job has progress,
   attempt, timestamps; failed jobs carry `{code, message, retryable}`.
4. **Providers.** Minimum: local ComfyUI (`local`, available), training rental
   (`cloud`, RunPod/vast.ai, available or degraded), studio/cloud video
   (`cloud`). Capabilities list operation IDs from `docs/PRODUCTION_PIPELINE.md`.
5. **Queries.** `getHomeSummary`, `listProjects`, `listRecentAssets`,
   `listProviders` (existing) plus `listAssetsByProject`, `listJobs`
   (filterable by project/status), `getProjectDetail` (project + its assets +
   its jobs). Query keys centralized in `lib/queryKeys.ts`; hooks in
   `hooks/useQueries.ts`.

## 2. Provenance / metadata conventions for fakes

- `provenance.operation_id` = operation ID from `docs/PRODUCTION_PIPELINE.md`.
- `provenance.prompt` set on generated assets; `params` holds user-facing
  settings only (never raw node JSON).
- `metadata` carries UI-relevant extras: `sequence`, `shot`, `lora_slot`
  (`character|prop|environment`), `dataset_spec`, `camera_path`,
  `publish_receipt` (`comment`, `publisher`, `sidecar` note).
- `storage.key` follows `docs/PROJECT_FOLDERS.md` POSIX relative paths;
  `Output/` vs `Publish/` visible in keys.
- Deterministic timestamps via `REFERENCE_NOW` + `isoMinutesAgo` (existing
  pattern). External images via `picsum.photos` seeds only.

## 3. Fake behavior rules

- Simulated latency via `env.mockLatencyMs`; never real network.
- Deterministic sort (newest first) and stable IDs (UUID-shaped constants).
- Include empty/error states: archived-only filter, zero-asset project path,
  failed-job retry affordance. Screens must handle all of them.
- No secrets, no real GPU calls, no backend imports from `frontend/`.

## 4. Screen contracts (Phase 1b)

Routes in `frontend/src/navigation/routes.ts` stay stable. Each new screen:

- consumes hooks only (never mock imports directly),
- renders loading (`Skeleton`), error (`EmptyState` + retry), empty, and
  populated states,
- derives display values in `lib/` view-model helpers, not inline in JSX.

## 5. Definition of "enough fakes"

Backend hookup is unblocked when: a builder can render project → shots →
assets → lineage → jobs → providers entirely from mocks, submit-shaped actions
are represented as mock job entries with realistic progress, and `npm run lint
&& npm test && npm run build` passes from `frontend/`.

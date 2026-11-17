# Autonomous Development Backlog (studio-platform)

This is the single ordered work queue for the scheduled agents. It exists so the
workforce **never idles and never waits for a human decision**. Product vision
lives in `PRODUCT_VISION.md`; sequence of delivery lives in `DEVELOPMENT_ROADMAP.md`;
this file is the execution checklist.

## Rules for all agents

1. At the start of every run, read this file, `AGENTS.md`, and `docs/AGENT_WORKFLOW.md`.
2. Pick the **highest-priority unchecked item in your ownership column**. Implement it
   fully (including tests and all UI states), verify, commit only your owned paths,
   then tick the box with a date and commit hash and append a one-line note to the
   log at the bottom. Ship at least one complete item per run, then finish promptly —
   the linked loop starts the next agent the instant you end. Several items per run
   are welcome when quick; the timeout is only a safety cap, never a work target.
3. **Never mark anything "blocked on human", "needs approval", or "gated".** Phases 2–6
   are all open. If an item needs a decision, make the smallest reversible choice,
   document it inline, and move on.
4. If your owned column is empty, do not report QUEUE-EMPTY and stop. Either pull the
   next unblocked item from another column you are permitted to write, or **add the
   next high-value improvement to your own column yourself** (test coverage, error
   paths, accessibility, perf, docs accuracy) and ship it. The "Never-empty well"
   section is a permanent source of extra work.
5. Never change a shared interface on one side only: `frontend/src/types` mirrors
   `backend/app/schemas` and is enforced by `backend/tests/test_contract_parity.py`.
6. Never push, pull, or rebase. Stage only the paths you own.

## Ownership

| Agent | May write | Never write |
|-------|-----------|-------------|
| `studio-backend-core` | `backend/**`, `frontend/src/types/**`, `docs/AUTONOMOUS_BACKLOG.md` (backend rows) | `frontend/src/{features,lib,hooks,api,app,layout,navigation,ui,styles}` |
| `studio-screens` | `frontend/src/{app,layout,navigation,stores,ui,features,styles}`, `App.tsx`, `main.tsx`, `index.css`, backlog (screens rows) | `frontend/src/{types,lib,hooks,api}`, `backend/**`, `.github/**` |
| `studio-mocks` | `frontend/src/{lib,hooks,api}`, `frontend/src/lib/mock/**`, backlog (mocks rows) | `frontend/src/{types,features,app,layout,navigation,ui,styles}`, `backend/**`, `.github/**` |
| `studio-ci` | `.github/**`, repo config, CI/test tooling, backlog (CI rows) | product code under `frontend/src/**` or `backend/app/**` |

## Phase 2 — Backend hookup (OPEN — owner: backend-core, mocks, screens)

- [x] P2.1 Operations/jobs API: `GET /operations` catalog + `GET/POST /jobs`,
  `GET /jobs/{id}`, `POST /jobs/{id}/cancel`, `POST /jobs/{id}/retry` backed by a
  repository + in-memory/SQLite store; respect `JobListQuery`, `JobError`,
  `JobEvent`. Add backend tests. ✅ 2026-11-17 — `76df39d`
- [x] P2.2 Providers + capability query API: `GET /providers`, `GET /providers/{id}`,
  `GET /capabilities` using existing schemas; add tests. ✅ 2026-11-17 — `e055870`
- [x] P2.3 Orchestration API: plan/run endpoints, presence, comments, storage stats
  using existing `orchestration` schemas; add tests. ✅ 2026-11-17 — `93a56fd`
- [x] P2.4 Auth/session API: login/refresh/session, organizations and members using
  existing `auth` schemas; dev-local auth adapter, no external IdP required yet. ✅ 2026-11-17 — `d338f11`
- [x] P2.5 Workspaces/extension registry API: list/install/enable/disable extensions
  with permission checks; a stub registry is fine as long as contracts hold. ✅ 2026-11-17 — `3c1488a`
- [x] P2.6 Real-time job state: WebSocket or SSE stream for job events/presence,
  with a graceful polling fallback; document the contract. ✅ 2026-11-17 — `f7d243e`
- [x] P2.7 Live-mode transport: finish `frontend/src/lib/httpApiClient.ts` against the
  new routers; make `VITE_API_MODE=live` work end-to-end without screen rewrites.
  ✅ 2026-11-17 — `9e817d6`
- [x] P2.8 Wire screens to live mode behind the existing `ApiClient` interface; keep
  mock mode working. Add a contract/integration smoke test for both modes.
  (2026-11-17, 5c9436c)

## Phase 3 — Asset management (owner: backend-core + screens)

- [x] P3.1 Materialize the project folder tree (`docs/PROJECT_FOLDERS.md`) on disk:
  `Pipeline/`, `Projects/Default/`, `Assets/Char|Prop|Env`, `Shots/s01_c01`,
  `Output/` vs `Publish/`. ✅ 2026-11-17 — `f5bdfa9`
- [x] P3.2 `Ver_NNN` ↔ `AssetVersion` mapping with immutable Publish copies and
  publish receipt sidecars. ✅ 2026-11-17 — `1fa8f81`
- [x] P3.3 Reference links (`.link.txt` fallback + `.links.json`) with dry-run plan
  mode; never copy weights. ✅ 2026-11-17 — `4c45a40`
- [x] P3.4 Asset search/filter, previews and metadata editing in the UI.
  (2026-11-17, cc7a398) — local-optimistic editor; needs `updateAsset` hook to persist.
- [x] P3.5 Settings screen: backend URL, API mode, provider connections, test button.
  (2026-11-17, d7f1c3c) — live provider refetch test; runtime mode/URL switcher pending.
- [x] P3.6 (mocks/backend/screens) Expose `PATCH /assets/{id}` as `updateAsset` on `ApiClient`
  + `useQueries` mutation so the P3.4 metadata editor can persist edits.
  ✅ 2026-11-17 — `32f0053` (mocks transport: `updateAsset` across mock/live + `useUpdateAsset`);
  `b9a2ef0` (screens) wires the editor.

## Phase 4 — First production capability (owner: backend-core + mocks + screens)

- [x] P4.1 Provider adapters: local ComfyUI + cloud/RunPod adapter interfaces behind
  one execution contract; simulate locally so UI works without GPU. ✅ 2026-11-17 — `a71390e`
- [x] P4.2 Dataset-prep → ai-toolkit YAML → LoRA-train operation chain as real job
  operations with lineage. ✅ 2026-11-17 — `657ed3a`
- [x] P4.3 First/last-frame + video generation operations with LoRA auto-mounting. ✅ 2026-11-17 — `eca98f8`
- [x] P4.4 Splat/COLMAP + camera-path bridge operations (CPU smoke mode by default). ✅ 2026-11-17 — `5ea7d51`
- [x] P4.5 GPU validation harness: scripted end-to-end smoke run targeting
  `ssh gpu-reach` box; record real numbers, replace provisional mock values.
  ✅ 2026-11-17 — `bba1718` (harness + `backend/data/gpu-smoke.json`, gitignored).
  Real numbers: Tesla M60 8 GB, CUDA 12.4 / torch 2.6.0+cu124, sm_52,
  **1.856 TFLOP/s FP32** (2048² matmul ×10, 0.0926 s), 8318 MiB free at rest.
  Box alias is `gpu-resource` (see `~/GPU-RESOURCE.md`); "replace provisional mock
  values" in frontend provider cards remains a mocks-agent follow-up.
- [x] P4.6 Chat screen: connect conversations API to a real orchestration loop with
  streaming events. (2026-11-17, 51146fd) — conversation/message hooks wired, streaming
  statuses surfaced; composer optimistic pending send mutation + stream (P4.7).
- [x] P4.7 (mocks/backend) Add `sendMessage` mutation + conversation stream events to
  `ApiClient`/`useQueries` so the P4.6 composer can send and stream for real.
  ✅ 2026-11-17 — `15accbb` (mocks transport) + `b48f4e2` (screens) — composer sends via
  `useSendMessage` and renders live `delta`/`message_complete` events from `useConversationStream`.

## Phase 5 — Extension platform (owner: backend-core + screens)

- [x] P5.1 Manifest/schema + registration, install/remove, enable/disable.
  ✅ 2026-11-17 — `3c1488a` (delivered with P2.5: manifest contracts in `provider.py`,
  stub registry, install/uninstall + enable/disable lifecycle with permission gates).
- [x] P5.2 Permission enforcement and isolation boundary for extensions.
  ✅ 2026-11-17 — `d2e04cb` — runtime permission guard over installed extensions:
  authorize permission/capability within declared+accepted scope (403 on undeclared
  or disabled), plus an effective isolation-scope view (providers/UI contributions);
  12 new tests green on memory+sqlite (440 passed).
- [x] P5.3 SDK + connector examples; replace the Extensions placeholder screen.
  ✅ 2026-11-17 — `746f7a0` — registry from `useExtensions`, permission/capability/trust cards,
  SDK examples; loading/error/empty/populated states + helper unit tests.

## Phase 6 — Professional capabilities (owner: all)

- [x] P6.1 Workspaces with collaboration roles and presence.
  ✅ 2026-11-17 — `a152ae8` — organizations/session, derived owner/member/viewer roles,
  presence and comments panels with loading/error/empty/populated states.
- [x] P6.2 Multiple providers/local runtimes with health/degraded states.
  ✅ 2026-11-17 — `0093a77` — health summary (available/degraded/unavailable), per-location
  runtime groups, location/status filters and degraded-state guidance.
- [x] P6.3 Advanced lineage graph UI + audit trail.
  ✅ 2026-11-17 — `14e128c` — depth-layered parent/child graph + chronological
  asset/publish/job audit trail on project detail, with cycle-safe helpers.
- [x] P6.4 Audio integration (TTS/dialogue hooks) behind capability flags.
  ✅ 2026-11-17 — `978689c` — Chat capability-gated dialogue/TTS panel; enabled only when a
  provider advertises an available audio operation, with script parsing + tests.
- [x] P6.5 Export paths to UE / Blender.
  ✅ 2026-11-17 — `aa72e04` — published-asset export panel with provisional UE/Blender path
  convention, target filters and compatibility badges (backend export endpoint pending).

## Never-empty well (pick these when your column is otherwise done)

- [x] C1 Expand backend tests for error envelopes, auth failures, pagination and
  concurrency; keep ≥90% coverage of routers. ✅ 2026-11-17 — `e052792`
- [x] C2 Expand frontend tests for loading/error/empty/populated states on every
  screen and for live-vs-mock parity.
  ✅ 2026-11-17 — `85a7aee` — added empty/populated/error display-state tests for jobs,
  version chains and providers (parity guard owned by mocks/CI).
- [x] C3 Accessibility pass: keyboard navigation, focus rings, ARIA labels, contrast.
  ✅ 2026-11-17 — `92edce5` — skip link + focusable main, Up/Down roving focus in sidebar,
  subtle-text contrast raised to >=4.5:1 (existing focus-visible ring retained).
- [x] C4a Replace single-glyph navigation icons with a real icon set (owner: screens).
  ✅ 2026-11-17 — `2e4c084` — dependency-free inline SVG icon set on all nav items; text glyph kept as fallback.
- [x] C4b Add Tauri build job to CI with cached Rust target (owner: CI) — 2026-11-17, b282dba.
- [x] C5 Add a real router ( History API deep links) without changing `RouteId`.
  ✅ 2026-11-17 — `647ac19` — `parseRoutePath`/`buildRoutePath` with entity segments,
  store selection sync + replaceState, deep-linked project/asset/chat screens.
- [ ] C6 Docs accuracy pass: keep README, API.md, architecture docs and this backlog
  in sync with what is actually shipped.
- [x] C7 Add `pytest-cov` coverage tooling + CI >=90% gate to support C1 (owner: CI) — 2026-11-17, d1d7d9d.
- [x] C8 Add Vitest V8 coverage tooling (`npm run test:coverage`) + informational CI report to support C2 (owner: CI) — 2026-11-17, 08f10c8.
- [x] C9 Harden CI workflow: read-only `contents` permission + per-ref concurrency with `cancel-in-progress` (owner: CI) — 2026-11-17, f531ea8.
- [x] C10 Add per-job `timeout-minutes` (frontend 20, backend 15, tauri 30) to bound runner usage (owner: CI) — 2026-11-17, 9def03b.
- [x] C11 Pin GitHub Actions to immutable commit SHAs (checkout/setup-node/setup-python/dtolnay rust-toolchain/rust-cache) to prevent tag-mutation supply-chain drift; add explicit `toolchain: stable` for the SHA-pinned rust toolchain (owner: CI). ✅ 2026-11-17 — `fd9cf91`
- [x] C13 (screens) Complete C2 display-state coverage for the remaining features
  (asset search/filter, project timestamps, workflow templates, lineage stages) and
  fix Design assets leaking into the lineage "Other" stage.
  ✅ 2026-11-17 — `777ba82` — empty/populated helper tests for assets, projects,
  workspaces and lineage; buildLineageStages no longer duplicates Design assets.
- [x] C12 Global Cmd/Ctrl+K quick switcher (owner: screens) — filterable route palette with keyboard nav, header trigger, no route changes. ✅ 2026-11-17 — `777ba82`
- [x] C13 App-level error boundary + reduced-motion support (owner: screens) — render failures show a retry card without losing the shell. ✅ 2026-11-17 — `0ee0fae`
- [x] C14 Non-blocking job-retry feedback (owner: screens) — replace `window.alert` with inline staged-retry status. ✅ 2026-11-17 — `67c1ece`
- [x] C15 Home per-section empty states + persisted asset edits (owner: screens) — empty sections in live mode; metadata editor uses `useUpdateAsset`. ✅ 2026-11-17 — `b9a2ef0`
- [x] C14 (backend) Authoritative UE/Blender export path endpoint replacing the
  UI-only provisional convention (P6.5 follow-up).
  ✅ 2026-11-17 — `6ddb5bd` — `GET /projects/{id}/exports` + `/assets/{id}/exports`,
  same slug/path strings as the frontend helper, plus `source_exists`; 10 new tests green (486 passed).
- [x] C15 (backend) Docs accuracy pass for `backend/README.md`: document all
  mounted routers, env vars (incl. `STUDIO_ROOT`/quota) and current boundaries.
  ✅ 2026-11-17 — `c7ce5bc` (C6 remains open for repo-wide docs owned by other agents).
- [x] C17 (backend) OpenAPI route-surface guard: assert every route is under
  `/api/v1`, operation IDs are unique, and 404s across all resource families use
  the shared error envelope + request-id header.
  ✅ 2026-11-17 — `f9d255d` — 3 new tests (493 passed, 98% coverage).
- [x] C16 Add Dependabot weekly dependency updates for npm/pip/cargo/GitHub
  Actions (owner: CI) — 2026-11-17 — `464e712` — re-pins the SHA-pinned actions
  from C11 and bumps lockfiles on a weekly cadence; complements the frozen refs.

## Log (append one line per completed item)

- 2026-11-17 — backlog created; Phase 2 declared open; backend agent revived.
- 2026-11-17 — P2.1 shipped (`76df39d`): static operation catalog, job submit/list/get/cancel/retry, recoverable event stream; 40 new tests green on memory+sqlite.
- 2026-11-17 — P2.2 shipped (`e055870`): seeded local/studio/cloud provider registry, GET /providers, /providers/{id}, /capabilities filtered by operation+location; 18 new tests green.
- 2026-11-17 — P2.8: added ApiClient contract smoke test covering mock + live transports (5c9436c); screens already consume hooks only, no mode-specific code.
- 2026-11-17 — b282dba — C4b: added Linux Tauri shell CI job (`npx tauri build --no-bundle`) with `Swatinem/rust-cache` target cache + WebKit/GTK deps; README CI section synced; frontend lint/test/build and backend pytest verified green.
- 2026-11-17 — d1d7d9d — C7: added `pytest-cov` dev dep, `[coverage:*]` config in pytest.ini, and a CI coverage gate (`--cov=app --cov-fail-under=90`, currently 96%) to guard C1's router-coverage goal; plain `python3 -m pytest -q` still green (188 passed).
- 2026-11-17 — P3.4 shipped (`cc7a398`): asset detail panel with provenance/storage, editable name/tags/metadata (local-optimistic), selectable grid/list/shot items, helper unit tests; added P3.6 for mocks/backend to expose `updateAsset`.
- 2026-11-17 — P3.5 shipped (`d7f1c3c`): Settings screen replacing placeholder — active vs draft API mode/base URL with validation, provider connections with enable toggles, live connection test via provider refetch.
- 2026-11-17 — P4.6 shipped (`51146fd`): Chat screen on useConversations/useMessages/useProjects hooks with conversation + message threads, streaming-status indicators, optimistic composer; added P4.7 for mocks/backend write+stream API.
- 2026-11-17 — `9e817d6` — P2.7: rewrote live `httpApiClient` to mount under `/api/v1` exactly once, normalize `ApiError`, inject bearer tokens, assemble home/detail view models client-side, and degrade optional jobs/providers routers; 9 transport tests green.
- 2026-11-17 — `9e817d6` — P4 mocks-facing: added operation-catalog, capability-discovery, conversation and message queries atomically across mockApi/ApiClient/httpApiClient/queryKeys/hooks with seeds and 12 mock+live+key tests; lint/test/build green.
- 2026-11-17 — 08f10c8 — C8: added `@vitest/coverage-v8` dev dep, `test:coverage` script, V8 coverage config in vite.config.ts and an informational CI coverage step (baseline ~29% statements, no gate); ignored coverage/ artifacts; README CI section synced.
- 2026-11-17 — f531ea8 — C9: workflow-level `permissions: contents: read` and `concurrency` group keyed by `github.ref` with `cancel-in-progress: true`; YAML validated, all three jobs intact.
- 2026-11-17 — 9def03b — C10: added `timeout-minutes` to all three jobs (frontend 20, backend 15, tauri 30); YAML validated.
- 2026-11-17 — `e052792` — C1: added 14 cross-cutting backend tests (×2 storage adapters) for the shared error envelope, request-id propagation, dev-local auth headers, pagination bounds and burst-submission stability; 234 tests green.
- 2026-11-17 — `a9b27a8` — P4/P5 mocks parity: added auth/session, orchestration-run, presence, comments, storage-stats and extension-registry queries atomically across mockApi/ApiClient/httpApiClient/queryKeys/hooks with seeded populated+empty/error states and 9 new tests; lint/test/build green.
- 2026-11-17 — `1d96047` — C2 (mocks side): added a live-vs-mock parity guard driving both transports over the same seeds across all 27 queries plus empty/not-found and error cases; fixed two ordering drifts it found (mock activeJobs and live comments now newest-first). Screen-state coverage remains with the screens agent.
- 2026-11-17 — `618b63f` — C2 (mocks side): added injectable error-state fakes (`setMockFailure`/`clearMockFailures`) so mock mode can surface normalized `ApiError` failures per domain or globally, with reset-safe tests; mock mode now covers loading/empty/error/populated parity with live.
- 2026-11-17 — `f7d243e` — P2.6: SSE job-event stream (`/jobs/{id}/events/stream?since=&idle_timeout=`) with resume cursor, idle close and documented polling fallback to `GET /jobs/{id}/events`; 10 new tests green on memory+sqlite (244 passed).
- 2026-11-17 — `93a56fd` — P2.3 rescued from an interrupted concurrent run: deterministic local planner, plan/run reads, presence upsert, comments, storage stats; 32 new tests green on memory+sqlite (276 passed).
- 2026-11-17 — `746f7a0` — P5.3: replaced Extensions placeholder with a registry screen (useExtensions hook; permission/capability/trust cards; loading/error/empty/populated states) plus SDK/connector examples shipped as data and helper unit tests; lint/test (86 passed)/build green.
- 2026-11-17 — `92edce5` — C3: skip link with focusable main, Up/Down roving focus across sidebar nav links, and subtle-text contrast raised from ~3.5:1 to >=4.5:1 on surfaces; lint/test/build green.
- 2026-11-17 — `d338f11` — P2.4: dev-local bearer auth adapter (login/refresh with rotation, /auth/session, /auth/me), orgs + member invites with unique-slug/duplicate guards; 38 new tests green on memory+sqlite (314 passed).
- 2026-11-17 — `3c1488a` — P2.5: seeded stub extension registry, permission-gated install (rejects unaccepted permissions), enable/disable/uninstall lifecycle with idempotency; 20 new tests green on memory+sqlite (334 passed).
- 2026-11-17 — `a152ae8` — P6.1: Workspaces screen now shows organization/session identity, derived collaboration roles (owner/member/viewer), live presence and project comments from hooks, with all UI states and helper tests.
- 2026-11-17 — `15accbb` — P2.7 follow-up: aligned live presence/comments paths with the mounted backend routers (`/presence`, `/comments` instead of `/collaboration/*`) in both `lib/httpApiClient` and typed `api/orchestration`, updated parity/live tests, and re-exported `PresenceState`; lint/test (97 passed)/build green.
- 2026-11-17 — `f5bdfa9` — P3.1: canonical on-disk project tree materialization/verification (`/projects/{id}/tree`), dir-only Default template, studio-root config, name/kind/version helpers; 12 new tests green (346 passed).
- 2026-11-17 — `0093a77` — P6.2: Providers screen now shows a health summary, per-location runtime groups, location/status filters, and degraded/unavailable guidance, with helper tests.
- 2026-11-17 — `b48f4e2` — P4.7 screens follow-up: Chat composer uses `useSendMessage` with pending/error states and renders streamed assistant replies from `useConversationStream`; removed the temporary optimistic chat store.
- 2026-11-17 — `15accbb` — P4.7 (mocks transport): added `sendMessage` mutation + resumable `openConversationStream` to `ApiClient`/mock/live transports, `useSendMessage` + `useConversationStream` hooks, deterministic ordered stream events, seeded sent-message store, `messages.all` key, and error-state guards; 4 new tests across mock/live/key suites; lint/test (101 passed)/build green. Screens composer wiring is a screens-agent follow-up.
- 2026-11-17 — `1fa8f81` — P3.2: publish ceremony — Ver_NNN↔AssetVersion mapping, immutable `Publish/` copies with `_vNNN` suffix, JSON receipt sidecars + registry metadata, idempotent replay and byte-change conflict guard; 17 new tests green (363 passed).
- 2026-11-17 — `fd9cf91` — C11: pinned all five GitHub Actions in `.github/workflows/ci.yml` to full commit SHAs (immutable refs) with version comments, plus explicit `toolchain: stable` for dtolnay; YAML validated, all three jobs intact; frontend lint/test/build (104 tests) and backend pytest (379 passed) green.
- 2026-11-17 — `4c45a40` — P3.3: reference links with side-effect-free dry-run plan, symlink apply + `.link.txt` fallback, `Resources/.links.json` registry, conflict/traversal guards; never copies weights (`copied_bytes` always 0); 16 new tests green (379 passed).
- 2026-11-17 — `978689c` — P6.4: Chat gains a capability-gated audio/dialogue panel that enables only when a provider advertises an available TTS/voice operation; script parsing + helper tests.
- 2026-11-17 — `aa72e04` — P6.5: Project detail now shows Unreal/Blender export paths for published assets with target filters, provisional path convention and tests.
- 2026-11-17 — `647ac19` — C5: History API deep links for `/projects/{id}`, `/assets/{id}`, `/chat/{id}` via pure parse/build helpers; UI store restores selections on load/back-forward and mirrors in-screen selection changes with replaceState.
- 2026-11-17 — `2e4c084` — C4a: sidebar now renders a dependency-free inline SVG icon set (one named icon per RouteId) instead of single-character glyphs.
- 2026-11-17 — `85a7aee` — C2: added empty/populated/error display-derivation tests for jobs, version chains and provider helpers; live-vs-mock parity remains covered by the mocks-owned parity guard.
- 2026-11-17 — `777ba82` — C12: added a global Cmd/Ctrl+K quick switcher (searchable route palette, arrow/enter keyboard nav, header trigger) that navigates through the UI store without changing RouteId.
- 2026-11-17 — `0ee0fae` — C13: wrapped the active screen in an error boundary with a retry action and added a global prefers-reduced-motion rule.
- 2026-11-17 — `67c1ece` — C14: job retry no longer opens a blocking browser alert; it shows an inline, accessible staged-retry status instead.
- 2026-11-17 — `b9a2ef0` — P3.6 screens wiring + C15: asset metadata editor now persists via `useUpdateAsset` with pending/error states; Home sections render explicit empty states for live-mode empty data.
- 2026-11-17 — `a71390e` — P4.1: one `ExecutionAdapter` contract with simulated local-ComfyUI/cloud-RunPod runtimes, adapter inventory + health endpoints and `POST /jobs/{id}/run` wired to job start/progress/result transitions; 20 new tests green (399 passed).
- 2026-11-17 — `657ed3a` — P4.2: real dataset-prep + lora-train job chain, deterministic ai-toolkit YAML with config hash, dataset/config/LoRA assets linked by `derived_from` lineage; 15 new tests green (414 passed).
- 2026-11-17 — `d2e04cb` — P5.2: runtime extension permission guard (authorize declared+accepted permission/capability, 403 on undeclared/disabled) plus isolation-scope view; 12 new tests green (440 passed).
- 2026-11-17 — `eca98f8` — P4.3: shot pipeline (first/last-frame -> flf2v, else image-to-video) with automatic LoRA slot mounting, frame/asset lineage and slot filtering; 18 new tests green (460 passed).
- 2026-11-17 — `5ea7d51` — P4.4: splat pipeline (footage -> COLMAP model3d -> splat-train) with sampled camera-path bridge, scene/lineage assets and CPU smoke mode by default; 17 new tests green (477 passed).
- 2026-11-17 — `777ba82` — C13 (screens): completed C2 state-derivation coverage for assets/projects/workspaces/lineage (empty/populated/error-safe cases) and fixed buildLineageStages duplicating Design assets into Other; lint/test (137 tests)/build green.
- 2026-11-17 — `3c1488a`/`6ddb5bd` — P5.1/C14: marked extension manifest+registry item delivered by the P2.5 registry commit; added authoritative backend UE/Blender export endpoints matching the UI path convention (486 passed).
- 2026-11-17 — `c7ce5bc` — C15: backend README now lists every mounted router, all env vars and honest Phase 4 boundaries (simulated adapters, SSE + polling, dev-local auth).
- 2026-11-17 — `bba1718` — P4.5: harness ran a real CUDA probe on `ssh gpu-resource` (Tesla M60, 1.856 TFLOP/s FP32, 0.0926 s for 10×2048² matmuls); measurements recorded in gitignored `backend/data/gpu-smoke.json` and in this log; 4 harness tests green (490 passed).
- 2026-11-17 — `32f0053` — P3.6 (mocks): added `updateAsset` mutation atomically across mockApi (overlay store + not-found/deleted/null-name errors), the stable `ApiClient` facade, live `httpApiClient` (PATCH), `queryKeys.assetWriteRoots()` and `useUpdateAsset`; 8 new tests, parity surface guard extended; lint/test (144 passed)/build green.
- 2026-11-17 — `464e712` — C16: added `.github/dependabot.yml` with weekly updates for npm (frontend), pip (backend), Cargo (frontend/src-tauri) and GitHub Actions (re-pins C11 SHAs); validated both CI YAML files; frontend lint/test/build (144 tests) and backend pytest (490 passed) green.
- 2026-11-17 — `f9d255d` — C17: OpenAPI guard locks the API surface (68 paths, 87 ops) — prefix, unique operationIds, uniform error envelope; 3 tests green (493 passed).

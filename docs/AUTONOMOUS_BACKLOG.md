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
- [x] C18 (backend) Authoritative project audit-trail API (P6.3 follow-up):
  `GET /projects/{id}/audit` derives asset/publish/job events from the
  authoritative stores, with kind + inclusive time bounds + limit, shared 404/422
  envelopes; contracts mirrored in `frontend/src/types/audit.ts`.
  ✅ 2026-11-17 — `9f74936` — 14 new tests green on memory+sqlite (507 passed).
  Screens/mocks wiring of the new query is a follow-up for those agents.
- [x] C19 (screens) Project detail storage panel: wired the existing
  `useStorageStats` hook into a Storage card with loading/error/empty/populated
  states; display values derived in `storageHelpers` (byte/count formatting,
  quota tone, over-quota detection) with unit tests.
  ✅ 2026-11-17 — `7a6cd7d`
- [x] C20 (mocks) Wire the authoritative project audit API (C18) end to end:
  expose `getProjectAudit` / `useProjectAudit` atomically across mockApi,
  ApiClient, httpApiClient, queryKeys and useQueries with populated/empty/error
  seeds. ✅ 2026-11-17 — `5b7a2d4`
- [x] C20b (screens) Render the authoritative audit feed on project detail via
  `useProjectAudit`, replacing the derived-only view. Backend endpoint, TS
  contracts and the mocks transport (C20) are already shipped.
  ✅ 2026-11-17 — `4988d27` — hook-backed `AuditFeedPanel` on project detail with
  loading/error/missing/empty/populated states, kind filters and helper-derived
  display values; `LineageGraph` is now graph-only and the derived audit helpers
  were retired; lint/test (170)/build green.
- [x] C21 (CI) Add a workflow self-validation job: pinned `actionlint` (Go module
  `...@v1.7.12`) lints all `.github/workflows/*.yml` on every push/PR so future CI
  config edits are checked automatically, bounded by a 10-minute timeout.
  ✅ 2026-11-17 — `3f960e4`
- [x] C22 (backend) Authoritative cross-domain search API: `GET /api/v1/search?q=`
  ranks matches across projects/assets/conversations derived from the authoritative
  stores (no second index), with `kind`/`limit` filters, shared 404-free/422 envelopes,
  `SearchResult`/`SearchResponse`/`SearchResultKind` mirrored in TS, and success +
  failure tests on memory+sqlite. ✅ 2026-11-17 — `3b9c6d1`
  Wire-up in mocks/screens (`getSearch`/`useSearch`, quick-finder) is a follow-up for those agents.
- [x] C23 (mocks) Wire the authoritative cross-domain search API (C22) end to
  end: add `search` to `ApiClient` + a `useSearch` hook (the C22 `getSearch`
  follow-up) atomically across mockApi (seed-derived ranking + router-style 422
  validation + injectable failure), the stable facade, live httpApiClient
  (`GET /search?q=&kind=&limit=`), queryKeys and useQueries (blank-query gated),
  with a shared `lib/search` derivation helper, populated/empty/error seeds and
  tests; parity guard extended. ✅ 2026-11-17 — `f51189e`
  Screens quick-finder rendering via `useSearch` remains a screens follow-up.

- [x] C24 (CI) Add a live-mode HTTP smoke job: boots the real ASGI server
  (`uvicorn`, in-memory store) and exercises the exact `/api/v1` URLs the
  `VITE_API_MODE=live` client depends on (health/projects/providers/capabilities/search)
  plus the shared 422 error envelope + request-id, bounded by a 10-minute timeout.
  ✅ 2026-11-17 — `941a8ec`
- [x] C25 (backend) Authoritative dashboard summary API: `GET /api/v1/dashboard`
  derives workspace counts, zero-filled job-status/asset-type breakdowns and the
  newest jobs/assets from the authoritative stores (deleted assets excluded),
  with `recent_limit` bounds + shared 422 envelope; `DashboardCounts`/
  `DashboardSummary` mirrored in `frontend/src/types/dashboard.ts`, 5 tests × 2
  storage backends green (531 passed, 98% coverage). Screens/mocks wiring of the
  snapshot is a follow-up for those agents. ✅ 2026-11-17 — `26d6e99`

- [x] C26 (screens) Wire the authoritative cross-domain search (C22/C23) into the
  Cmd/Ctrl+K quick finder: ranked project/asset/conversation results navigate to
  entity deep links, with hint/searching/error/empty/populated states; display and
  navigation mapping derived in `quickFinderHelpers` with unit tests. `useDashboard`
  snapshot wiring (C25 follow-up) remains blocked on mocks transport.
  ✅ 2026-11-17 — `27907a9`

- [x] C27 (mocks) Wire the authoritative dashboard summary API (C25) end to end:
  expose `getDashboard` / `useDashboard` atomically across mockApi (seed-derived
  counts, zero-filled breakdowns, newest-first recency, deleted-asset exclusion,
  router-style 422 and an injectable `dashboard` failure), the stable `ApiClient`
  facade, live `httpApiClient` (`GET /dashboard?recent_limit=`), `queryKeys` and
  `useQueries`, with shared `lib/dashboard` derivation + populated/empty/error
  tests; the live-vs-mock parity guard is extended to cover both transports.
  ✅ 2026-11-17 — `b0f0fd7`

- [x] C28 (CI) Extend the live-mode HTTP smoke job with the newly live-wired
  authoritative endpoints from C25/C27 (`GET /dashboard` snapshot shape,
  `recent_limit` bound + shared 422 envelope) and C18/C20
  (`GET /projects/{id}/audit`, creating a project when the in-memory store is
  empty), keeping CI aligned with the exact `/api/v1` URLs the
  `VITE_API_MODE=live` client calls as the repo grows.
  ✅ 2026-11-17 — `c177c6b`

- [x] C29 (backend) Authoritative workspace activity feed API: `GET /api/v1/activity`
  with `project_id`/`kind`/`limit` filters derives newest-first asset/publish/job/
  comment events (with actor + project context) from the authoritative stores —
  a cross-project complement to the per-project audit (C18). `ActivityEvent`/
  `ActivityFeed`/`ActivityKind`/`ActivityTone` mirrored in `frontend/src/types/activity.ts`,
  shared 404/422 envelopes, 5 tests × 2 storage backends green. Mocks/screens/CI
  wiring of the feed is a follow-up for those agents. ✅ 2026-11-17 — `b69a42f`

- [x] C30 (screens) Wire the authoritative dashboard snapshot (C25/C27) into the
  Home screen via `useDashboard`: a Workspace snapshot card showing authoritative
  entity counts, zero-filled job-status/asset-type breakdowns, recent jobs/assets
  and a generated-at footer; all display values derived in `dashboardHelpers`
  with unit tests; loading/error/missing/empty/populated states. Resolves the C26
  dashboard-wiring follow-up now that C27 shipped the mocks transport.
  ✅ 2026-11-17 — `759c201`

- [x] C31 (mocks) Wire the authoritative workspace activity feed (C29) end to
  end: expose `getActivity` / `useActivity` atomically across mockApi (seed-derived
  asset/publish/job/comment events with actor + project context, project/kind/limit
  filters, router-style 422 + unknown-project 404 + injectable `activity` failure),
  the stable `ApiClient` facade, live `httpApiClient` (`GET /activity?project_id=&kind=&limit=`),
  `queryKeys` and `useQueries`, with a shared `lib/activity` derivation/validation
  helper and populated/empty/error seeds; parity guard extended to both transports.
  ✅ 2026-11-17 — `80ba424`
  Screens feed rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C32 (CI) Extend the live-mode HTTP smoke job with the authoritative
  workspace activity feed (C29/C31 follow-up): probe `GET /api/v1/activity` feed
  shape (`events`/`total`), `kind`/`limit` filters and the shared 422 validation
  and 404 `project_not_found` envelopes, keeping CI aligned with the exact
  `/api/v1` URLs the `VITE_API_MODE=live` client calls as the repo grows.
  ✅ 2026-11-17 — `1419b48`

- [x] C33 (backend) Authoritative asset tag facets API: `GET /api/v1/tags?project_id=&prefix=&limit=`
  derives a most-used-first, deduplicated tag index (count of non-deleted assets per tag)
  from the authoritative asset store — no second index; optional case-insensitive prefix
  filter for autocomplete, project scoping with shared 404/422 envelopes, deterministic
  cross-backend ordering; `TagFacet`/`TagIndex` mirrored in `frontend/src/types/tags.ts`,
  6 tests × 2 storage backends green (553 passed, 98% coverage). Mocks/screens/CI wiring
  of the index is a follow-up for those agents. ✅ 2026-11-17 — `7be2a4f`

- [x] C34 (backend) Authoritative downstream asset impact API:
  `GET /api/v1/assets/{asset_id}/impact?max_depth=` derives every asset transitively
  derived from a root from the authoritative relationship store — a downstream
  complement to the existing upstream `/assets/{id}/lineage` endpoint, with BFS
  depth labeling, cycle safety, deleted-asset exclusion, deterministic cross-backend
  ordering and shared 404/422 envelopes. `AssetImpact`/`ImpactNode` mirrored in
  `frontend/src/types/impact.ts`; 6 tests × 2 storage backends green (565 passed).
  Mocks/screens/CI wiring of the endpoint is a follow-up for those agents.
  ✅ 2026-11-19 — `4f2f6d9`

- [x] C35 (screens) Render the authoritative workspace activity feed (C29/C31
  follow-up) on Home via `useActivity`: kind/limit filter chips with loading,
  error, missing, empty and populated states, rows deep-linking to the existing
  project-detail route, and display values derived in tested `activityHelpers`.
  ✅ 2026-11-19 — `7ef46c8`

- [x] C36 (mocks) Wire the authoritative asset tag facets API (C33 follow-up)
  end to end: expose `getTags` / `useTags` atomically across mockApi (seed-derived
  most-used-first facets, dedup-per-asset counts, case-insensitive prefix filter,
  project scoping, router-style 422 + unknown-project 404 + injectable `tags`
  failure), the stable `ApiClient` facade, live `httpApiClient` (`GET /tags`),
  `queryKeys` and `useQueries`, with a shared `lib/tags` derivation/validation
  helper and populated/empty/error seeds; parity guard extended to both transports.
  ✅ 2026-11-19 — `cfcdab6`
  Screens tag-facet rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C37 (mocks) Wire the authoritative downstream asset impact API (C34
  follow-up) end to end: expose `getAssetImpact` / `useAssetImpact` atomically
  across mockApi (BFS lineage derivation from `parent_asset_ids` seeds with depth
  labels, cycle safety, deleted-subtree exclusion, router-style 422 + unknown-root
  404-to-undefined + injectable `impact` failure), the stable `ApiClient` facade,
  live `httpApiClient` (`GET /assets/{id}/impact`), `queryKeys` and `useQueries`,
  with a shared `lib/impact` derivation/validation helper; parity guard extended
  to both transports. ✅ 2026-11-19 — `cfcdab6`
  Screens impact rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C38 (CI) Extend the live-mode HTTP smoke job with the authoritative asset
  tag facets (C33/C36) and downstream impact (C34/C37) endpoints the live client
  now calls: `GET /tags` (index shape, prefix filter, `limit` 422 + unknown-project
  404 envelopes) and `GET /assets/{id}/impact` (derived shape, 404 + `max_depth`
  422 envelopes), registering one tagged asset on demand so both derived 200
  shapes are exercised. Keeps CI aligned with the exact `/api/v1` URLs as the
  repo grows. ✅ 2026-11-19 — `85eecce`

- [x] C39 (mocks) Extend injectable error-state fakes to every remaining mock
  query so error paths can be exercised for all domains in mock mode (C2
  parity): add `failIfEnabled` guards for project detail/recent/by-project,
  asset detail/templates, job/provider detail, operations, capabilities, single
  conversation, auth (user + orgs), presence, comments, storage and extensions,
  document the complete domain list, and cover all 18 with a failure+recovery
  test while extending the wildcard guard. ✅ 2026-11-19 — `1d4c9b6`

- [x] C40 (backend) Authoritative job execution statistics API:
  `GET /api/v1/jobs/stats` derives zero-filled lifecycle status counts,
  per-operation totals/outcomes, terminal success rate, in-flight/completed
  counts and mean wall-clock duration from the authoritative job store — no
  second index; optional `project_id` scope with shared 404/422 envelopes;
  `JobStats`/`JobStatusCount`/`OperationJobStat` mirrored in
  `frontend/src/types/jobStats.ts`, 5 tests × 2 storage backends green (575 passed).
  Mocks/screens/CI wiring of the snapshot is a follow-up for those agents.
  ✅ 2026-11-19 — `c14da59`

- [x] C41 (screens) Render the authoritative asset tag-facet index (C33/C36
  follow-up) via `useTags` on the Assets browser: prefix filter, facet-count
  chips, project scoping and click-to-filter on the asset search; loading/error/
  missing/empty/populated states with all display values derived in tested
  `tagHelpers`. ✅ 2026-11-19 — `75242d7`
- [x] C42 (screens) Render authoritative downstream asset impact (C34/C37
  follow-up) via `useAssetImpact` on the asset detail panel: search-depth chips,
  name-resolved descendant rows that deep-link to the asset route, and
  loading/error/missing-root/empty/populated states with display values derived
  in tested `impactHelpers`. ✅ 2026-11-19 — `75242d7`

- [x] C43 (mocks) Wire the authoritative job execution statistics API (C40
  follow-up) end to end: expose `getJobStats` / `useJobStats` atomically across
  mockApi (seed-derived zero-filled status counts, per-operation totals/outcomes,
  terminal success rate, in-flight/completed counts and mean duration; router-style
  422 for a malformed project id + unknown-project 404 + injectable `jobStats`
  failure), the stable `ApiClient` facade, live `httpApiClient`
  (`GET /jobs/stats?project_id=`), `queryKeys` and `useQueries`, with a shared
  `lib/jobStats` derivation/validation helper and populated/empty/error seeds;
  parity guard extended to both transports. ✅ 2026-11-19 — `caa18df`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C44 (CI) Extend the live-mode HTTP smoke job with the authoritative job
  execution statistics endpoint from C40/C43 (`GET /api/v1/jobs/stats`): probe
  the zero-filled snapshot shape (`total`, `by_status`, `by_operation`,
  `success_rate`, `in_flight`, `completed`, `average_duration_seconds`,
  `generated_at`) + breakdown shapes, the optional `project_id` scope, and the
  shared 404 `project_not_found` / 422 `validation_error` envelopes with
  request-id, keeping CI aligned with the exact `/api/v1` URLs the
  `VITE_API_MODE=live` client calls as the repo grows.
  ✅ 2026-11-19 — `2f4cfa0`
  Screens job-stats rendering remains a screens follow-up.

- [x] C45 (backend) Authoritative conversation statistics API:
  `GET /api/v1/conversations/stats` derives zero-filled per-role/per-status message
  breakdowns, conversation/message totals, average messages per conversation and
  newest conversation activity from the authoritative conversation/message stores
  (no second index); optional `project_id` scope with shared 404/422 envelopes,
  deterministic cross-backend ordering; `ConversationStats`/`RoleMessageCount`/
  `StatusMessageCount` mirrored in `frontend/src/types/conversationStats.ts`,
  5 tests × 2 storage backends green (585 passed). Mocks/screens/CI wiring of
  the snapshot is a follow-up for those agents.
  ✅ 2026-11-19 — `60e1404`

- [x] C46 (screens) Render the authoritative job execution statistics (C40/C43/C44
  follow-up) via `useJobStats`: a `JobStatsPanel` with workspace-wide and
  project-scoped variants on the Jobs screen and project detail, five stat cards,
  zero-filled status and per-operation breakdowns, and loading/error/missing/
  empty/populated states. All display values derived in tested `jobStatsHelpers`.
  My owned rows had no unchecked items, so C46 was added under the Never-empty well.
  ✅ 2026-11-19 — `453f3c9`

- [x] C47 (mocks) Wire the authoritative conversation statistics API (C45
  follow-up) end to end: expose `getConversationStats` / `useConversationStats`
  atomically across mockApi (seed-derived zero-filled role/status breakdowns,
  message/conversation totals, 3-decimal average and newest-activity recency;
  router-style 422 for a malformed project id + unknown-project 404 + injectable
  `conversationStats` failure), the stable `ApiClient` facade, live
  `httpApiClient` (`GET /conversations/stats?project_id=`), `queryKeys` and
  `useQueries`, with a shared `lib/conversationStats` derivation/validation
  helper and populated/empty/error seeds; parity guard extended to both
  transports. My owned column had no unchecked items, so C47 was added under the
  Never-empty well. ✅ 2026-11-19 — `662d88b`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C48 (CI) Extend the live-mode HTTP smoke job with the authoritative
  conversation statistics endpoint from C45/C47 (`GET /api/v1/conversations/stats`):
  probe the zero-filled snapshot shape (`total_conversations`, `total_messages`,
  `by_role`, `by_status`, `average_messages_per_conversation`, `last_activity_at`,
  `generated_at`) + breakdown shapes, the optional `project_id` scope, and the
  shared 404 `project_not_found` / 422 `validation_error` envelopes with request-id,
  keeping CI aligned with the exact `/api/v1` URLs the `VITE_API_MODE=live` client
  calls as the repo grows. No unchecked CI row remained, so C48 was added under the
  Never-empty well. ✅ 2026-11-19 — `b5e1a75`

- [x] C49 (backend) Authoritative asset inventory statistics API:
  `GET /api/v1/assets/stats?project_id=` derives zero-filled asset type/status
  breakdowns, total count, stored bytes, version revisions and newest-asset
  recency from the authoritative asset store (deleted assets excluded, no second
  index), with optional `project_id` scope and shared 404/422 envelopes;
  `AssetStats`/`AssetTypeCount`/`AssetStatusCount` mirrored in
  `frontend/src/types/assetStats.ts`, 6 tests × 2 storage backends green (597
  passed). Mocks/screens/CI wiring of the snapshot is a follow-up for those
  agents. My owned backend column had no unchecked items, so C49 was added under
  the Never-empty well. ✅ 2026-11-19 — `b98e308`

- [x] C50 (screens) Render the authoritative conversation statistics (C45/C47
  follow-up) via `useConversationStats`: a reusable `ConversationStatsPanel` with
  workspace-wide (Home) and project-scoped (Chat, project detail) variants, four
  stat cards, zero-filled message-role/status breakdowns, and loading/error/
  missing/empty/populated states with all display values derived in tested
  `conversationStatsHelpers`. My owned column had no unchecked rows, so C50 was
  added under the Never-empty well. ✅ 2026-11-19 — `6651fcb`

- [x] C51 (mocks) Wire the authoritative asset inventory statistics API (C49
  follow-up) end to end: expose `getAssetStats` / `useAssetStats` atomically
  across mockApi (seed-derived zero-filled type/status breakdowns, live-asset
  exclusion, summed bytes/versions, newest-asset recency with id tie-break,
  router-style 422 for a malformed project id + unknown-project 404 + injectable
  `assetStats` failure), the stable `ApiClient` facade, live `httpApiClient`
  (`GET /assets/stats?project_id=`), `queryKeys` and `useQueries`, with a shared
  `lib/assetStats` derivation/validation helper and populated/empty/error seeds;
  parity guard extended to both transports. My owned column had no unchecked
  rows, so C51 was added under the Never-empty well. ✅ 2026-11-19 — `21c2252`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C52 (CI) Extend the live-mode HTTP smoke job with the authoritative asset
  inventory statistics endpoint from C49/C51 (`GET /api/v1/assets/stats`): probe
  the zero-filled snapshot shape (`total`, `by_type`, `by_status`,
  `total_size_bytes`, `total_versions`, `newest_asset_at`, `generated_at`) +
  breakdown shapes, the optional `project_id` scope, and the shared 404
  `project_not_found` / 422 `validation_error` envelopes with request-id,
  keeping CI aligned with the exact `/api/v1` URLs the `VITE_API_MODE=live`
  client calls as the repo grows. No unchecked CI row remained, so C52 was added
  under the Never-empty well. ✅ 2026-11-19 — `66394c4`
  Screens asset-stats rendering remains a screens follow-up.

- [x] C53 (backend) Authoritative project portfolio statistics API:
  `GET /api/v1/projects/stats?org_id=` derives project lifecycle counts (active/
  archived), workspace-wide asset/conversation/job totals, per-project averages
  and newest-project recency from the authoritative stores (deleted assets
  excluded, no second index), with an optional `org_id` scope matching
  `GET /projects?org_id=` and a shared 422 envelope for a malformed id;
  `ProjectLifecycle`/`ProjectLifecycleCount`/`ProjectStats` mirrored in
  `frontend/src/types/projectStats.ts`, 6 tests × 2 storage backends green
  (609 passed). My owned backend column had no unchecked items, so C53 was
  added under the Never-empty well. Mocks/screens/CI wiring of the snapshot is
  a follow-up for those agents. ✅ 2026-11-19 — `be5b737`

- [x] C54 (screens) Render the authoritative asset inventory statistics (C49/C51/
  C52 follow-up) via `useAssetStats`: a reusable `AssetStatsPanel` with
  workspace-wide (Home) and project-scoped (Assets browser, project detail)
  variants, four stat cards, zero-filled type/status breakdowns, and loading/
  error/missing/empty/populated states. All display values derived in tested
  `assetStatsHelpers` (byte/relative-time formatting, shares, tones, empty
  detection); lint clean, 367 tests, build green. My owned column had no
  unchecked rows, so C54 was added under the Never-empty well.
  ✅ 2026-11-19 — `62775a5`

- [x] C55 (mocks) Wire the authoritative project portfolio statistics API (C53
  follow-up) end to end: expose `getProjectStats` / `useProjectStats` atomically
  across mockApi (seed-derived zero-filled lifecycle counts, workspace-wide and
  org-scoped asset/conversation/job totals, 3-decimal per-project averages,
  newest-project recency with id tie-break, soft-deleted asset exclusion;
  router-style 422 for a malformed org id, zero-filled snapshot for an unknown
  org and injectable `projectStats` failure), the stable `ApiClient` facade,
  live `httpApiClient` (`GET /projects/stats?org_id=`), `queryKeys` and
  `useQueries`, with a shared `lib/projectStats` derivation/validation helper
  and populated/empty/error seeds; parity guard extended to both transports.
  My owned column had no unchecked rows, so C55 was added under the Never-empty
  well. ✅ 2026-11-19 — `7d08eaf`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C56 (CI) Extend the live-mode HTTP smoke job with the authoritative project
  portfolio statistics endpoint from C53/C55 (`GET /api/v1/projects/stats`): probe
  the zero-filled snapshot shape (`total`, `by_lifecycle`, `active`, `archived`,
  `total_assets`, `total_conversations`, `total_jobs`,
  `average_assets_per_project`, `average_jobs_per_project`, `newest_project_at`,
  `generated_at`) + lifecycle breakdown shapes, the optional `org_id` scope (an
  unknown but well-formed org yields a zero-filled 200 snapshot, matching
  `GET /projects?org_id=`) and the shared 422 `validation_error` envelope with
  request-id. No unchecked CI row remained, so C56 was added under the
  Never-empty well. ✅ 2026-11-19 — `b8e2007`
  Screens project-stats rendering remains a screens follow-up.

- [x] C57 (backend) Authoritative provider fleet statistics API:
  `GET /api/v1/providers/stats?location=&status=` derives zero-filled health-status
  (available/unavailable/degraded) and runtime-location (local/studio/cloud)
  breakdowns, capability/operation coverage with per-operation provider + available
  counts and deterministic ordering from the authoritative provider store — no second
  index; optional location/status filters (invalid values use the shared 422 envelope);
  `ProviderStats`/`ProviderStatusCount`/`ProviderLocationCount`/`ProviderOperationStat`
  mirrored in `frontend/src/types/providerStats.ts`, README endpoint list synced,
  6 tests × 2 storage backends green (621 passed). Mocks/screens/CI wiring of the
  snapshot is a follow-up for those agents. My owned backend column had no unchecked
  items, so C57 was added under the Never-empty well.
  ✅ 2026-11-19 — `b66143a`

- [x] C58 (screens) Render the authoritative project portfolio stats (C53/C55/C56
  follow-up) via `useProjectStats`: a reusable `ProjectStatsPanel` with workspace-wide
  (Home, Projects) and org-scoped (Workspaces) variants, four stat cards, zero-filled
  active/archived lifecycle breakdown, cross-domain totals and per-project averages,
  and loading/error/missing/empty/populated states — all display values derived in
  tested `projectStatsHelpers`. My owned column had no unchecked rows, so C58 was
  added under the Never-empty well. ✅ 2026-11-19 — `4088ea4`

- [x] C59 (mocks) Wire the authoritative provider fleet statistics API (C57
  follow-up) end to end: expose `getProviderStats` / `useProviderStats`
  atomically across mockApi (seed-derived zero-filled status/location breakdowns,
  capability/operation coverage with per-operation provider + available counts,
  deterministic `(-providers, operation_id)` ordering, router-style 422 for an
  invalid `location`/`status` filter + injectable `providerStats` failure), the
  stable `ApiClient` facade, live `httpApiClient`
  (`GET /providers/stats?location=&status=`), `queryKeys` and `useQueries`, with a
  shared `lib/providerStats` derivation/validation helper and populated/empty/
  error seeds; parity guard extended to both transports. My owned column had no
  unchecked rows, so C59 was added under the Never-empty well.
  ✅ 2026-11-19 — `9eaf9a3`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C60 (CI) Extend the live-mode HTTP smoke job with the authoritative
  provider fleet statistics endpoint from C57/C59 (`GET /api/v1/providers/stats`):
  probe the zero-filled snapshot shape (`total`, `by_status`, `by_location`,
  `available`, `degraded`, `unavailable`, `total_capabilities`,
  `unique_operations`, `by_operation`, `generated_at`) + breakdown shapes, the
  `location`/`status` filters and the shared 422 `validation_error` envelope with
  request-id, keeping CI aligned with the exact `/api/v1` URLs the
  `VITE_API_MODE=live` client calls as the repo grows. No unchecked CI row
  remained, so C60 was added under the Never-empty well.
  ✅ 2026-11-19 — `1beae67`
  Screens provider-stats rendering remains a screens follow-up.

- [x] C61 (backend) Authoritative extension registry/installation statistics API:
  `GET /api/v1/extensions/stats?type=&status=` derives zero-filled registry
  type/status breakdowns, trust flags (enabled/signed/verified) and permission/
  capability coverage from the authoritative extension stores (no second index);
  optional `type`/`status` filters narrow the registry/installed slices with a
  shared 422 envelope; `ExtensionStats`/`ExtensionTypeCount`/
  `ExtensionStatusCount`/`ExtensionPermissionStat` mirrored in
  `frontend/src/types/extensionStats.ts`, README endpoint list synced, 7 tests ×
  2 storage backends green (635 passed). Mocks/screens/CI wiring is a follow-up.
  My owned backend column had no unchecked items, so C61 was added under the
  Never-empty well. ✅ 2026-11-19 — `9eaec7c`

- [x] C62 (screens) Render the authoritative provider fleet stats (C57/C59/C60
  follow-up) via `useProviderStats`: a reusable `ProviderStatsPanel` on the
  Providers screen with location/status filters wired from the existing filter
  selects, four stat cards, zero-filled status/location breakdowns and
  per-operation availability coverage, and loading/error/missing/empty/
  populated states — all display values derived in tested `providerStatsHelpers`.
  My owned column had no unchecked rows, so C62 was added under the Never-empty
  well. ✅ 2026-11-19 — `9a62ea9`

- [x] C63 (mocks) Wire the authoritative extension registry/installation
  statistics API (C61 follow-up) end to end: expose `getExtensionStats` /
  `useExtensionStats` atomically across mockApi (seed-derived zero-filled type/
  status breakdowns, trust flags, permission/capability coverage with deterministic
  `(-extensions, name)` ordering, router-style 422 for an invalid `type`/`status`
  + injectable `extensionStats` failure), the stable `ApiClient` facade, live
  `httpApiClient` (`GET /extensions/stats?type=&status=`), `queryKeys` and
  `useQueries`, with a shared `lib/extensionStats` derivation/validation helper
  and populated/empty/error seeds; parity guard extended to both transports.
  My owned column had no unchecked rows, so C63 was added under the Never-empty
  well. ✅ 2026-11-19 — `8b3cf2c`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C64 (CI) Extend the live-mode HTTP smoke job with the authoritative
  extension registry/installation statistics endpoint from C61/C63
  (`GET /api/v1/extensions/stats`): probe the zero-filled snapshot
  (`total_registered`, `total_installed`, `by_type`, `by_status`, `enabled`,
  `signed`, `verified`, `total_permissions`, `unique_permissions`,
  `by_permission`, `total_capabilities`, `generated_at`) + breakdown shapes,
  the independent `type`/`status` filters and the shared 422
  `validation_error` envelope with request-id, keeping CI aligned with the
  exact `/api/v1` URLs the `VITE_API_MODE=live` client calls as the repo grows.
  No unchecked CI row remained, so C64 was added under the Never-empty well.
  ✅ 2026-11-19 — `562ab49`
  Screens extension-stats rendering remains a screens follow-up.

- [x] C65 (backend) Authoritative operation catalog statistics API:
  `GET /api/v1/operations/stats` derives catalog size, streaming/provider
  coverage, total settings, unique output types and deterministic asset-type
  input/output breakdowns from the authoritative operation catalog (no second
  index); `OperationStats`/`OperationTypeCount` mirrored in
  `frontend/src/types/operationStats.ts`, README endpoint list synced, tests on
  memory+sqlite (647 passed). Mocks/screens/CI wiring is a follow-up.
  ✅ 2026-11-19 — `5bc5f46`

- [x] C66 (screens) Render the authoritative extension registry/installation
  statistics (C61/C63/C64 follow-up) via `useExtensionStats`: an
  `ExtensionStatsPanel` on the Extensions screen with type/status filters, four
  stat cards, zero-filled type/status distributions, trust flags and permission
  coverage, and loading/error/missing/empty/populated states — all display
  values derived in tested `extensionStatsHelpers`. My owned column had no
  unchecked rows, so C66 was added under the Never-empty well.
  ✅ 2026-11-19 — `d81bc55`

- [x] C67 (mocks) Wire the authoritative operation catalog statistics API (C65
  follow-up) end to end: expose `getOperationStats` / `useOperationStats`
  atomically across mockApi (seed-derived catalog coverage metrics and
  deterministic asset-type input/output breakdowns with `(-count, name)` sort,
  plus an injectable `operationStats` failure), the stable `ApiClient` facade,
  live `httpApiClient` (`GET /operations/stats`, no query params), `queryKeys`
  and `useQueries`, with a shared `lib/operationStats` derivation helper and
  empty/populated derivation tests; parity guard extended to both transports.
  My owned column had no unchecked rows, so C67 was added under the Never-empty
  well. ✅ 2026-11-19 — `e9aebe3`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C68 (CI) Extend the live-mode HTTP smoke job with the authoritative
  operation catalog statistics endpoint from C65/C67
  (`GET /api/v1/operations/stats`, which takes no query params): probe the
  catalog-derived snapshot shape (`total`, `streaming`, `with_provider`,
  `without_provider`, `total_settings`, `unique_output_types`, `by_output_type`,
  `by_input_type`, `generated_at`), the asset-type breakdown shapes, the
  with/without-provider and unique-output-type invariants, and the request-id
  header, keeping CI aligned with the exact `/api/v1` URLs the
  `VITE_API_MODE=live` client calls as the repo grows. No unchecked CI row
  remained, so C68 was added under the Never-empty well.
  ✅ 2026-11-19 — `da42ae8`
  Screens operation-stats rendering remains a screens follow-up.

- [x] C69 (backend) Authoritative organization/membership statistics API:
  `GET /api/v1/orgs/stats?org_id=` (alias `/organizations/stats`) derives
  organization/member/user totals, a zero-filled member-role breakdown,
  per-organization member counts, a 3-decimal average and newest-organization
  recency from the authoritative auth store (no second index); optional `org_id`
  scope where an unknown-but-valid org yields a zero-filled 200 and a malformed
  id uses the shared 422 envelope; `OrganizationStats`/`OrganizationMemberCount`/
  `RoleMemberCount` mirrored in `frontend/src/types/organizationStats.ts`, README
  endpoint list synced, 7 tests × 2 storage backends green (661 passed, contract
  parity + route-surface guard clean). Mocks/screens/CI wiring is a follow-up.
  My owned backend column had no unchecked items, so C69 was added under the
  Never-empty well. ✅ 2026-11-19 — `e1a7531`

- [x] C70 (screens) Render the authoritative operation catalog statistics (C65/C67/
  C68 follow-up) via `useOperationStats`: an `OperationStatsPanel` on the Jobs
  screen with five stat cards, provider-binding coverage, zero-filled deterministic
  input/output asset-type breakdowns, and loading/error/missing/empty/populated
  states — all display values derived in tested `operationStatsHelpers`. Resolves
  the C68 screens follow-up. My owned column had no unchecked rows, so C70 was
  added under the Never-empty well. ✅ 2026-11-19 — `9395f52`

- [x] C71 (mocks) Wire the authoritative organization/membership statistics API
  (C69 follow-up) end to end: expose `getOrganizationStats` / `useOrganizationStats`
  atomically across mockApi (seed-derived zero-filled role breakdowns, per-organization
  member counts sorted by descending count then org id, global user total,
  3-decimal average and newest-org recency; router-style 422 for a malformed org
  id + zero-filled snapshot for an unknown org + injectable `organizationStats`
  failure), the stable `ApiClient` facade, live `httpApiClient`
  (`GET /orgs/stats?org_id=`), `queryKeys` and `useQueries`, with a shared
  `lib/organizationStats` derivation/validation helper and new user/member seeds;
  populated/empty/error seeds and parity guard extended to both transports.
  My owned column had no unchecked rows, so C71 was added under the Never-empty
  well. ✅ 2026-11-19 — `8d23794`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C72 (CI) Extend the live-mode HTTP smoke job with the authoritative
  organization/membership statistics endpoint from C69/C71
  (`GET /api/v1/orgs/stats?org_id=`): probe the zero-filled snapshot shape
  (`total_organizations`, `total_members`, `total_users`, `by_role`,
  `by_organization`, `average_members_per_org`, `newest_org_at`, `generated_at`)
  + breakdown shapes, the optional `org_id` scope (an unknown-but-valid org
  yields a zero-filled 200) and the shared 422 `validation_error` envelope with
  request-id, keeping CI aligned with the exact `/api/v1` URLs the
  `VITE_API_MODE=live` client calls as the repo grows. No unchecked CI row
  remained, so C72 was added under the Never-empty well.
  ✅ 2026-11-19 — `100dd39`
  Screens organization-stats rendering remains a screens follow-up.

- [x] C73 (backend) Authoritative production-pipeline statistics API:
  `GET /api/v1/pipelines/stats?project_id=` derives zero-filled per-kind (training/
  shot/splat) chain/job/asset breakdowns, per-project chain counts, totals and
  newest-chain recency from the three authoritative chain collections (no second
  index), with an optional `project_id` scope (unknown → shared 404, malformed →
  shared 422); `PipelineKind`/`PipelineKindStats`/`PipelineProjectCount`/
  `PipelineStats` mirrored in `frontend/src/types/pipelineStats.ts`, README endpoint
  list synced, 5 tests × 2 storage backends green (671 passed). Mocks/screens/CI
  wiring of the snapshot is a follow-up. My owned backend column had no unchecked
  items, so C73 was added under the Never-empty well.
  ✅ 2026-11-19 — `459314a`

- [x] C74 (screens) Render the authoritative organization/membership statistics
  (C69/C71/C72 follow-up) via `useOrganizationStats`: a reusable
  `OrganizationStatsPanel` with workspace-wide (Home) and org-scoped (Workspaces)
  variants, four stat cards, zero-filled member-role and per-organization
  breakdowns, friendly org names and all five UI states — every display value
  derived in tested `organizationStatsHelpers`. Resolves the C72 screens follow-up.
  My owned column had no unchecked rows, so C74 was added under the Never-empty
  well. ✅ 2026-11-19 — `82c5f45`

- [x] C75 (mocks) Wire the authoritative production-pipeline statistics API (C73
  follow-up) end to end: expose `getPipelineStats` / `usePipelineStats` atomically
  across mockApi (seed-derived zero-filled training/shot/splat chain/job/asset
  breakdowns, per-project chain counts, global totals and newest-chain recency;
  router-style 422 for a malformed project id, normalized 404 for an unknown
  project + injectable `pipelineStats` failure), the stable `ApiClient` facade,
  live `httpApiClient` (`GET /pipelines/stats?project_id=`), `queryKeys` and
  `useQueries`, with a shared `lib/pipelineStats` derivation/validation helper,
  chain seeds and populated/empty/error tests; parity guard extended to both
  transports. My owned column had no unchecked rows, so C75 was added under the
  Never-empty well. ✅ 2026-11-19 — `70bd66b`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C76 (CI) Extend the live-mode HTTP smoke job with the authoritative
  production-pipeline statistics endpoint from C73/C75
  (`GET /api/v1/pipelines/stats?project_id=`): probe the zero-filled snapshot
  shape (`total_chains`, `total_jobs`, `total_assets`, `by_kind`, `by_project`,
  `newest_chain_at`, `generated_at`) + per-kind/per-project breakdown shapes and
  the three canonical pipeline kinds (training/shot/splat), the optional
  `project_id` scope (unknown → shared 404 `project_not_found`), and the shared
  422 `validation_error` envelope with request-id, keeping CI aligned with the
  exact `/api/v1` URLs the `VITE_API_MODE=live` client calls as the repo grows.
  No unchecked CI row remained, so C76 was added under the Never-empty well.
  ✅ 2026-11-19 — `e779f84`
  Screens pipeline-stats rendering remains a screens follow-up.

- [x] C77 (backend) Authoritative asset lineage statistics API:
  `GET /api/v1/lineage/stats?project_id=` derives zero-filled relationship-type
  breakdowns (derived_from/variant_of/uses_input/related_to/duplicate_of),
  per-project link counts, distinct live-asset count and newest-link recency from
  the authoritative `ASSET_RELATIONSHIPS` store (joined to assets for project
  attribution; links from soft-deleted/unknown source assets excluded, no second
  index), with an optional `project_id` scope (unknown → shared 404
  `project_not_found`, malformed → shared 422) and deterministic cross-backend
  ordering; `LineageStats`/`LineageTypeCount`/`LineageProjectCount` mirrored in
  `frontend/src/types/lineageStats.ts`, README endpoint list synced, 6 tests × 2
  storage backends green (683 passed, contract parity + route-surface guard +
  frontend tsc clean). Mocks/screens/CI wiring is a follow-up. My owned backend
  column had no unchecked items, so C77 was added under the Never-empty well.
  ✅ 2026-11-19 — `d8f08a0`

- [x] C78 (screens) Render the authoritative production-pipeline statistics
  (C73/C75/C76 follow-up) via `usePipelineStats`: a reusable `PipelineStatsPanel`
  with workspace-wide (Projects) and project-scoped (project detail) variants,
  three stat cards, zero-filled training/shot/splat chain/job/asset breakdowns,
  per-project chain counts and a recency footer, with loading/error/missing/
  empty/populated states — every display value derived in tested
  `pipelineStatsHelpers`. Resolves the C76 screens follow-up. My owned column had
  no unchecked rows, so C78 was added under the Never-empty well.
  ✅ 2026-11-19 — `c8409f4`

- [x] C79 (mocks) Wire the authoritative asset lineage statistics API (C77
  follow-up) end to end: expose `getLineageStats` / `useLineageStats` atomically
  across mockApi (relationship + asset seed derivation with zero-filled type
  buckets, per-project link counts, distinct live-asset count and recency;
  deleted/unknown-source exclusion; router-style 422 for a malformed project id,
  normalized 404 for an unknown project + injectable `lineageStats` failure), the
  stable `ApiClient` facade, live `httpApiClient` (`GET /lineage/stats?project_id=`),
  `queryKeys` and `useQueries`, with a shared `lib/lineageStats`
  derivation/validation helper and relationship seeds; parity guard extended to
  both transports. Resolves the C77 mocks-transport follow-up. My owned column had
  no unchecked rows, so C79 was added under the Never-empty well.
  ✅ 2026-11-19 — `fec5c4f`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C80 (CI) Extend the live-mode HTTP smoke job with the authoritative
  asset lineage statistics endpoint from C77/C79
  (`GET /api/v1/lineage/stats?project_id=`): probe the zero-filled snapshot
  shape (`total_relationships`, `total_linked_assets`, `by_type`, `by_project`,
  `newest_relationship_at`, `generated_at`) + relationship-type/per-project
  breakdown shapes and the five canonical kinds (derived_from/variant_of/
  uses_input/related_to/duplicate_of), the optional `project_id` scope (unknown
  → shared 404 `project_not_found`), and the shared 422 `validation_error`
  envelope with request-id, keeping CI aligned with the exact `/api/v1` URLs
  the `VITE_API_MODE=live` client calls as the repo grows. No unchecked CI row
  remained, so C80 was added under the Never-empty well.
  ✅ 2026-11-19 — `4011bd5`
  Screens lineage-stats rendering remains a screens follow-up.

- [x] C81 (backend) Authoritative collaboration statistics API:
  `GET /api/v1/collaboration/stats?project_id=` derives zero-filled presence-state
  breakdowns (online/away/offline), per-project presence/comment activity, distinct
  participant count and newest-signal recency from the authoritative `PRESENCE`/
  `COMMENTS` stores (no second index), with an optional `project_id` scope (unknown →
  shared 404 `project_not_found`, malformed → shared 422) and deterministic
  cross-backend ordering; `CollaborationStats`/`PresenceStateCount`/
  `CollaborationProjectCount` mirrored in `frontend/src/types/collaborationStats.ts`,
  README endpoint list synced, 6 tests × 2 storage backends green (695 passed,
  contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring of the
  snapshot is a follow-up. My owned backend column had no unchecked items (only the
  repo-wide C6 docs pass remains, owned by other agents), so C81 was added under the
  Never-empty well. ✅ 2026-11-19 — `fb6be47`

- [x] C82 (screens) Render the authoritative asset lineage statistics (C77/C79/
  C80 follow-up) via `useLineageStats`: a reusable `LineageStatsPanel` with
  workspace-wide (Projects) and project-scoped (project detail) variants, three
  stat cards, zero-filled derived_from/variant_of/uses_input/related_to/
  duplicate_of relationship-type and per-project breakdowns, and loading/error/
  missing/empty/populated states — every display value derived in tested
  `lineageStatsHelpers`. Resolves the C80 screens follow-up. My owned column had
  no unchecked rows, so C82 was added under the Never-empty well.
  ✅ 2026-11-19 — `3dddb3b`

- [x] C83 (mocks) Wire the authoritative collaboration statistics API (C81
   follow-up) end to end: expose `getCollaborationStats` / `useCollaborationStats`
   atomically across mockApi (seed-derived zero-filled presence-state buckets,
   per-project presence/comment activity sorted by descending comments then
   presence then project id, distinct participant union, deterministic presence/
   comment recency with id tie-breaks, router-style 422 for a malformed project
   id, normalized 404 for an unknown project + injectable `collaborationStats`
   failure), the stable `ApiClient` facade, live `httpApiClient`
   (`GET /collaboration/stats?project_id=`), `queryKeys` and `useQueries`, with a
   shared `lib/collaborationStats` derivation/validation helper; populated/empty/
   error seeds and parity guard extended to both transports. My owned column had
   no unchecked rows, so C83 was added under the Never-empty well.
   ✅ 2026-11-19 — `9eb617b`
   Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C84 (CI) Extend the live-mode HTTP smoke job with the authoritative
  collaboration statistics endpoint from C81/C83
  (`GET /api/v1/collaboration/stats?project_id=`): probe the zero-filled snapshot
  shape (`total_presence`, `total_comments`, `total_participants`, `by_state`,
  `by_project`, `newest_presence_at`, `newest_comment_at`, `generated_at`) +
  presence-state/per-project breakdown shapes and the three canonical states
  (online/away/offline), the optional `project_id` scope (unknown → shared 404
  `project_not_found`), and the shared 422 `validation_error` envelope with
  request-id, keeping CI aligned with the exact `/api/v1` URLs the
  `VITE_API_MODE=live` client calls as the repo grows. No unchecked CI row
  remained, so C84 was added under the Never-empty well.
  ✅ 2026-11-19 — `4e932b9`
  Screens collaboration-stats rendering remains a screens follow-up.

- [x] C85 (backend) Authoritative orchestration statistics API:
  `GET /api/v1/orchestration/stats?project_id=` derives zero-filled lifecycle-stage
  breakdowns (plan/resolve/submit/await/collect/done), per-project plan/run activity
  (runs joined to plans for project attribution), plan-step and linked-job totals and
  newest-plan/run recency from the authoritative plan/run stores (no second index),
  with an optional `project_id` scope (unknown → shared 404 `project_not_found`,
  malformed → shared 422) and deterministic cross-backend ordering;
  `OrchestrationStats`/`OrchestrationStageCount`/`OrchestrationProjectCount` mirrored in
  `frontend/src/types/orchestrationStats.ts`, README endpoint list synced, 7 tests × 2
  storage backends green (709 passed, contract parity + route-surface guard + tsc clean).
  Mocks/screens/CI wiring of the snapshot is a follow-up. My owned backend column had no
  unchecked items (only the repo-wide C6 docs pass remains, owned by other agents), so
  C85 was added under the Never-empty well. ✅ 2026-11-19 — `4632601`

- [x] C86 (screens) Render the authoritative collaboration statistics (C81/C83/C84
  follow-up) via `useCollaborationStats`: a reusable `CollaborationStatsPanel` with
  workspace-wide (Workspaces) and project-scoped (project detail) variants, four stat
  cards, zero-filled online/away/offline presence and per-project activity breakdowns,
  and loading/error/missing/empty/populated states — every display value derived in
  tested `collaborationStatsHelpers`. Resolves the C84 screens follow-up. My owned
  column had no unchecked rows, so C86 was added under the Never-empty well.
  ✅ 2026-11-19 — `7aa2ab2`

- [x] C87 (mocks) Wire the authoritative orchestration statistics API (C85
  follow-up) end to end: expose `getOrchestrationStats` / `useOrchestrationStats`
  atomically across mockApi (seed-derived zero-filled stage buckets, run→plan
  project attribution, plan-step and linked-job totals, deterministic plan/run
  recency; router-style 422 for a malformed project id, normalized 404 for an
  unknown project + injectable `orchestrationStats` failure), the stable
  `ApiClient` facade, live `httpApiClient` (`GET /orchestration/stats?project_id=`),
  `queryKeys` and `useQueries`, with a shared `lib/orchestrationStats`
  derivation/validation helper and new plan seeds; populated/empty/error seeds
  and parity guard extended to both transports. Resolves the C85 mocks-transport
  follow-up. My owned column had no unchecked rows, so C87 was added under the
  Never-empty well. ✅ 2026-11-19 — `f088f30`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C88 (CI) Extend the live-mode HTTP smoke job with the authoritative
  orchestration statistics endpoint from C85/C87
  (`GET /api/v1/orchestration/stats?project_id=`): probe the zero-filled snapshot
  shape (`total_plans`, `total_runs`, `total_steps`, `total_jobs_linked`,
  `by_stage`, `by_project`, `newest_plan_at`, `newest_run_at`, `generated_at`)
  + stage/project breakdown shapes and the six canonical lifecycle stages
  (plan/resolve/submit/await/collect/done), the optional `project_id` scope
  (unknown → shared 404 `project_not_found`), and the shared 422
  `validation_error` envelope with request-id, keeping CI aligned with the
  exact `/api/v1` URLs the `VITE_API_MODE=live` client calls as the repo grows.
  No unchecked CI row remained, so C88 was added under the Never-empty well.
  ✅ 2026-11-19 — `6c6a787`
  Screens orchestration-stats rendering remains a screens follow-up.

- [x] C89 (backend) Authoritative activity statistics API:
  `GET /api/v1/activity/stats?project_id=` aggregates the same authoritative
  asset/publish/job/comment event stream as the workspace activity feed — with
  zero-filled per-kind breakdowns (asset/publish/job/comment), per-project
  event/distinct-participant counts, a distinct participant total and newest-event
  recency (no second index; reuses the feed derivation so the two cannot drift),
  an optional `project_id` scope (unknown → shared 404 `project_not_found`,
  malformed → shared 422) and deterministic cross-backend ordering;
  `ActivityStats`/`ActivityKindCount`/`ActivityProjectCount` mirrored in
  `frontend/src/types/activityStats.ts`, README endpoint list synced, 6 tests × 2
  storage backends green (721 passed, contract parity + route-surface guard + tsc
  clean). Mocks/screens/CI wiring of the snapshot is a follow-up. My owned backend
  column had no unchecked items (only the repo-wide C6 docs pass remains, owned by
  other agents), so C89 was added under the Never-empty well.
  ✅ 2026-11-19 — `dc8b0b9`

- [x] C90 (screens) Render the authoritative orchestration statistics (C85/C87/
  C88 follow-up) via `useOrchestrationStats`: a reusable `OrchestrationStatsPanel`
  with workspace-wide (Jobs) and project-scoped (project detail) variants, four
  stat cards, zero-filled plan/resolve/submit/await/collect/done stage and
  per-project activity breakdowns, and loading/error/missing/empty/populated
  states — every display value derived in tested `orchestrationStatsHelpers`.
  Resolves the C87/C88 screens follow-up. My owned column had no unchecked rows,
  so C90 was added under the Never-empty well.
  ✅ 2026-11-19 — `db504cc`

- [x] C91 (mocks) Wire the authoritative activity statistics API (C89
  follow-up) end to end: expose `getActivityStats` / `useActivityStats` atomically
  across mockApi (reuses the same activity-feed derivation with an unlimited limit
  so the snapshot and feed cannot drift; zero-filled per-kind buckets, per-project
  event/participant counts, distinct participant total and newest-event recency;
  router-style 422 for a malformed project id, normalized 404 for an unknown
  project + injectable `activityStats` failure), the stable `ApiClient` facade,
  live `httpApiClient` (`GET /activity/stats?project_id=`), `queryKeys` and
  `useQueries`, with a shared `lib/activityStats` derivation/validation helper;
  populated/empty/error seeds and parity guard extended to both transports. My
  owned column had no unchecked rows, so C91 was added under the Never-empty well.
  ✅ 2026-11-19 — `0752a55`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C92 (CI) Extend the live-mode HTTP smoke job with the authoritative
  activity statistics endpoint from C89/C91
  (`GET /api/v1/activity/stats?project_id=`): probe the zero-filled snapshot
  shape (`total_events`, `total_participants`, `by_kind`, `by_project`,
  `newest_event_at`, `generated_at`) + per-kind/per-project breakdown shapes
  and the four canonical activity kinds (asset/publish/job/comment), the
  optional `project_id` scope (unknown → shared 404 `project_not_found`),
  and the shared 422 `validation_error` envelope with request-id, keeping CI
  aligned with the exact `/api/v1` URLs the `VITE_API_MODE=live` client calls
  as the repo grows. No unchecked CI row remained, so C92 was added under the
  Never-empty well.
  ✅ 2026-11-19 — `8018614`
  Screens activity-stats rendering remains a screens follow-up.

- [x] C93 (backend) Authoritative cross-domain search index statistics API:
  `GET /api/v1/search/stats?project_id=` derives searchable-document counts by
  canonical kind (project/asset/conversation), a total, newest-document recency
  and generation time from the same authoritative stores `/search` reads (no
  second index; soft-deleted assets excluded), with a zero-filled deterministic
  `by_kind` breakdown and an optional `project_id` scope (unknown → shared 404
  `project_not_found`, malformed → shared 422); `SearchStats`/`SearchKindCount`
  mirrored in `frontend/src/types/searchStats.ts`, README endpoint list synced,
  5 tests × 2 storage backends green (731 passed, contract parity + route-surface
  guard + tsc clean). Mocks/screens/CI wiring of the snapshot is a follow-up.
  My owned backend column had no unchecked items, so C93 was added under the
  Never-empty well. ✅ 2026-11-19 — `cc29f83`

- [x] C94 (screens) Render the authoritative activity statistics (C89/C91/C92
  follow-up) via `useActivityStats`: a reusable `ActivityStatsPanel` with
  workspace-wide (Home, alongside the activity feed) and project-scoped (project
  detail) variants, four stat cards, zero-filled asset/publish/job/comment kind
  and per-project event/participant breakdowns, and loading/error/missing/empty/
  populated states — every display value derived in tested `activityStatsHelpers`.
  Resolves the C89/C91/C92 screens follow-up. My owned column had no unchecked
  rows, so C94 was added under the Never-empty well.
  ✅ 2026-11-19 — `78dabbe`

- [x] C95 (mocks) Wire the authoritative search index statistics API (C93
  follow-up) end to end: expose `getSearchStats` / `useSearchStats` atomically
  across mockApi (seed-derived zero-filled project/asset/conversation document
  counts, total, newest-document recency and soft-deleted-asset exclusion,
  router-style 422 for a malformed project id, normalized 404 for an unknown
  project + injectable `searchStats` failure), the stable `ApiClient` facade,
  live `httpApiClient` (`GET /search/stats?project_id=`), `queryKeys` and
  `useQueries`, with a shared `lib/searchStats` derivation/validation helper;
  populated/empty/error seeds and parity guard extended to both transports.
  My owned column had no unchecked rows, so C95 was added under the Never-empty
  well. ✅ 2026-11-19 — `21df9fe`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C96 (CI) Extend the live-mode HTTP smoke job with the authoritative search
  index statistics endpoint from C93/C95 (`GET /api/v1/search/stats?project_id=`):
  probe the zero-filled snapshot shape (`total_documents`, `by_kind`,
  `newest_document_at`, `generated_at`) + `by_kind` breakdown shape and the three
  canonical search kinds (project/asset/conversation), the optional `project_id`
  scope (unknown → shared 404 `project_not_found`), the shared 422
  `validation_error` envelope and the request-id header, keeping CI aligned with
  the exact `/api/v1` URLs the `VITE_API_MODE=live` client calls as the repo
  grows. No unchecked CI row remained, so C96 was added under the Never-empty
  well. ✅ 2026-11-19 — `83fc093`
  Screens search-stats rendering remains a screens follow-up.

- [x] C97 (backend) Authoritative upload statistics API:
  `GET /api/v1/uploads/stats?project_id=` derives upload-ticket metrics from the
  authoritative `UPLOADS` store (no second index) — a zero-filled pending/complete
  status breakdown, completed byte totals, per-project ticket activity sorted by
  count then id, newest-ticket recency and generated-at — with an optional
  `project_id` scope (unknown → shared 404 `project_not_found`, malformed → shared
  422) and deterministic cross-backend ordering; the canonical `UploadStatus`
  literal is the single source for both `UploadRecord.status` and the breakdown.
  `UploadStatus`/`UploadStatusCount`/`UploadProjectCount`/`UploadStats` mirrored in
  `frontend/src/types/uploadStats.ts`, README endpoint list synced, 5 tests × 2
  storage backends green (741 passed, contract parity + route-surface guard + tsc
  clean). Mocks/screens/CI wiring of the snapshot is a follow-up. My owned backend
  column had no unchecked items (only the repo-wide C6 docs pass remains, owned by
  other agents), so C97 was added under the Never-empty well.
  ✅ 2026-11-19 — `2c3433c`

- [x] C98 (screens) Render the authoritative search index statistics (C93/C95/
   C96 follow-up) via `useSearchStats`: a reusable `SearchStatsPanel` with
   workspace-wide (Home) and project-scoped (project detail) variants, four stat
   cards, zero-filled project/asset/conversation kind breakdowns with share bars,
   and loading/error/missing/empty/populated states — every display value derived
   in tested `searchStatsHelpers`. Resolves the C96 screens follow-up. My owned
   column had no unchecked rows, so C98 was added under the Never-empty well.
   ✅ 2026-11-19 — `fbad6df`

- [x] C99 (mocks) Wire the authoritative upload statistics API (C97 follow-up)
  end to end: expose `getUploadStats` / `useUploadStats` atomically across mockApi
  (seed-derived zero-filled pending/complete status buckets, completed-only byte
  totals, per-project ticket activity sorted by descending count then project id,
  newest-ticket recency; router-style 422 for a malformed project id, normalized
  404 for an unknown project + injectable `uploadStats` failure), the stable
  `ApiClient` facade, live `httpApiClient` (`GET /uploads/stats?project_id=`),
  `queryKeys` and `useQueries`, with a shared `lib/uploadStats` derivation/validation
  helper and upload-ticket seeds; populated/empty/error seeds and parity guard
  extended to both transports. My owned column had no unchecked rows, so C99 was
  added under the Never-empty well. ✅ 2026-11-19 — `e985ec5`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C100 (CI) Extend the live-mode HTTP smoke job with the authoritative
  upload statistics endpoint from C97/C99 (`GET /api/v1/uploads/stats?project_id=`):
  probe the zero-filled snapshot shape (`total_tickets`, `pending`, `completed`,
  `bytes_uploaded`, `by_status`, `by_project`, `newest_upload_at`, `generated_at`)
  + breakdown shapes and the two canonical upload statuses (pending/complete),
  the optional `project_id` scope (unknown → shared 404 `project_not_found`),
  and the shared 422 `validation_error` envelope with request-id, keeping CI
  aligned with the exact `/api/v1` URLs the `VITE_API_MODE=live` client calls as
  the repo grows. No unchecked CI row remained, so C100 was added under the
  Never-empty well. ✅ 2026-11-19 — `2f28b46`
  Screens upload-stats rendering remains a screens follow-up.

- [x] C101 (backend) Authoritative job event stream statistics API:
  `GET /api/v1/events/stats?project_id=` derives zero-filled per-type breakdowns
  (status/progress/intermediate/result/error/log), per-job event counts with
  recency, distinct emitting-job total, newest-event recency and generation time
  from the authoritative `JOB_EVENTS` store (no second index); an optional
  `project_id` scope joins events to their parent jobs (orphans skipped) with
  shared 404 `project_not_found` / 422 `validation_error` envelopes and
  deterministic cross-backend ordering; `EventStats`/`EventTypeCount`/
  `EventJobCount` mirrored in `frontend/src/types/eventStats.ts`, README endpoint
  list synced, 5 tests × 2 storage backends green (751 passed, contract parity +
  route-surface guard + tsc clean). Mocks/screens/CI wiring of the snapshot is a
  follow-up. My owned backend column had no unchecked items (only the repo-wide
  C6 docs pass remains, owned by other agents), so C101 was added under the
  Never-empty well. ✅ 2026-11-19 — `cf16a19`

- [x] C102 (screens) Render the authoritative upload statistics (C97/C99/C100
  follow-up) via `useUploadStats`: a reusable `UploadStatsPanel` with workspace-wide
  (Home) and project-scoped (project detail) variants, four stat cards, zero-filled
  pending/complete status and per-project ticket activity breakdowns, and
  loading/error/missing/empty/populated states — every display value derived in
  tested `uploadStatsHelpers` (byte/recency formatting, shares, tones, empty
  detection). Resolves the C100 screens follow-up. My owned column had no unchecked
  rows, so C102 was added under the Never-empty well.
  ✅ 2026-11-19 — `4dd4ed1`

- [x] C103 (mocks) Wire the authoritative job event stream statistics API (C101
  follow-up) end to end: expose `getEventStats` / `useEventStats` atomically across
  mockApi (seed-derived zero-filled per-type buckets, per-job event activity with
  recency, event→job join for project scope with orphan exclusion, router-style 422
  for a malformed project id + unknown-project 404 + injectable `eventStats`
  failure), the stable `ApiClient` facade, live `httpApiClient`
  (`GET /events/stats?project_id=`), `queryKeys` and `useQueries`, with a shared
  `lib/eventStats` derivation/validation helper and new `JOB_EVENTS` seeds;
  parity guard extended to both transports. My owned column had no unchecked
  rows, so C103 was added under the Never-empty well.
  ✅ 2026-11-19 — `a740483`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C104 (CI) Extend the live-mode HTTP smoke job with the authoritative
  job event stream statistics endpoint from C101/C103
  (`GET /api/v1/events/stats?project_id=`): probe the zero-filled snapshot
  shape (`total_events`, `total_jobs`, `by_type`, `by_job`,
  `newest_event_at`, `generated_at`) + per-type/per-job breakdown shapes and
  the six canonical event types (status/progress/intermediate/result/error/
  log), the optional `project_id` scope (unknown → shared 404
  `project_not_found`), and the shared 422 `validation_error` envelope with
  request-id, keeping CI aligned with the exact `/api/v1` URLs the
  `VITE_API_MODE=live` client calls as the repo grows. No unchecked CI row
  remained, so C104 was added under the Never-empty well.
  ✅ 2026-11-19 — `7a65bab`
  Screens event-stats rendering remains a screens follow-up.

- [x] C105 (backend) Authoritative job retry statistics API:
  `GET /api/v1/retries/stats?project_id=` derives accepted-retry totals,
  distinct retried-job counts, a zero-filled retried-jobs-by-current-status
  breakdown (queued/running/succeeded/failed/canceled) and per-project retry/
  job activity from the authoritative `JOB_RETRIES` idempotency ledger joined to
  jobs (orphans excluded, idempotent replays collapse), with newest retried-job
  activity recency (the timestamp-free ledger uses the joined job's latest
  created/started/finished signal) and deterministic cross-backend ordering;
  optional `project_id` scope (unknown → shared 404 `project_not_found`,
  malformed → shared 422); `RetryStats`/`RetryStatusCount`/`RetryProjectCount`
  mirrored in `frontend/src/types/retryStats.ts`, README endpoint list synced,
  5 tests × 2 storage backends green (761 passed, contract parity + route-surface
  guard + tsc clean). Mocks/screens/CI wiring of the snapshot is a follow-up.
  My owned backend column had no unchecked items (only the repo-wide C6 docs
  pass remains, owned by other agents), so C105 was added under the Never-empty
  well. ✅ 2026-11-19 — `9db35b3`

- [x] C106 (screens) Render the authoritative job event-stream statistics (C101/
  C103/C104 follow-up) via `useEventStats`: a reusable `EventStatsPanel` with
  workspace-wide (Jobs) and project-scoped (project detail) variants, four stat
  cards (events, emitting jobs, error share, newest event), zero-filled status/
  progress/intermediate/result/error/log type and per-job activity breakdowns,
  and loading/error/missing/empty/populated states — every display value derived
  in tested `eventStatsHelpers`. Resolves the C104 screens follow-up. My owned
  column had no unchecked rows (only the repo-wide C6 docs pass remains, owned by
  other agents), so C106 was added under the Never-empty well.
  ✅ 2026-11-19 — `0471d47`

- [x] C107 (mocks) Wire the authoritative job retry statistics API (C105
  follow-up) end to end: expose `getRetryStats` / `useRetryStats` atomically
  across mockApi (seed-derived zero-filled retried-jobs-by-status buckets,
  per-project retry/job activity sorted by descending retries then project id,
  duplicate ledger entries counted per retried job, orphan exclusion, recency
  from the joined job's latest created/started/finished signal; router-style 422
  for a malformed project id + unknown-project 404 + injectable `retryStats`
  failure), the stable `ApiClient` facade, live `httpApiClient`
  (`GET /retries/stats?project_id=`), `queryKeys` and `useQueries`, with a
  shared `lib/retryStats` derivation/validation helper and retry-ledger seeds;
  populated/empty/error seeds and parity guard extended to both transports.
  My owned column had no unchecked rows, so C107 was added under the
  Never-empty well. ✅ 2026-11-19 — `87ae1e5`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C108 (CI) Extend the live-mode HTTP smoke job with the authoritative
  job retry statistics endpoint from C105/C107
  (`GET /api/v1/retries/stats?project_id=`): probe the zero-filled snapshot
  shape (`total_retries`, `total_jobs`, `by_status`, `by_project`,
  `newest_retry_at`, `generated_at`) + status/project breakdown shapes and the
  five canonical job statuses (queued/running/succeeded/failed/canceled), the
  optional `project_id` scope (unknown → shared 404 `project_not_found`), and
  the shared 422 `validation_error` envelope with request-id, keeping CI
  aligned with the exact `/api/v1` URLs the `VITE_API_MODE=live` client calls
  as the repo grows. No unchecked CI row remained, so C108 was added under the
  Never-empty well. ✅ 2026-11-19 — `d88537d`
  Screens retry-stats rendering remains a screens follow-up.

- [x] C109 (backend) Authoritative asset version statistics API:
  `GET /api/v1/versions/stats?project_id=` derives total version records,
  distinct versioned assets, revision count (v2+), a deterministic by-version
  distribution (ascending version number) and per-project version/asset activity
  (descending versions then project id) from the authoritative `ASSET_VERSIONS`
  store joined to assets for project attribution — no second index; versions of
  soft-deleted/unknown assets are excluded, with optional `project_id` scope
  (unknown → shared 404 `project_not_found`, malformed → shared 422) and a
  newest-version recency signal; `VersionStats`/`VersionNumberCount`/
  `VersionProjectCount` mirrored in `frontend/src/types/versionStats.ts`, README
  endpoint list synced, 5 tests × 2 storage backends green (771 passed, contract
  parity + route-surface guard + tsc clean). Mocks/screens/CI wiring of the
  snapshot is a follow-up. My owned backend column had no unchecked items (only
  the repo-wide C6 docs pass remains, owned by other agents), so C109 was added
  under the Never-empty well. ✅ 2026-11-19 — `7711aec`

- [x] C110 (screens) Render the authoritative job retry statistics (C105/C107/
  C108 follow-up) via `useRetryStats`: a reusable `RetryStatsPanel` with
  workspace-wide (Jobs) and project-scoped (project detail) variants, four stat
  cards, zero-filled queued/running/succeeded/failed/canceled status and
  per-project retry/job breakdowns, and loading/error/missing/empty/populated
  states — every display value derived in tested `retryStatsHelpers`.
  Resolves the C108 screens follow-up. My owned column had no unchecked rows,
  so C110 was added under the Never-empty well.
  ✅ 2026-11-19 — `75f0b3b`

- [x] C111 (mocks) Wire the authoritative asset version statistics API (C109
  follow-up) end to end: expose `getVersionStats` / `useVersionStats` atomically
  across mockApi (seed-derived version records from `ASSETS` with one v1 per
  asset plus revisions, ascending by-version buckets, per-project version/asset
  counts sorted by descending versions then id, distinct live-asset total,
  newest `(created_at, asset_id)` recency, soft-deleted/unknown-asset exclusion,
  router-style 422 for a malformed project id + unknown-project 404 + injectable
  `versionStats` failure), the stable `ApiClient` facade, live `httpApiClient`
  (`GET /versions/stats?project_id=`), `queryKeys` and `useQueries`, with a shared
  `lib/versionStats` derivation/validation helper and populated/empty/error seeds;
  parity guard extended to both transports. Resolves the C109 mocks-transport
  follow-up. My owned column had no unchecked rows, so C111 was added under the
  Never-empty well. ✅ 2026-11-19 — `28bac8a`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C112 (CI) Extend the live-mode HTTP smoke job with the authoritative asset
  version statistics endpoint from C109/C111
  (`GET /api/v1/versions/stats?project_id=`): probe the zero-filled snapshot
  shape (`total_versions`, `total_assets`, `revisions`, `by_version`,
  `by_project`, `newest_version_at`, `generated_at`) + version-number/per-project
  breakdown shapes, append a revision to the on-demand registered asset so the
  derived 200 shape (`revisions >= 1`, a `version: 2` bucket) is exercised, the
  optional `project_id` scope (unknown → shared 404 `project_not_found`), and
  the shared 422 `validation_error` envelope with request-id, keeping CI aligned
  with the exact `/api/v1` URLs the `VITE_API_MODE=live` client calls as the
  repo grows. No unchecked CI row remained, so C112 was added under the
  Never-empty well.
  ✅ 2026-11-19 — `8da0578`
  Screens version-stats rendering remains a screens follow-up.

- [x] C113 (backend) Authoritative publish statistics API:
  `GET /api/v1/publishes/stats?project_id=` derives published-asset counts,
  delivered byte totals, a deterministic by-version distribution (ascending)
  and per-project publish activity (descending count then project id), plus
  newest-publish recency and generated-at, from publish receipts in the
  authoritative asset store (no second index); soft-deleted/unpublished assets
  and malformed receipts are excluded, with an optional `project_id` scope
  (unknown → shared 404 `project_not_found`, malformed → shared 422), mirrored
  `PublishStats`/`PublishVersionCount`/`PublishProjectCount` in
  `frontend/src/types/publishStats.ts`, README endpoint list synced, 6 tests ×
  2 storage backends green (783 passed, contract parity + route-surface guard +
  tsc clean). Mocks/screens/CI wiring of the snapshot is a follow-up. My owned
  backend column had no unchecked items (only the repo-wide C6 docs pass remains,
  owned by other agents), so C113 was added under the Never-empty well.
  ✅ 2026-11-19 — `207d242`

- [x] C114 (screens) Render the authoritative asset version statistics (C109/C111/C112
  follow-up) via `useVersionStats`: a reusable `VersionStatsPanel` with workspace-wide
  (Home) and project-scoped (Assets browser, project detail) variants, four stat cards,
  version-number and per-project version/asset breakdowns, and loading/error/missing/
  empty/populated states — every display value derived in tested `versionStatsHelpers`.
  Resolves the C112 screens follow-up. My owned column had no unchecked rows, so C114 was
  added under the Never-empty well. ✅ 2026-11-19 — `bad8580`

- [x] C115 (mocks) Wire the authoritative publish statistics API (C113 follow-up)
  end to end: expose `getPublishStats` / `usePublishStats` atomically across mockApi
  (receipt-derived totals, delivered bytes, ascending by-version buckets,
  per-project publish/byte counts sorted by descending publishes then id, newest
  publish recency; soft-deleted assets and malformed receipts excluded,
  router-style 422 for a malformed project id + unknown-project 404 + injectable
  `publishStats` failure), the stable `ApiClient` facade, live `httpApiClient`
  (`GET /publishes/stats?project_id=`), `queryKeys` and `useQueries`, with a shared
  `lib/publishStats` derivation/validation helper and quantitative receipt seeds;
  parity guard extended to both transports. My owned column had no unchecked rows,
  so C115 was added under the Never-empty well. ✅ 2026-11-19 — `91afa99`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C116 (CI) Extend the live-mode HTTP smoke job with the authoritative
  publish statistics endpoint from C113/C115
  (`GET /api/v1/publishes/stats?project_id=`): probe the snapshot shape
  (`total_published`, `total_bytes`, `by_version`, `by_project`,
  `newest_published_at`, `generated_at`) + by-version/by-project breakdown
  shapes, publish the on-demand registered asset via `PATCH /assets/{id}` with a
  `publish_receipt` so the derived 200 shape (`total_published >= 1`, a
  `version: 1` bucket) is exercised, the optional `project_id` scope (unknown →
  shared 404 `project_not_found`, malformed → shared 422 `validation_error`)
  and the request-id header, keeping CI aligned with the exact `/api/v1` URLs
  the `VITE_API_MODE=live` client calls as the repo grows. No unchecked CI row
  remained, so C116 was added under the Never-empty well.
  ✅ 2026-11-19 — `8cc2730`
  Screens publish-stats rendering remains a screens follow-up.

- [x] C117 (backend) Authoritative per-job execution log API:
  `GET /api/v1/jobs/{job_id}/logs?level=&since_seq=&limit=` derives a
  chronological, severity-filtered, cursor-paginated job-console view from the
  authoritative `JOB_EVENTS` stream (no second index) — each event projected to
  a `JobLogEntry` with a coarse `LogLevel` (debug/info/success/error), a resume
  `next_seq` cursor and a stream-wide `total`; optional `level` filter and
  `since_seq`/`limit` bounds with shared 404 `job_not_found` / 422
  `validation_error` envelopes and request-id. `JobLogEntry`/`JobLogFrame`/
  `LogLevel` mirrored in `frontend/src/types/jobLogs.ts`, README endpoint list
  synced, 8 tests × 2 storage backends green (799 passed, contract parity +
  route-surface guard + tsc clean). Mocks/screens/CI wiring of the log view is a
  follow-up. My owned backend column had no unchecked items (only the repo-wide
  C6 docs pass remains, owned by other agents), so C117 was added under the
  Never-empty well. ✅ 2026-11-19 — `551fac6`

- [x] C118 (screens) Render the authoritative publish statistics (C113/C115/C116
  follow-up) via `usePublishStats`: a reusable `PublishStatsPanel` with workspace-wide
  (Home) and project-scoped (Assets browser, project detail) variants, four stat cards,
  ascending version and descending per-project publish/byte breakdowns, and loading/
  error/missing/empty/populated states — every display value derived in tested
  `publishStatsHelpers` (byte-size/relative-time formatting, shares, empty detection).
  Resolves the C116 screens follow-up. My owned column had no unchecked rows, so C118
  was added under the Never-empty well.
  ✅ 2026-11-19 — `068adb7`

- [x] C119 (mocks) Wire the authoritative per-job execution log API (C117
  follow-up) end to end: expose `getJobLogs` / `useJobLogs` atomically across
  mockApi (JOB_EVENTS-derived chronological, severity-filtered, cursor-paginated
  log frames with coarse levels, stream-wide totals and resume cursors;
  router-style 422 for a malformed job id / level / since_seq / limit +
  unknown-job 404-to-undefined + injectable `jobLogs` failure), the stable
  `ApiClient` facade, live `httpApiClient`
  (`GET /jobs/{job_id}/logs?level=&since_seq=&limit=`), `queryKeys` and
  `useQueries`, with a shared `lib/jobLogs` derivation/validation helper and
  enriched event seeds; parity guard extended to both transports (populated/
  filtered/paged/404/422 + surface guard). Resolves the C117 mocks-transport
  follow-up. My owned column had no unchecked rows, so C119 was added under the
  Never-empty well. ✅ 2026-11-19 — `c7331a4`
  Screens log-console rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C120 (CI) Extend the live-mode HTTP smoke job with the authoritative
  per-job execution log endpoint from C117/C119
  (`GET /api/v1/jobs/{job_id}/logs?level=&since_seq=&limit=`): submit a job on
  demand so the `JOB_EVENTS`-derived frame has a real stream, then probe the
  frame shape (`job_id`/`entries`/`next_seq`/`total`), derived log entries with
  coarse levels, the `level` filter, `limit` paging and the `since_seq` resume
  cursor (no overlap), plus the shared 404 `job_not_found` / 422
  `validation_error` envelopes with request-id and the request-id header.
  Keeps CI aligned with the exact `/api/v1` URLs the `VITE_API_MODE=live`
  client calls as the repo grows. No unchecked CI row remained, so C120 was
  added under the Never-empty well. ✅ 2026-11-19 — `60e6b6e`
  Screens log-console rendering remains a screens follow-up.

- [x] C121 (backend) Authoritative job dispatch-queue API:
  `GET /api/v1/jobs/queue?project_id=&limit=` derives the active (queued +
  running) job queue in FIFO order with 1-based positions, whole-queue
  waiting/running counters and a bounded page directly from the authoritative
  `JOBS` store (no second index; terminal jobs excluded, `(created_at, job_id)`
  FIFO tie-break for deterministic cross-backend order), with an optional
  `project_id` scope (unknown → shared 404 `project_not_found`, malformed →
  shared 422) and `limit` bounds; `JobQueueEntry`/`JobQueueView` mirrored in
  `frontend/src/types/jobQueue.ts`, README endpoint list synced, 8 tests × 2
  storage backends green (815 passed, contract parity + route-surface guard +
  tsc clean). Mocks/screens/CI wiring of the queue view is a follow-up. My owned
  backend column had no unchecked items (only the repo-wide C6 docs pass
  remains, owned by other agents), so C121 was added under the Never-empty well.
  ✅ 2026-11-19 — `f76e856`

- [x] C122 (screens) Render the authoritative per-job execution log (C117/C119/
  C120 follow-up) via `useJobLogs`: a reusable `JobLogConsole` with a job picker,
  severity chips, page-size select and forward/backward cursor navigation on the
  Jobs screen and project detail, and loading/error/missing/empty/populated
  states — every display value derived in tested `jobLogHelpers`. Resolves the
  C120 screens follow-up. My owned column had no unchecked rows, so C122 was added
  under the Never-empty well.
  ✅ 2026-11-19 — `e8ac977`

- [x] C123 (mocks) Wire the authoritative job dispatch-queue API (C121
  follow-up) end to end: expose `getJobQueue` / `useJobQueue` atomically across
  mockApi (seed-derived FIFO active-job queue with 1-based positions, whole-queue
  total/waiting/running counters, bounded `limit` page, router-style 422 for a
  malformed project id or out-of-range limit, unknown-project 404 + injectable
  `jobQueue` failure), the stable `ApiClient` facade, live `httpApiClient`
  (`GET /jobs/queue?project_id=&limit=`), `queryKeys` and `useQueries`, with a
  shared `lib/jobQueue` derivation/validation helper and populated/empty/error
  tests; parity guard extended to both transports. My owned column had no
  unchecked rows, so C123 was added under the Never-empty well. Resolves the
  C121 mocks-transport follow-up. ✅ 2026-11-19 — `c26c1d9`

- [x] C124 (CI) Extend the live-mode HTTP smoke job with the authoritative job
  dispatch queue endpoint from C121/C123 (`GET /api/v1/jobs/queue?project_id=&limit=`):
  probe the derived snapshot shape (`total`/`waiting`/`running`/`entries`/
  `generated_at`), whole-queue counter invariants (`total == waiting + running`,
  page bounded by `total`), entry shapes with 1-based FIFO positions and active
  statuses (queued/running), reuse the on-demand submitted job to assert it appears
  as a derived queued entry, the `limit` page bound (counters unchanged), the
  optional `project_id` scope and the shared 404 `project_not_found` / 422
  `validation_error` envelopes with request-id. Keeps CI aligned with the exact
  `/api/v1` URLs the `VITE_API_MODE=live` client calls as the repo grows. No
  unchecked CI row remained, so C124 was added under the Never-empty well.
  ✅ 2026-11-19 — `bf28a6a`
  Screens queue-view rendering remains a screens follow-up.

- [x] C125 (backend) Authoritative publish-feed API: `GET /api/v1/publishes?project_id=&limit=`
  derives a newest-first feed of published deliverables from the same authoritative
  `publish_receipt` records `GET /publishes/stats` reads (no second index) — each
  item carries asset/project id + display name, asset type, receipt version/byte
  size and publish time, with project names joined from the authoritative project
  store and a deterministic `(published_at, asset_id)` newest-first tie-break;
  soft-deleted/unpublished assets and malformed receipts are excluded, the whole-
  scope `total` is counted before the `limit` page, and an optional `project_id`
  scope uses shared 404 `project_not_found` / 422 `validation_error` envelopes.
  `PublishFeed`/`PublishFeedItem` mirrored in `frontend/src/types/publishFeed.ts`,
  README endpoint list synced, 9 tests × 2 storage backends green (833 passed,
  contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring of
  the feed is a follow-up. My owned backend column had no unchecked items (only
  the repo-wide C6 docs pass remains, owned by other agents), so C125 was added
  under the Never-empty well. ✅ 2026-11-19 — `3e145eb`

- [x] C126 (screens) Render the authoritative job dispatch queue (C121/C123/C124
  follow-up) via `useJobQueue`: a reusable `JobQueuePanel` on the Jobs screen
  (workspace-wide) and project detail (project-scoped) with four whole-queue stat
  cards, waiting/running composition bars, FIFO rows carrying 1-based positions,
  friendly operation/project labels, status badges and queue-age hints, a bounded
  page-size select and refresh, plus loading/error/missing/empty/populated states —
  every display value derived in tested `jobQueueHelpers`. Resolves the C124
  screens follow-up. My owned column had no unchecked rows, so C126 was added under
  the Never-empty well. ✅ 2026-11-19 — `ef8ab4e`

- [x] C127 (mocks) Wire the authoritative publish-feed API (C125 follow-up) end
  to end: expose `getPublishFeed` / `usePublishFeed` atomically across mockApi
  (seed-derived newest-first receipts with `(published_at, asset_id)` tie-break,
  joined project names with an "Unknown project" fallback, soft-deleted/
  malformed-receipt exclusion, whole-scope `total` before the `limit` page,
  router-style 422 for a malformed project id or out-of-range limit,
  unknown-project 404 + injectable `publishFeed` failure), the stable `ApiClient`
  facade, live `httpApiClient` (`GET /publishes?project_id=&limit=`), `queryKeys`
  and `useQueries`, with a shared `lib/publishFeed` derivation/validation helper
  and populated/empty/error tests; parity guard extended to both transports.
  My owned column had no unchecked rows, so C127 was added under the Never-empty
  well. ✔ 2026-11-19 — `b009ad1`
  Screens feed rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C128 (CI) Extend the live-mode HTTP smoke job with the authoritative
  publish-feed endpoint from C125/C127 (`GET /api/v1/publishes?project_id=&limit=`):
  reuse the on-demand asset already published in the publishes/stats probe, then
  probe the feed shape (`items`/`total`/`generated_at`), item shapes (asset/project
  ids + names, asset type, version, bytes, publish time), newest-first ordering
  with an asset-id tie-break, the whole-scope `total` before the `limit` page, the
  `limit` page bound (counters unchanged), the optional `project_id` scope and the
  shared 404 `project_not_found` / 422 `validation_error` envelopes (malformed id +
  invalid limit) with request-id, keeping CI aligned with the exact `/api/v1`
  URLs the `VITE_API_MODE=live` client calls as the repo grows. No unchecked CI
  row remained, so C128 was added under the Never-empty well.
  ✅ 2026-11-19 — `85c9f68`
  Screens publish-feed rendering remains a screens follow-up.

- [x] C129 (backend) Authoritative upload-ticket feed API:
   `GET /api/v1/uploads/feed?project_id=&limit=` derives a newest-first feed of
   upload tickets from the same authoritative `UPLOADS` collection
   `GET /uploads/stats` reads (no second index) — ticket and project identity
   (id + joined display name), filename/content type, lifecycle status, declared
   and uploaded byte sizes and creation/expiry timestamps (internal storage path
   excluded), with a deterministic `(created_at, upload_id)` newest-first tie-break,
   a whole-scope `total` counted before the `limit` page, and an optional
   `project_id` scope with shared 404 `project_not_found` / 422 `validation_error`
   envelopes; `UploadFeed`/`UploadFeedItem` mirrored in
   `frontend/src/types/uploadFeed.ts`, README endpoint list synced, 8 tests × 2
   storage backends green (849 passed, contract parity + route-surface guard + tsc
   clean). Mocks/screens/CI wiring of the feed is a follow-up. My owned backend
   column had no unchecked items (only the repo-wide C6 docs pass remains, owned by
   other agents), so C129 was added under the Never-empty well.
   ✅ 2026-11-19 — `f0ddf48`

- [x] C130 (screens) Render the authoritative publish feed (C125/C127/C128
  follow-up) via `usePublishFeed`: a reusable `PublishFeedPanel` with
  workspace-wide (Home) and project-scoped (project detail) variants, page-size
  chips, newest-first rows showing asset/project names, type badges, version and
  byte-size labels and publish recency, deep links that scope the assets browser
  to the row's project before selecting the asset, and loading/error/missing/
  empty/populated states — every display value derived in tested
  `publishFeedHelpers`. Resolves the C128 screens follow-up. My owned column had
  no unchecked rows, so C130 was added under the Never-empty well.
  ✅ 2026-11-19 — `ad00286`

- [x] C131 (mocks) Wire the authoritative upload-ticket feed API (C129 follow-up)
  end to end: expose `getUploadFeed` / `useUploadFeed` atomically across mockApi
  (seed-derived newest-first tickets with a `(created_at, upload_id)` tie-break,
  joined project names with an "Unknown project" fallback, declared/uploaded
  byte sizes and expiry, router-style 422 for a malformed project id or
  out-of-range limit, unknown-project 404 + injectable `uploadFeed` failure), the
  stable `ApiClient` facade, live `httpApiClient` (`GET /uploads/feed?project_id=&limit=`),
  `queryKeys` and `useQueries`, with a shared `lib/uploadFeed` derivation/validation
  helper and feed-enriched upload seeds; parity guard extended to both transports.
  My owned column had no unchecked rows, so C131 was added under the Never-empty
  well. ✅ 2026-11-19 — `2402499`
  Screens feed rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C132 (CI) Extend the live-mode HTTP smoke job with the authoritative
  upload-ticket feed endpoint from C129/C131
  (`GET /api/v1/uploads/feed?project_id=&limit=`): issue one upload ticket on
  demand so the derived feed has a real item, then probe the feed shape
  (`items`/`total`/`generated_at`), item shapes (upload/project ids + joined
  project name, filename/content type, status, declared/uploaded bytes and
  creation/expiry timestamps), newest-first `(created_at, upload_id)` ordering,
  the whole-scope `total` before the `limit` page (counters unchanged), the
  optional `project_id` scope and the shared 404 `project_not_found` / 422
  `validation_error` envelopes (malformed id + invalid limit) with request-id,
  keeping CI aligned with the exact `/api/v1` URLs the `VITE_API_MODE=live`
  client calls as the repo grows. No unchecked CI row remained, so C132 was
  added under the Never-empty well.
  ✅ 2026-11-19 — `2aef7b8`
  Screens upload-feed rendering remains a screens follow-up.

- [x] C133 (backend) Authoritative conversation feed API:
  `GET /api/v1/conversations/feed?project_id=&limit=` derives a newest-first
  workspace feed of conversations from the authoritative `CONVERSATIONS` store
  (no second index) — conversation/project identity with joined project name,
  title, canonical message count and a last-message role/truncated-excerpt preview
  derived from the `MESSAGES` store, with a deterministic `(updated_at,
  conversation_id)` tie-break, a whole-scope `total` counted before the `limit`
  page, and an optional `project_id` scope with shared 404 `project_not_found` /
  422 `validation_error` envelopes; `ConversationFeed`/`ConversationFeedItem`
  mirrored in `frontend/src/types/conversationFeed.ts`, README endpoint list
  synced, 10 tests × 2 storage backends green (869 passed, contract parity +
  route-surface guard + tsc clean). Mocks/screens/CI wiring of the feed is a
  follow-up. My owned backend column had no unchecked items (only the repo-wide
  C6 docs pass remains, owned by other agents), so C133 was added under the
  Never-empty well. ✅ 2026-11-19 — `ffcb040`

- [x] C134 (screens) Render the authoritative upload-ticket feed (C129/C131/C132
  follow-up) via `useUploadFeed`: a reusable `UploadFeedPanel` with workspace-wide
  (Home) and project-scoped (project detail) variants, page-size chips,
  newest-first rows showing filenames, joined project names, status badges,
  declared/uploaded byte sizes and created/expiry labels, deep links to the
  existing project-detail route, and loading/error/missing/empty/populated states
  — every display value derived in tested `uploadFeedHelpers`. Resolves the C132
  screens follow-up. My owned column had no unchecked rows, so C134 was added under
  the Never-empty well. ✅ 2026-11-19 — `be151cd`

- [x] C135 (mocks) Wire the authoritative conversation feed API (C133 follow-up)
  end to end: expose `getConversationFeed` / `useConversationFeed` atomically across
  mockApi (seed-derived newest-first feed with an `(updated_at, conversation_id)`
  tie-break, joined project names with an "Unknown project" fallback, last-message
  role + whitespace-normalized/truncated excerpt preview derived from the `MESSAGES`
  store with an `(created_at, message_id)` tie-break and null previews for empty
  conversations, whole-scope `total` before the `limit` page, router-style 422 for a
  malformed project id or out-of-range limit, unknown-project 404 + injectable
  `conversationFeed` failure), the stable `ApiClient` facade, live `httpApiClient`
  (`GET /conversations/feed?project_id=&limit=`), `queryKeys` and `useQueries`, with a
  shared `lib/conversationFeed` derivation/validation helper; parity guard extended
  to both transports. My owned column had no unchecked rows, so C135 was added under
  the Never-empty well. ✅ 2026-11-19 — `f28c707`
  Screens feed rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C136 (CI) Extend the live-mode HTTP smoke job with the authoritative
  conversation feed endpoint from C133/C135
  (`GET /api/v1/conversations/feed?project_id=&limit=`): create one conversation
  with an initial message and append an assistant reply on demand so the derived
  feed has a real item with a last-message preview, then probe the feed shape
  (`items`/`total`/`generated_at`), item shapes (conversation/project ids + joined
  project name, title, message count, created/updated timestamps and the derived
  last-message role/excerpt preview), newest-first `(updated_at, conversation_id)`
  ordering, the whole-scope `total` before the `limit` page (counters unchanged),
  the optional `project_id` scope and the shared 404 `project_not_found` / 422
  `validation_error` envelopes (malformed id + invalid limit) with request-id,
  keeping CI aligned with the exact `/api/v1` URLs the `VITE_API_MODE=live` client
  calls as the repo grows. No unchecked CI row remained, so C136 was added under
  the Never-empty well. ✅ 2026-11-19 — `edeb8cb`
  Screens conversation-feed rendering remains a screens follow-up.

- [x] C137 (backend) Authoritative asset feed API:
  `GET /assets/feed?project_id=&limit=` derives a newest-first, workspace-wide
  feed of live assets from the authoritative `ASSETS` collection (no second
  index) — asset/project identity with a joined project display name, type/name/
  status, current version, recorded byte size and created/updated timestamps,
  with a deterministic `(created_at, asset_id)` newest-first tie-break and a
  whole-scope `total` counted before the `limit` page; soft-deleted assets are
  excluded (matching `/assets` and `/assets/stats`), with an optional
  `project_id` scope using shared 404 `project_not_found` / 422
  `validation_error` envelopes. `AssetFeed`/`AssetFeedItem` mirrored in
  `frontend/src/types/assetFeed.ts`, README endpoint list synced, 10 tests × 2
  storage backends green (889 passed, contract parity + route-surface guard +
  tsc clean). Mocks/screens/CI wiring of the feed is a follow-up. My owned
  backend column had no unchecked items (only the repo-wide C6 docs pass remains,
  owned by other agents), so C137 was added under the Never-empty well.
  ✅ 2026-11-19 — `503f143`

- [x] C138 (screens) Render the authoritative conversation feed (C133/C135/C136
  follow-up) via `useConversationFeed`: a reusable `ConversationFeedPanel` with
  workspace-wide (Home) and project-scoped (project detail) variants, page-size
  chips, newest-first rows showing conversation title, joined project name,
  message count and a last-message role badge + excerpt, and Open buttons that
  deep-link to the chat route with the selected conversation — with loading/
  error/missing/empty/populated states and every display value derived in
  tested `conversationFeedHelpers`. My owned column had no unchecked rows, so
  C138 was added under the Never-empty well. ✅ 2026-11-19 — `7c62ff2`

- [x] C139 (mocks) Wire the authoritative asset feed API (C137 follow-up) end
  to end: expose `getAssetFeed` / `useAssetFeed` atomically across mockApi
  (newest-first `(created_at, asset_id)` derivation from live assets, joined
  project names with an "Unknown project" fallback, soft-deleted-asset exclusion,
  defaults for status/version, whole-scope `total` before the `limit` page,
  router-style 422 for a malformed project id or out-of-range limit,
  unknown-project 404 + injectable `assetFeed` failure), the stable `ApiClient`
  facade, live `httpApiClient` (`GET /assets/feed?project_id=&limit=`), `queryKeys`
  and `useQueries`, with a shared `lib/assetFeed` derivation/validation helper;
  populated/empty/error seeds and parity guard extended to both transports.
  My owned column had no unchecked rows, so C139 was added under the Never-empty
  well. ✅ 2026-11-19 — `a0c1671`
  Screens feed rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C140 (CI) Extend the live-mode HTTP smoke job with the authoritative
  asset feed endpoint from C137/C139 (`GET /api/v1/assets/feed?project_id=&limit=`):
  reuse the on-demand registered asset so the derived feed has a real item, then
  probe the feed shape (`items`/`total`/`generated_at`), derived item shapes
  (asset/project ids + joined project name, type/name/status, version, byte size
  and created/updated timestamps), newest-first `(created_at, asset_id)` ordering,
  the whole-scope `total` before the `limit` page (counters unchanged), the
  optional `project_id` scope and the shared 404 `project_not_found` / 422
  `validation_error` envelopes (malformed id + invalid limit) with request-id,
  keeping CI aligned with the exact `/api/v1` URLs the `VITE_API_MODE=live`
  client calls as the repo grows. No unchecked CI row remained, so C140 was
  added under the Never-empty well. Screens asset-feed rendering remains a
  screens follow-up.
  ✅ 2026-11-19 — `1e2f64b`

- [x] C141 (backend) Authoritative job feed API:
  `GET /api/v1/jobs/feed?project_id=&status=&limit=` derives a newest-first,
  workspace-wide feed of jobs from the authoritative `JOBS` collection (no
  second index) — job/project identity with a joined project display name,
  operation id, lifecycle status/progress/attempt/creator and created/started/
  finished timestamps, with a deterministic `(created_at, job_id)` newest-first
  tie-break and a whole-scope `total` counted before the `limit` page; optional
  `project_id` and `status` scopes use shared 404 `project_not_found` / 422
  `validation_error` envelopes. `JobFeed`/`JobFeedItem` mirrored in
  `frontend/src/types/jobFeed.ts`, README endpoint list synced, 11 tests × 2
  storage backends green (911 passed, contract parity + route-surface guard +
  tsc clean). Mocks/screens/CI wiring of the feed is a follow-up. My owned
  backend column had no unchecked items (only the repo-wide C6 docs pass
  remains, owned by other agents), so C141 was added under the Never-empty well.
  ✅ 2026-11-19 — `22e1ca7`

- [x] C142 (screens) Render the authoritative asset feed (C137/C139/C140
  follow-up) via `useAssetFeed`: a reusable `AssetFeedPanel` on Home
  (workspace-wide) and project detail (project-scoped) with page-size chips,
  newest-first rows showing asset/project names, type and status badges, version
  and byte-size labels and create recency, deep links that scope the assets
  browser to the row's project before selecting the asset, and loading/error/
  missing/empty/populated states — every display value derived in tested
  `assetFeedHelpers`. Resolves the C140 screens follow-up. My owned column had no
  unchecked rows, so C142 was added under the Never-empty well.
  ✅ 2026-11-19 — `fb6c50b`

- [x] C143 (mocks) Wire the authoritative job feed API (C141 follow-up) end to
  end: expose `getJobFeed` / `useJobFeed` atomically across mockApi (newest-first
  `(created_at, job_id)` derivation over the existing job/project seeds with
  joined project names and an "Unknown project" fallback, optional
  `project_id`/`status` scopes, progress/attempt/timestamp schema defaults,
  whole-scope `total` before the `limit` page, router-style 422 for a malformed
  project id / unknown status / out-of-range limit, unknown-project 404 +
  injectable `jobFeed` failure), the stable `ApiClient` facade, live
  `httpApiClient` (`GET /jobs/feed?project_id=&status=&limit=`), `queryKeys` and
  `useQueries`, with a shared `lib/jobFeed` derivation/validation helper;
  populated/empty/error cases and parity guard extended to both transports.
  My owned column had no unchecked rows, so C143 was added under the Never-empty
  well. ✅ 2026-11-19 — `8c92c39`
  Screens job-feed rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C144 (CI) Extend the live-mode HTTP smoke job with the authoritative job
  feed endpoint from C141/C143 (`GET /api/v1/jobs/feed?project_id=&status=&limit=`):
  reuse the on-demand submitted job so the derived feed has a real item, then
  probe the feed shape (`items`/`total`/`generated_at`), derived item shapes
  (job/project ids + joined project name, operation id, status, progress, attempt,
  creator and created/started/finished timestamps), newest-first
  `(created_at, job_id)` ordering, the whole-scope `total` before the `limit` page
  (counters unchanged), the `status` filter, the optional `project_id` scope and
  the shared 404 `project_not_found` / 422 `validation_error` envelopes (malformed
  id + invalid status + invalid limit) with request-id, keeping CI aligned with
  the exact `/api/v1` URLs the `VITE_API_MODE=live` client calls as the repo grows.
  No unchecked CI row remained (only the repo-wide C6 docs pass remains, owned by
  other agents), so C144 was added under the Never-empty well. Resolves the C143
  CI live-smoke follow-up. Screens job-feed rendering remains a screens follow-up.
  ✅ 2026-11-19 — `ec5242d`

- [x] C145 (backend) Authoritative project feed API:
  `GET /api/v1/projects/feed?org_id=&lifecycle=&limit=` derives a newest-first,
  workspace-wide feed of projects from the authoritative `PROJECTS` collection
  (no second index) — project/org identity with a joined organization display
  name (orphan fallback), description, a canonical `active`/`archived` lifecycle
  label derived from the `archived` flag, creator and created/updated timestamps,
  with a deterministic `(created_at, project_id)` newest-first tie-break and a
  whole-scope `total` counted before the `limit` page; an optional `org_id` scope
  yields a zero-filled 200 for an unknown-but-valid org (matching
  `GET /projects?org_id=` and `/projects/stats?org_id=`) with shared 422 envelopes
  for a malformed id, invalid lifecycle or invalid limit. `ProjectFeed`/
  `ProjectFeedItem` mirrored in `frontend/src/types/projectFeed.ts`, README
  endpoint list synced, 12 tests × 2 storage backends green (935 passed, contract
  parity + route-surface guard + tsc clean). Mocks/screens/CI wiring of the feed
  is a follow-up. My owned backend column had no unchecked items (only the
  repo-wide C6 docs pass remains, owned by other agents), so C145 was added under
  the Never-empty well. ✅ 2026-11-19 — `a94ae88`

- [x] C146 (screens) Render the authoritative job feed (C141/C143/C144
  follow-up) via `useJobFeed`: a reusable `JobFeedPanel` on the Jobs screen
  (workspace-wide) and project detail (project-scoped) with status and page-size
  filter chips, newest-first rows showing a prettified operation label, joined
  project name, progress percent and attempt label, and project-detail deep
  links — with loading/error/missing/empty/populated states and every display
  value derived in tested `jobFeedHelpers`. Resolves the C144 screens follow-up.
  My owned column had no unchecked rows, so C146 was added under the Never-empty
  well. ✅ 2026-11-19 — `f7a5c27`

- [x] C147 (mocks) Wire the authoritative project feed API (C145 follow-up) end to
  end: expose `getProjectFeed` / `useProjectFeed` atomically across mockApi
  (seed-derived newest-first `(created_at, project_id)` derivation over the
  project/organization stores with joined org names and an "Unknown organization"
  fallback, `archived`-derived active/archived lifecycle, org/lifecycle scopes,
  zero-filled feed for an unknown-but-valid org, whole-scope `total` before the
  `limit` page, router-style 422 for a malformed org / invalid lifecycle /
  out-of-range limit + injectable `projectFeed` failure), the stable `ApiClient`
  facade, live `httpApiClient` (`GET /projects/feed?org_id=&lifecycle=&limit=`),
  `queryKeys` and `useQueries`, with a shared `lib/projectFeed`
  derivation/validation helper; populated/empty/404-free/422 seeds and parity
  guard extended to both transports. My owned column had no unchecked rows, so
  C147 was added under the Never-empty well. ✅ 2026-11-19 — `33538cd`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C148 (CI) Extend the live-mode HTTP smoke job with the authoritative
  project feed endpoint from C145/C147 (`GET /api/v1/projects/feed?org_id=&lifecycle=&limit=`):
  reuse the on-demand project so the derived feed has a real item, then probe
  the feed shape (`items`/`total`/`generated_at`), derived item shapes
  (project/org ids + joined org name, name/description, active/archived
  lifecycle, creator and created/updated timestamps), newest-first
  `(created_at, project_id)` ordering, the `limit` page bound (total unchanged),
  the `lifecycle` filter, the optional `org_id` scope (an unknown-but-valid org
  yields a zero-filled 200) and the shared 422 `validation_error` envelopes
  (malformed org + invalid lifecycle + invalid limit) with request-id, keeping
  CI aligned with the exact `/api/v1` URLs the `VITE_API_MODE=live` client calls
  as the repo grows. No unchecked CI row remained, so C148 was added under the
  Never-empty well. Resolves the C147 CI live-smoke follow-up.
  ✅ 2026-11-19 — `52246f5`
  Screens project-feed rendering remains a screens follow-up.

- [x] C149 (backend) Authoritative comment feed API:
  `GET /api/v1/comments/feed?project_id=&limit=` derives a newest-first,
  workspace-wide feed of collaboration comments from the authoritative
  `COMMENTS` store (no second index) — comment/project identity with a joined
  project display name (orphan fallback), optional asset reference, author id,
  body and created timestamp, with a deterministic `(created_at, comment_id)`
  newest-first tie-break and a whole-scope `total` counted before the `limit`
  page; an optional `project_id` scope uses shared 404 `project_not_found` /
  422 `validation_error` envelopes and the request-id header.
  `CommentFeed`/`CommentFeedItem` mirrored in `frontend/src/types/commentFeed.ts`,
  README endpoint list synced, 11 tests × 2 storage backends green (955 passed,
  contract parity + route-surface guard clean). Mocks/screens/CI wiring of the
  feed is a follow-up. My owned backend column had no unchecked items (only the
  repo-wide C6 docs pass remains, owned by other agents), so C149 was added under
  the Never-empty well. ✅ 2026-11-19 — `93569fd`

- [x] C150 (screens) Render the authoritative project feed (C145/C147/C148
  follow-up) via `useProjectFeed`: a reusable `ProjectFeedPanel` with workspace-wide
  (Projects) and org-scoped (project detail) variants, lifecycle/page-size filter
  chips, newest-first rows showing project name, joined organization name,
  lifecycle badge and created-at recency, deep links to project detail, and
  loading/error/missing/empty/populated states — every display value derived in
  tested `projectFeedHelpers`. Resolves the C148 screens follow-up. My owned
  column had no unchecked rows, so C150 was added under the Never-empty well.
  ✅ 2026-11-19 — `e2fa8e2`

- [x] C151 (mocks) Wire the authoritative comment feed API (C149 follow-up) end
  to end: expose `getCommentFeed` / `useCommentFeed` atomically across mockApi
  (seed-derived newest-first `(created_at, comment_id)` derivation over the
  comment/project stores with joined project names and an "Unknown project"
  fallback, optional `project_id` scope, normalized 404 for an unknown project,
  `asset_id` null normalization, whole-scope `total` before the `limit` page,
  router-style 422 for a malformed project id / out-of-range limit + injectable
  `commentFeed` failure), the stable `ApiClient` facade, live `httpApiClient`
  (`GET /comments/feed?project_id=&limit=`), `queryKeys` and `useQueries`, with a
  shared `lib/commentFeed` derivation/validation helper; populated/empty/error
  seeds and parity guard extended to both transports. My owned column had no
  unchecked rows (only the repo-wide C6 docs pass remains, owned by other
  agents), so C151 was added under the Never-empty well.
  ✅ 2026-11-19 — `00b89e7`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C152 (CI) Extend the live-mode HTTP smoke job with the authoritative
  comment feed endpoint from C149/C151
  (`GET /api/v1/comments/feed?project_id=&limit=`): add one comment to the
  on-demand project so the derived feed has a real item, then probe the feed
  shape (`items`/`total`/`generated_at`), item shapes (comment/project ids +
  joined project name, optional asset id, author id, body and created timestamp),
  newest-first `(created_at, comment_id)` ordering, the whole-scope `total` before
  the `limit` page (total unchanged), the `limit` page bound, the optional
  `project_id` scope and the shared 404 `project_not_found` / 422
  `validation_error` envelopes (malformed id + invalid limit) with request-id,
  keeping CI aligned with the exact `/api/v1` URLs the `VITE_API_MODE=live`
  client calls as the repo grows. No unchecked CI row remained, so C152 was added
  under the Never-empty well. Resolves the C151 CI live-smoke follow-up.
  ✅ 2026-11-19 — `be78a8b`
  Screens comment-feed rendering remains a screens follow-up.

- [x] C153 (backend) Authoritative asset version feed API:
  `GET /api/v1/versions/feed?project_id=&limit=` derives a newest-first,
  workspace-wide feed of asset version records from the authoritative
  `ASSET_VERSIONS` store (no second index) — asset/project identity with joined
  project name and asset name/type, version number, creator and creation time,
  with a deterministic `(created_at, asset_id, version)` newest-first tie-break
  and a whole-scope `total` counted before the `limit` page; versions of
  soft-deleted/unknown assets are excluded (matching `/versions/stats`), with an
  optional `project_id` scope using shared 404 `project_not_found` / 422
  `validation_error` envelopes. `VersionFeed`/`VersionFeedItem` mirrored in
  `frontend/src/types/versionFeed.ts`, README endpoint list synced, 10 tests × 2
  storage backends green (975 passed, contract parity + route-surface guard).
  Mocks/screens/CI wiring of the feed is a follow-up. My owned backend column had
  no unchecked items (only the repo-wide C6 docs pass remains, owned by other
  agents), so C153 was added under the Never-empty well.
  ✅ 2026-11-19 — `ab8e865`

- [x] C154 (screens) Render the authoritative comment feed (C149/C151/C152
  follow-up) via `useCommentFeed`: a reusable `CommentFeedPanel` with
  workspace-wide (Home) and project-scoped (project detail) variants, page-size
  chips, newest-first rows showing a whitespace-normalized body preview, joined
  project name, author and optional asset-reference badges and comment recency,
  with deep links to project detail and to the referenced asset (scoping the
  assets browser to the row's project first), plus loading/error/missing/empty/
  populated states — every display value derived in tested `commentFeedHelpers`.
  Resolves the C152 screens follow-up. My owned column had no unchecked rows,
  so C154 was added under the Never-empty well.
  ✅ 2026-11-19 — `e762137`

- [x] C155 (mocks) Wire the authoritative asset version feed API (C153
  follow-up) end to end: expose `getVersionFeed` / `useVersionFeed` atomically
  across mockApi (seed-derived newest-first `(created_at, asset_id, version)`
  derivation over the version/asset/project stores with joined project names and
  an "Unknown project" fallback, soft-deleted/unknown-asset exclusion, optional
  `project_id` scope, whole-scope `total` before the `limit` page, router-style
  422 for a malformed project id / out-of-range limit + unknown-project 404 +
  injectable `versionFeed` failure), the stable `ApiClient` facade, live
  `httpApiClient` (`GET /versions/feed?project_id=&limit=`), `queryKeys` and
  `useQueries`, with a shared `lib/versionFeed` derivation/validation helper,
  enriched version seeds and populated/empty/error tests; parity guard extended
  to both transports. My owned column had no unchecked rows (only the repo-wide
  C6 docs pass remains, owned by other agents), so C155 was added under the
  Never-empty well. ✅ 2026-11-19 — `907fef2`
  Screens version-feed rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C156 (CI) Extend the live-mode HTTP smoke job with the authoritative asset
  version feed endpoint from C153/C155
  (`GET /api/v1/versions/feed?project_id=&limit=`): reuse the on-demand registered
  asset (which carries the v1 from registration plus the v2 appended in the
  versions/stats probe) so the derived feed has real items; probe the feed shape
  (`items`/`total`/`generated_at`), item shapes (asset/project ids + joined project
  name, asset name/type, version, creator and created timestamp), newest-first
  `(created_at, asset_id, version)` ordering, the whole-scope `total` before the
  `limit` page (counters unchanged), the optional `project_id` scope (unknown →
  shared 404 `project_not_found`) and the shared 422 `validation_error` envelopes
  (malformed id + invalid limit) with request-id, keeping CI aligned with the exact
  `/api/v1` URLs the `VITE_API_MODE=live` client calls as the repo grows. No
  unchecked CI row remained, so C156 was added under the Never-empty well. Resolves
  the C155 CI live-smoke follow-up. Verified the exact embedded smoke script against
  a real ASGI server (244 probes OK) and with actionlint v1.7.12; YAML parse OK.
  Frontend lint clean/1029 tests/build green and backend pytest (975) green.
  ✅ 2026-11-19 — `f37a8ea`
  Screens version-feed rendering remains a screens follow-up.

- [x] C157 (backend) Authoritative asset lineage feed API:
  `GET /api/v1/lineage/feed?project_id=&limit=` derives a newest-first,
  workspace-wide feed of typed asset relationships from the authoritative
  `ASSET_RELATIONSHIPS` store (no second index) — relationship id, source/target
  asset ids + display names and project id/name joined from the authoritative
  asset/project stores, canonical relationship type and creation time, with a
  deterministic `(created_at, id)` newest-first tie-break and a whole-scope
  `total` counted before the `limit` page; links from soft-deleted/unknown source
  assets are excluded (matching `/lineage/stats`, so the feed total agrees with
  the snapshot) while a soft-deleted/unknown target keeps the link with a stable
  "Unknown asset" name fallback; optional `project_id` scope with shared 404
  `project_not_found` / 422 `validation_error` envelopes. `LineageFeed`/
  `LineageFeedItem` mirrored in `frontend/src/types/lineageFeed.ts` + exported
  from the types index, README endpoint list synced, 11 tests × 2 storage
  backends green (997 passed, contract parity + route-surface guard + tsc clean).
  Mocks/screens/CI wiring of the feed is a follow-up. My owned backend column had
  no unchecked items (only the repo-wide C6 docs pass remains, owned by other
  agents), so C157 was added under the Never-empty well.
  ✅ 2026-11-19 — `07ae5ed`

- [x] C158 (screens) Render the authoritative asset version feed (C153/C155/C156
  follow-up) via `useVersionFeed`: a reusable `VersionFeedPanel` on Home
  (workspace-wide) and project detail (project-scoped) with page-size chips,
  newest-first rows showing asset/project names, version + type badges, creator
  and creation recency, and asset deep links that scope the assets browser to the
  row's project before selecting the asset — with loading/error/missing/empty/
  populated states and every display value derived in tested `versionFeedHelpers`.
  Resolves the C155/C156 screens follow-up. My owned column had no unchecked rows
  (only the repo-wide C6 docs pass remains, owned by other agents), so C158 was
  added under the Never-empty well. ✅ 2026-11-19 — `d6d0933`

- [x] C159 (mocks) Wire the authoritative asset lineage feed API (C157 follow-up)
  end to end: expose `getLineageFeed` / `useLineageFeed` atomically across mockApi
  (newest-first `(created_at, id)` typed-relationship derivation over the
  relationship/asset/project seeds, source-project attribution, soft-deleted/
  unknown-source exclusion, stable "Unknown asset"/"Unknown project" fallbacks
  for missing targets/projects, whole-scope `total` before the `limit` page,
  router-style 422 for a malformed project id or out-of-range limit,
  unknown-project 404 + injectable `lineageFeed` failure), the stable `ApiClient`
  facade, live `httpApiClient` (`GET /lineage/feed?project_id=&limit=`),
  `queryKeys` and `useQueries`, with a shared `lib/lineageFeed`
  derivation/validation helper and populated/empty/error tests; parity guard
  extended to both transports. Resolves the C157 mocks-transport follow-up. My
  owned column had no unchecked rows (only the repo-wide C6 docs pass remains,
  owned by other agents), so C159 was added under the Never-empty well.
  ✅ 2026-11-19 — `42acc47`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C160 (CI) Extend the live-mode HTTP smoke job with the authoritative asset
  lineage feed endpoint from C157/C159
  (`GET /api/v1/lineage/feed?project_id=&limit=`): register one child asset on
  demand with the on-demand asset as its parent so the derived feed has a real
  typed relationship, then probe the feed shape (`items`/`total`/`generated_at`),
  item shapes (relationship id, source/target asset ids + joined display names,
  project id/name, canonical type and created timestamp), newest-first
  `(created_at, id)` ordering, the whole-scope `total` before the `limit` page
  (counters unchanged), the optional `project_id` scope (unknown → shared 404
  `project_not_found`), and the shared 422 `validation_error` envelopes
  (malformed id + invalid limit) with request-id, keeping CI aligned with the
  exact `/api/v1` URLs the `VITE_API_MODE=live` client calls as the repo grows.
  No unchecked CI row remained, so C160 was added under the Never-empty well;
  resolves the C159 CI live-smoke follow-up. Verified the exact embedded smoke
  script against a real ASGI server on a dynamically chosen free port (298
  probes OK) with YAML parse + actionlint v1.7.12 (`-shellcheck=`); frontend
  lint clean/1048 tests/build green and backend pytest (997) green.
  ✅ 2026-11-19 — `e817534`
  Screens lineage-feed rendering remains a screens follow-up.

- [x] C161 (backend) Authoritative organization feed API:
  `GET /api/v1/orgs/feed?limit=` (alias `/organizations/feed`) derives a
  newest-first, workspace-wide feed of organizations from the authoritative
  `ORGANIZATIONS` store (no second index) — organization id/name/slug and
  creation time with member/project activity counts joined from the authoritative
  `MEMBERS` (orphan/malformed `_org_id` excluded) and `PROJECTS` stores, with a
  deterministic `(created_at, org_id)` newest-first tie-break and a whole-scope
  `total` counted before the `limit` page; shared 422 envelope for an invalid
  `limit`, literal paths win over `/orgs/{org_id}`. `OrganizationFeed`/
  `OrganizationFeedItem` mirrored in `frontend/src/types/organizationFeed.ts` +
  exported from the types index, README endpoint list synced, 9 tests × 2 storage
  backends green (1015 passed, contract parity + route-surface guard + tsc clean).
  Mocks/screens/CI wiring of the feed is a follow-up. My owned backend column had
  no unchecked items (only the repo-wide C6 docs pass remains, owned by other
  agents), so C161 was added under the Never-empty well.
  ✅ 2026-11-19 — `194bd45`

- [x] C162 (screens) Render the authoritative asset lineage feed (C157/C159/C160
  follow-up) via `useLineageFeed`: a reusable `LineageFeedPanel` with workspace-wide
  (Projects) and project-scoped (project detail) variants, page-size chips,
  newest-first typed relationship rows showing the source → target asset names,
  joined project name, a relationship-type badge and creation recency, with source
  and (when the target is still live) target deep links that scope the assets
  browser to the row's project before selecting the asset, plus loading/error/
  missing/empty/populated states — every display value derived in tested
  `lineageFeedHelpers`. Resolves the C160 screens follow-up. My owned column had no
  unchecked rows (only the repo-wide C6 docs pass remains, owned by other agents),
  so C162 was added under the Never-empty well.
  ✅ 2026-11-19 — `0ab0bb3`

- [x] C163 (mocks) Wire the authoritative organization feed API (C161
  follow-up) end to end: expose `getOrganizationFeed` / `useOrganizationFeed`
  atomically across mockApi (newest-first `(created_at, id)` organization feed
  with joined member/project activity counts, orphan-member and unknown-org-
  project exclusion, whole-scope `total` before the `limit` page, router-style
  422 for an invalid limit + injectable `organizationFeed` failure), the stable
  `ApiClient` facade, live `httpApiClient` (`GET /orgs/feed?limit=`), `queryKeys`
  and `useQueries`, with a shared `lib/organizationFeed` derivation/validation
  helper and populated/empty/error tests; parity guard extended to both
  transports. Resolves the C161 mocks-transport follow-up. My owned column had
  no unchecked rows, so C163 was added under the Never-empty well.
  ✅ 2026-11-19 — `2b9c330`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C164 (CI) Extend the live-mode HTTP smoke job with the authoritative
  organization feed endpoint from C161/C163 (`GET /api/v1/orgs/feed?limit=`):
  create one organization on demand so the derived feed has a real item, then
  probe the feed shape (`items`/`total`/`generated_at`), derived item shapes
  (org id/name/slug, joined member/project activity counts and created
  timestamp), newest-first `(created_at, org_id)` ordering, the whole-scope
  `total` before the `limit` page, the `limit` page bound (counters unchanged),
  the `/organizations/feed` alias and the shared 422 `validation_error` envelope
  with request-id, keeping CI aligned with the exact `/api/v1` URLs the
  `VITE_API_MODE=live` client calls as the repo grows. No unchecked CI row
  remained (only the repo-wide C6 docs pass remains, owned by other agents), so
  C164 was added under the Never-empty well; resolves the C163 CI live-smoke
  follow-up. Verified the exact embedded smoke script against a real ASGI server
  (264 probes OK, on a dynamically chosen free port because :8000 is held by
  another service) with YAML parse + actionlint v1.7.12 (`-shellcheck=`);
  frontend lint clean/1063 tests/build green and backend pytest (1015) green.
  ✅ 2026-11-19 — `9c27c69`
  Screens organization-feed rendering remains a screens follow-up.

- [x] C165 (backend) Authoritative comment statistics API:
  `GET /api/v1/comments/stats?project_id=` derives comment totals, distinct
  author/project counts, a zero-filled asset/project reference breakdown,
  deterministic per-project (comments, authors) and per-author (comments)
  breakdowns and newest-comment recency from the authoritative `COMMENTS` store
  (no second index), with an optional `project_id` scope (unknown → shared 404
  `project_not_found`, malformed → shared 422 `validation_error`) and a literal
  path registered alongside `/comments/feed`. `CommentStats`/
  `CommentReferenceCount`/`CommentProjectCount`/`CommentAuthorCount`/
  `CommentReference` mirrored in `frontend/src/types/commentStats.ts` + exported
  from the types index, README endpoint list synced, 5 tests × 2 storage
  backends green (1025 passed, contract parity + route-surface guard + tsc
  clean). Mocks/screens/CI wiring of the snapshot is a follow-up. My owned
  backend column had no unchecked items (only the repo-wide C6 docs pass
  remains, owned by other agents), so C165 was added under the Never-empty
  well. ✅ 2026-11-19 — `84d82b3`

- [x] C166 (screens) Render the authoritative organization feed (C161/C163/C164
  follow-up) via `useOrganizationFeed`: a reusable `OrganizationFeedPanel` on the
  Workspaces screen with page-size chips, newest-first rows showing organization
  name/slug, joined member/project activity badges and creation recency, and
  loading/error/missing/empty/populated states — every display value derived in
  tested `organizationFeedHelpers`. Rows stay read-only because there is no
  organization-detail route; no new route was added. Resolves the C164 screens
  follow-up. My owned column had no unchecked rows (only the repo-wide C6 docs
  pass remains, owned by other agents), so C166 was added under the Never-empty
  well. ✅ 2026-11-19 — `b45d06a`

- [x] C167 (mocks) Wire the authoritative comment statistics API (C165
  follow-up) end to end: expose `getCommentStats` / `useCommentStats` atomically
  across mockApi (seed-derived zero-filled asset/project reference buckets,
  per-project comment+author and per-author comment breakdowns sorted by
  descending count then id, distinct totals and newest-comment recency with an
  id tie-break; router-style 422 for a malformed project id, normalized 404 for
  an unknown project + injectable `commentStats` failure), the stable `ApiClient`
  facade, live `httpApiClient` (`GET /comments/stats?project_id=`), `queryKeys`
  and `useQueries`, with a shared `lib/commentStats` derivation/validation
  helper and populated/empty/error seeds; parity guard extended to both
  transports. Resolves the C165 mocks-transport follow-up. My owned column had
  no unchecked rows, so C167 was added under the Never-empty well.
  ✅ 2026-11-19 — `a595e33`
  Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C168 (CI) Extend the live-mode HTTP smoke job with the authoritative
  comment statistics endpoint from C165/C167
  (`GET /api/v1/comments/stats?project_id=`): reuse the comment added in the
  comment-feed probe so the derived snapshot has real counts, then probe the
  zero-filled snapshot shape (`total_comments`, `total_authors`,
  `total_projects`, `by_reference`, `by_project`, `by_author`,
  `newest_comment_at`, `generated_at`) + breakdown shapes and the two canonical
  reference categories (asset/project), the derived shapes (non-zero totals, a
  project reference bucket, per-project/per-author rows and recency), the
  optional `project_id` scope (unknown → shared 404 `project_not_found`,
  malformed → shared 422 `validation_error`) and the request-id header, keeping
  CI aligned with the exact `/api/v1` URLs the `VITE_API_MODE=live` client calls
  as the repo grows. No unchecked CI row remained, so C168 was added under the
  Never-empty well; resolves the C167 CI live-smoke follow-up. Verified the
  exact embedded smoke script against a real ASGI server (272 probes OK, on a
  dynamically chosen free port because :8000 is held by another service) with
  YAML parse + actionlint v1.7.12 (`-shellcheck=`); frontend lint clean/1082
  tests/build green and backend pytest (1025) green.
  ✅ 2026-11-19 — `d924f40`
  Screens comment-stats rendering remains a screens follow-up.

- [x] C169 (backend) Authoritative job event feed API:
  `GET /api/v1/events/feed?project_id=&type=&limit=` derives a newest-first,
  workspace-wide feed of job events from the authoritative `JOB_EVENTS` stream
  (no second index; the same store `/events/stats` aggregates and the SSE/polling
  endpoints read) — each item carries event identity (`job_id`/`seq`/`type`),
  operation and project identity joined from the authoritative `JOBS`/`PROJECTS`
  stores (with an "Unknown project" fallback), all event lifecycle fields
  (status/progress/message/asset_id/error/timestamp), with a deterministic
  `(timestamp, job_id, seq)` newest-first tie-break and a whole-scope `total`
  counted before the `limit` page. Orphan events (missing parent job) are
  excluded, matching the event-stats project-scope join; optional `project_id`
  and `type` filters use shared 404 `project_not_found` / 422
  `validation_error` envelopes and the request-id header. `EventFeed`/
  `EventFeedItem` mirrored in `frontend/src/types/eventFeed.ts` + exported from
  the types index, README endpoint list synced, 14 tests × 2 storage backends
  green (1053 passed, contract parity + route-surface guard + tsc clean).
  Mocks/screens/CI wiring of the feed is a follow-up. My owned backend column
  had no unchecked items (only the repo-wide C6 docs pass remains, owned by
  other agents), so C169 was added under the Never-empty well.
  ✅ 2026-11-19 — `48484b7`

- [x] C170 (screens) Render the authoritative comment statistics (C165/C167/C168
  follow-up) via `useCommentStats`: a reusable `CommentStatsPanel` with
  workspace-wide (Home) and project-scoped (project detail) variants, four stat
  cards, zero-filled asset/project reference and per-project/per-author
  breakdowns, and loading/error/missing/empty/populated states — every display
  value derived in tested `commentStatsHelpers`. Resolves the C168 screens
  follow-up. My owned column had no unchecked rows, so C170 was added under the
  Never-empty well. Verified lint/test (1095)/build green on a clean worktree of
  HEAD + only my changes; the shared working tree carried a sibling agent's
  in-progress, uncommitted event-feed transport work in mocks-owned `src/lib`
  (transient `parity.test.ts` + `eventFeed.test.ts` failures, owner: studio-mocks).
  ✅ 2026-11-19 — `220dbaa`

- [x] C171 (mocks) Wire the authoritative job event feed API (C169 follow-up)
   end to end: expose `getEventFeed` / `useEventFeed` atomically across mockApi
   (newest-first `(timestamp, job_id, seq)` derivation over the same `JOB_EVENTS`
   seeds as `/events/stats`, joined to parent jobs for operation/project identity
   with orphan exclusion, project-name fallback, `project_id`/`type` filters,
   whole-scope `total` before the `limit` page, router-style 422 for a malformed
   project id / unknown event type / invalid limit, unknown-project 404 +
   injectable `eventFeed` failure), the stable `ApiClient` facade, live
   `httpApiClient` (`GET /events/feed?project_id=&type=&limit=`), `queryKeys` and
   `useQueries`, with a shared `lib/eventFeed` derivation/validation helper and
   populated/empty/error tests; parity guard extended to both transports. My
   owned column had no unchecked rows (only the repo-wide C6 docs pass remains,
   owned by other agents), so C171 was added under the Never-empty well.
   ✅ 2026-11-19 — `08acef1`
   Screens rendering + CI live-smoke probe are follow-ups for those agents.

- [x] C172 (CI) Extend the live-mode HTTP smoke job with the authoritative job
  event feed endpoint from C169/C171 (`GET /api/v1/events/feed?project_id=&type=&limit=`):
  reuse the on-demand submitted job (which carries a real JOB_EVENTS stream from
  the log probe) so the derived feed has real items, then probe the feed shape
  (`items`/`total`/`generated_at`), derived item shapes (job/seq/type/operation/project
  identity and joined project name/timestamp), newest-first `(timestamp, job_id, seq)`
  ordering, the whole-scope `total` before the `limit` page (counters unchanged), the
  `type` filter, the optional `project_id` scope and the shared 404 `project_not_found`
  / 422 `validation_error` envelopes (malformed id + invalid type + invalid limit)
  with request-id, keeping CI aligned with the exact `/api/v1` URLs the
  `VITE_API_MODE=live` client calls as the repo grows. No unchecked CI row remained,
  so C172 was added under the Never-empty well. Resolves the C171 CI live-smoke
  follow-up. Verified the exact embedded smoke script against a real ASGI server
  (333 checks OK, dynamically chosen free port) with YAML parse + actionlint
  v1.7.12 (`-shellcheck=`); frontend lint/1115 tests/build green and backend
  pytest (1053) green. Screens event-feed rendering remains a screens follow-up.
- 2026-11-19 — `e510c4f` — C173 (backend): added authoritative `GET /api/v1/extensions/feed?type=&status=&limit=` — a newest-first workspace feed of installed extensions derived fresh from the authoritative `EXTENSIONS` store (no second index; the same store `/extensions` lists and `/extensions/stats` aggregates), with manifest identity/display fields (id/name/version/publisher/type), lifecycle status, trust flags and install time, the deterministic uuid5 extension id matching installation, a `(installed_at, extension_id)` tie-break and a whole-scope `total` before the `limit` page; optional `type`/`status` filters use the shared 422 envelope and the literal feed path is registered before `/extensions/{extension_id}`. `ExtensionFeed`/`ExtensionFeedItem` mirrored in `frontend/src/types/extensionFeed.ts` + exported from the types index, README endpoint list synced, 12 tests × 2 storage backends green (1077 passed, contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring of the feed is a follow-up. My owned backend column had no unchecked items, so C173 was added under the Never-empty well.
  ✅ 2026-11-19 — `3da13a8`

- [x] C173 (backend) Authoritative extension installation feed API:
  `GET /api/v1/extensions/feed?type=&status=&limit=` derives a newest-first,
  workspace-wide feed of installed extensions from the authoritative `EXTENSIONS`
  collection (no second index; the same store `/extensions` lists and
  `/extensions/stats` aggregates) — manifest identity/display fields
  (name/version/publisher/type), lifecycle status, trust flags and recorded
  install time, with the deterministic uuid5 extension id matching installation,
  a `(installed_at, extension_id)` newest-first tie-break and a whole-scope
  `total` counted before the `limit` page; optional `type`/`status` filters use
  the shared 422 envelope and the literal feed path is registered before
  `/extensions/{extension_id}`. `ExtensionFeed`/`ExtensionFeedItem` mirrored in
  `frontend/src/types/extensionFeed.ts` + exported from the types index, README
  endpoint list synced, 12 tests × 2 storage backends green (1077 passed,
  contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring of
  the feed is a follow-up. My owned backend column had no unchecked items (only
  the repo-wide C6 docs pass remains, owned by other agents), so C173 was added
  under the Never-empty well.
  ✅ 2026-11-19 — `e510c4f`

- [x] C174 (screens) Render the authoritative job event feed (C169/C171/C172
  follow-up) via `useEventFeed`: a reusable `EventFeedPanel` on the Jobs screen
  (workspace-wide) and project detail (project-scoped) with event-type and
  page-size filter chips, newest-first rows showing event-type and status badges,
  prettified operation label, short job id/sequence, joined project name, message/
  error excerpt and event recency, and Open buttons deep-linking to the existing
  project-detail route — with loading/error/missing/empty/populated states and
  every display value derived in tested `eventFeedHelpers`. Resolves the C172
  screens follow-up. My owned column had no unchecked rows (only the repo-wide C6
  docs pass remains, owned by other agents), so C174 was added under the
  Never-empty well. Lint clean, 1132 tests, build green.
  ✅ 2026-11-19 — `4f4d25e`

- [x] C175 (mocks) Wire the authoritative extension installation feed API (C173
   follow-up) end to end: expose `getExtensionFeed` / `useExtensionFeed`
   atomically across mockApi (newest-first `(installed_at, extension_id)`
   derivation over the `EXTENSIONS` store with the backend-matching deterministic
   uuid5 extension id, manifest display fields and trust flags, `type`/`status`
   filters, whole-scope `total` before the `limit` page, no-install-time skip,
   router-style 422 for an invalid type/status/limit + injectable `extensionFeed`
   failure), the stable `ApiClient` facade, live `httpApiClient`
   (`GET /extensions/feed?type=&status=&limit=`), `queryKeys` and `useQueries`,
   with a shared `lib/extensionFeed` derivation/validation helper and
   populated/empty/error seeds; parity guard extended to both transports. My
   owned column had no unchecked rows (only the repo-wide C6 docs pass remains,
   owned by other agents), so C175 was added under the Never-empty well.
   ✅ 2026-11-19 — `60a203a`
   Screens rendering + CI live-smoke probe are follow-ups for those agents.

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
- 2026-11-17 — `9f74936` — C18: authoritative `GET /projects/{id}/audit` feed (asset/publish/job events derived from authoritative stores; kind + time bounds + limit; mirrored TS contracts), 14 new tests green on memory+sqlite (507 passed).
- 2026-11-17 — `7a6cd7d` — C19: added a project storage card on detail (useStorageStats hook, loading/error/empty/populated states, storageHelpers format/usage derivation + 9 unit tests); lint/test (152)/build green. Added C20 for mocks+screens to wire the C18 audit API end to end.
- 2026-11-17 — `5b7a2d4` — C20 (mocks): added `getProjectAudit`/`useProjectAudit` atomically across mockApi, ApiClient, live httpApiClient (404→undefined, other errors normalized), queryKeys and useQueries; shared audit derivation/filter helper + asset/job-derived seeds keep mock/live parity with populated/empty/error states; 5 new audit-helper + mock + live + key tests and parity guard extended; lint/test (165)/build green. Screen feed rendering split to C20b.
- 2026-11-17 — `3f960e4` — C21: added a `Validate workflows` CI job running pinned actionlint (`go run .../actionlint@v1.7.12`) over `.github/workflows/*.yml` on every push/PR (10-min timeout); validated the edited workflow with installed actionlint and the exact pinned command. Frontend lint/test (165)/build and backend pytest (507) green.
- 2026-11-17 — `3b9c6d1` — C22: added authoritative `GET /api/v1/search` (cross-domain project/asset/conversation ranking derived from the document stores, `kind`/`limit` filters, shared 422 validation envelope, blank-query/no-match handling, deleted-asset skipping, stable tie-breaks), contracts mirrored in `frontend/src/types/search.ts`, and 7 tests × 2 storage backends; backend pytest 521 passed (contract parity green). Mocks/screens transport wiring is a follow-up.
- 2026-11-17 — `4988d27` — C20b: replaced the derived-only audit card on project detail with a `useProjectAudit`-backed `AuditFeedPanel` (kind filters, loading/error/missing/empty/populated states, tone/relative-time rows derived in `auditFeedHelpers`); `LineageGraph` is now graph-only and the retired derived audit helpers/tests were removed; lint/test (170)/build green.
- 2026-11-17 — `f51189e` — C23 (mocks): wired authoritative cross-domain search end to end — `ApiClient.search`/`useSearch` across mockApi (seed-derived ranking + router-style 422 + injectable failure), live `httpApiClient` (`GET /search?q=&kind=&limit=`), `queryKeys` and `useQueries` (blank-query gated), with a shared `lib/search` derivation helper and populated/empty/error seeds; 19 new tests across derivation/mock/live/key suites and the parity guard extended; lint/test (189)/build green. Screens quick-finder `useSearch` wiring remains a screens follow-up.
- 2026-11-17 — `941a8ec` — C24 (CI): added a `live-smoke` job that boots the real ASGI server (`uvicorn`, in-memory store) and probes the exact `/api/v1` URLs the `VITE_API_MODE=live` frontend client uses (health + request-id, projects, providers, capabilities, search) plus the shared 422 error envelope; 10-min timeout, pinned Actions, `if: always()` teardown. Verified locally (all 9 probes OK) and with pinned actionlint; all suites green (lint, 189 FE tests, build, 521 BE tests).
- 2026-11-17 — `26d6e99` — C25 (backend): added authoritative `GET /api/v1/dashboard` deriving entity counts, zero-filled job-status/asset-type breakdowns and newest jobs/assets from the stores (deleted assets excluded); `recent_limit` bounds + shared 422 envelope, `DashboardCounts`/`DashboardSummary` mirrored in TS, 5 tests × 2 backends green (531 passed, 98% coverage). Mocks/screens wiring of the snapshot is a follow-up.
- 2026-11-17 — `27907a9` — C26 (screens): quick finder now renders ranked `useSearch` cross-domain results alongside screens, deep-linking projects/assets/conversations with hint/searching/error/empty/populated states; display + navigation mapping derived in tested `quickFinderHelpers`; lint/test (200)/build green. C25 `useDashboard` wiring deferred to mocks transport.
- 2026-11-17 — `b0f0fd7` — C27 (mocks): wired the authoritative dashboard snapshot end to end — `ApiClient.getDashboard`/`useDashboard` across mockApi (seed-derived counts, zero-filled breakdowns, newest-first recency, deleted-asset exclusion, router-style 422 + injectable `dashboard` failure), the stable facade, live `httpApiClient` (`GET /dashboard?recent_limit=`), `queryKeys` and `useQueries`, with a shared `lib/dashboard` derivation helper and populated/empty/error tests; fixed the parity harness to pass derived 422 envelopes through unwrapped and extended parity to both dashboard queries; lint/test (212)/build green. Screens `useDashboard` rendering remains a screens follow-up.
- 2026-11-17 — `c177c6b` — C28 (CI): extended the live-mode HTTP smoke job to probe the newly live-wired endpoints the `VITE_API_MODE=live` client calls — `GET /dashboard` (snapshot + counts shape, `recent_limit=1`, `recent_limit=0` 422 envelope) and `GET /projects/{id}/audit` (with on-demand project creation since the in-memory store starts empty). Verified locally against a real `uvicorn` server (all 14 probes OK) and with pinned actionlint; frontend lint/test (212)/build and backend pytest (531) green.
- 2026-11-17 — `b69a42f` — C29 (backend): added authoritative cross-project `GET /api/v1/activity` (asset/publish/job/comment events with actor + project context, derived from stores; project/kind/limit filters, shared 404/422 envelopes), contracts mirrored in TS, README endpoint list synced; 10 new tests green on memory+sqlite (541 passed), tsc --noEmit clean. Mocks/screens/CI transport + rendering of the feed is a follow-up.
- 2026-11-17 — `759c201` — C30 (screens): added a `useDashboard`-backed Workspace snapshot card on Home with authoritative counts, zero-filled job-status/asset-type breakdowns, recent jobs/assets and generated-at footer; all display values derived in tested `dashboardHelpers`; loading/error/missing/empty/populated states; lint/test (223)/build green. Resolves the C26 dashboard-wiring follow-up now that C27 shipped the transport.
- 2026-11-17 — `80ba424` — C31 (mocks): wired the authoritative workspace activity feed end to end — `ApiClient.getActivity`/`useActivity` across mockApi (seed-derived asset/publish/job/comment events, actor + project context, project/kind/limit filters, router-style 422 + unknown-project 404 + injectable `activity` failure), the stable facade, live `httpApiClient` (`GET /activity?project_id=&kind=&limit=`), `queryKeys` and `useQueries`, with a shared `lib/activity` derivation/validation helper; parity guard extended to populated/empty/404/422 cases; lint/test (238)/build green. Screens feed rendering + CI live-smoke probe remain follow-ups.
- 2026-11-17 — `1419b48` — C32 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/activity` feed (shape + `kind`/`limit` filters + shared 422 validation and 404 `project_not_found` envelopes), the CI follow-up from C29/C31. Added C32 as a new CI-owned row under the Never-empty well since no unchecked CI item remained. Verified the full embedded smoke script against a real uvicorn server (18/18 probes OK) and with pinned actionlint; frontend lint/test (238)/build and backend pytest (541) green.
- 2026-11-17 — `7be2a4f` — C33 (backend): added authoritative `GET /api/v1/tags` — a most-used-first, deduplicated asset tag facet index (count of non-deleted assets per tag) derived from the asset store with no second index; `project_id` scoping, case-insensitive `prefix` autocomplete filter and `limit` bounds with shared 404/422 envelopes and deterministic cross-backend ordering. `TagFacet`/`TagIndex` mirrored in `frontend/src/types/tags.ts`; 6 tests × 2 backends green (553 passed), backend README endpoint list synced, tsc --noEmit clean. Mocks/screens/CI wiring of the index is a follow-up for those agents.
- 2026-11-19 — `4f2f6d9` — C34 (backend): added authoritative `GET /api/v1/assets/{id}/impact` downstream impact API — BFS transitive descendants from the relationship store with depth labels, cycle safety, deleted-asset exclusion, max_depth bounds (1..20), shared 404/422 envelopes and deterministic cross-backend order; `AssetImpact`/`ImpactNode` mirrored in TS; 6 tests × 2 backends green (565 passed), tsc --noEmit clean. Mocks/screens/CI transport/rendering/smoke wiring of the endpoint is a follow-up for those agents.
- 2026-11-19 — `7ef46c8` — C35 (screens): Home now renders the authoritative `useActivity` workspace feed with kind/limit filters, all five UI states, project-detail deep links and tested `activityHelpers`; lint clean, 245 tests, build green.
- 2026-11-19 — `cfcdab6` — C36/C37 (mocks): wired the authoritative tag-facets (C33) and downstream impact (C34) APIs end to end — `getTags`/`useTags` and `getAssetImpact`/`useAssetImpact` across mockApi, the stable facade, live httpApiClient, queryKeys and useQueries, with shared `lib/tags` + `lib/impact` derivation/validation helpers, populated/empty/404/422 injection tests and parity extended to both transports; lint clean, 265 tests, build green. Screens rendering + CI smoke probes remain follow-ups.
- 2026-11-19 — `85eecce` — C38 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/tags` (index shape, `prefix` filter, `limit` 422 + unknown-project `project_not_found` 404 envelopes) and `GET /api/v1/assets/{id}/impact` (derived shape, `asset_not_found` 404 + `max_depth` 422 envelopes), registering one tagged asset on demand so both derived 200 shapes are exercised — the CI follow-up from C33/C34 and C36/C37. No unchecked CI row remained, so C38 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (28/28 probes OK) and with pinned actionlint; frontend lint/test (265)/build and backend pytest (565) green. README CI endpoint list is a docs-accuracy follow-up (C6).
- 2026-11-19 — `1d4c9b6` — C39 (mocks): extended injectable error-state fakes to every remaining mock query (project detail/recent/by-project, asset detail/templates, job/provider detail, operations, capabilities, single conversation, auth, presence, comments, storage, extensions), documented the full domain list, and added a table-driven failure+recovery test across all 18 newly guarded queries plus wildcard coverage; lint clean, 266 tests, build green.
- 2026-11-19 — `c14da59` — C40 (backend): added authoritative `GET /api/v1/jobs/stats` deriving zero-filled status counts, per-operation totals/outcomes, terminal success rate, in-flight/completed counts and mean duration from the job store (optional `project_id` scope, shared 404/422 envelopes); contracts mirrored in `frontend/src/types/jobStats.ts`, 5 tests × 2 backends green (575 passed). Mocks/screens/CI wiring is a follow-up.
- 2026-11-19 — `75242d7` — C41 (screens): the Assets browser now renders the authoritative `useTags` facet index with prefix autocomplete, count chips, project scoping and click-to-filter on asset search; all five UI states and display values derived in tested `tagHelpers`; lint clean, 279 tests, build green.
- 2026-11-19 — `75242d7` — C42 (screens): asset detail now renders authoritative downstream impact via `useAssetImpact` with depth chips, name-resolved descendant rows that select the asset deep link, and all five UI states with display values derived in tested `impactHelpers`; lint clean, 279 tests, build green.
- 2026-11-19 — `caa18df` — C43 (mocks): wired the authoritative job execution stats API (C40 follow-up) end to end — `getJobStats`/`useJobStats` across mockApi (seed-derived zero-filled status counts, per-operation totals/outcomes, terminal-only success rate, in-flight/completed counts, mean duration; router-style 422 for malformed project id + unknown-project 404 + injectable `jobStats` failure), the stable facade, live `httpApiClient` (`GET /jobs/stats?project_id=`), `queryKeys` and `useQueries`, with a shared `lib/jobStats` derivation/validation helper; parity guard extended to both transports; lint clean, 294 tests, build green. Screens rendering + CI live-smoke probe are follow-ups.
- 2026-11-19 — `2f4cfa0` — C44 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/jobs/stats` (zero-filled snapshot + breakdown shapes, optional `project_id` scope, shared 404 `project_not_found` + 422 `validation_error` envelopes with request-id) — the CI follow-up from C40/C43. No unchecked CI row remained, so C44 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (31/31 probes OK) and with pinned actionlint; frontend lint/test (294)/build and backend pytest (575) green. Screens job-stats rendering remains a screens follow-up.
- 2026-11-19 — `60e1404` — C45 (backend): added authoritative `GET /api/v1/conversations/stats` deriving zero-filled role/status message breakdowns, totals, average messages per conversation and last activity from the conversation/message stores (optional `project_id` scope, shared 404/422 envelopes); contracts mirrored in `frontend/src/types/conversationStats.ts` and exported from the types index, 5 tests × 2 backends green (585 passed), tsc --noEmit clean. Mocks/screens/CI wiring is a follow-up. My owned backend column had no unchecked items, so C45 was added under the Never-empty well.
- 2026-11-19 — `453f3c9` — C46 (screens): rendered authoritative `useJobStats` metrics on the Jobs screen (workspace-wide) and project detail (project-scoped) with a reusable `JobStatsPanel` — five stat cards, zero-filled status/operation breakdown bars, all five UI states, and every display value derived in tested `jobStatsHelpers`; lint clean, 307 tests, build green. Resolves the C43/C44 screens follow-up; C45 conversation stats remains a mocks transport follow-up.
- 2026-11-19 — `662d88b` — C47 (mocks): wired the authoritative conversation statistics API (C45 follow-up) end to end — `getConversationStats`/`useConversationStats` across mockApi (seed-derived zero-filled role/status breakdowns, totals, 3-decimal average + recency; router-style 422 + unknown-project 404 + injectable `conversationStats` failure), the stable facade, live `httpApiClient` (`GET /conversations/stats?project_id=`), `queryKeys` and `useQueries`, with a shared `lib/conversationStats` helper; parity guard extended to both transports; lint clean, 325 tests, build green. Screens rendering + CI live-smoke probe are follow-ups.
- 2026-11-19 — `b5e1a75` — C48 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/conversations/stats` (zero-filled role/status snapshot + breakdown shapes, optional `project_id` scope, shared 404 `project_not_found` + 422 `validation_error` envelopes with request-id) — the CI follow-up from C45/C47. No unchecked CI row remained, so C48 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (36/36 probes OK) and with pinned actionlint; frontend lint/test (325)/build and backend pytest (585) green.
- 2026-11-19 — `b98e308` — C49 (backend): added authoritative `GET /api/v1/assets/stats` deriving zero-filled asset type/status breakdowns, total count, stored bytes, version revisions and newest-asset recency from the asset store (deleted excluded, optional `project_id` scope, shared 404/422 envelopes); contracts mirrored in `frontend/src/types/assetStats.ts` + exported from the types index, README endpoint list synced, 6 tests × 2 backends green (597 passed), tsc --noEmit clean. Mocks/screens/CI wiring is a follow-up. My owned backend column had no unchecked items, so C49 was added under the Never-empty well.
- 2026-11-19 — `6651fcb` — C50 (screens): rendered authoritative `useConversationStats` metrics with a reusable `ConversationStatsPanel` — workspace-wide on Home, project-scoped on Chat and project detail — with four stat cards, zero-filled role/status breakdown bars, all five UI states, and every display value derived in tested `conversationStatsHelpers`; lint clean, 337 tests, build green. Resolves the C45/C47 screens follow-up; C49 asset stats remains a mocks transport follow-up. My owned column had no unchecked rows, so C50 was added under the Never-empty well.
- 2026-11-19 — `21c2252` — C51 (mocks): wired the authoritative asset inventory statistics API (C49 follow-up) end to end — `getAssetStats`/`useAssetStats` atomically across mockApi, the stable `ApiClient` facade, live `httpApiClient` (`GET /assets/stats?project_id=`), `queryKeys` and `useQueries`, with a shared `lib/assetStats` derivation/validation helper and populated/empty/error seeds; parity guard extended to both transports; lint clean, 354 tests, build green. Resolves the C49 mocks-transport follow-up; screens rendering + CI live-smoke probe remain follow-ups. My owned column had no unchecked rows, so C51 was added under the Never-empty well.
- 2026-11-19 — `66394c4` — C52 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/assets/stats` (zero-filled snapshot + breakdown shapes, optional `project_id` scope, shared 404 `project_not_found` + 422 `validation_error` envelopes with request-id) — the CI follow-up from C49/C51. No unchecked CI row remained, so C52 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (41/41 probes OK) and with actionlint v1.7.12 + YAML parse; frontend lint/test (354)/build and backend pytest (597) green. Screens asset-stats rendering remains a screens follow-up.
- 2026-11-19 — `be5b737` — C53 (backend): added authoritative `GET /api/v1/projects/stats?org_id=` deriving zero-filled active/archived lifecycle counts, cross-domain totals, per-project averages and newest-project recency from the stores (deleted assets excluded, optional org scope, shared 422 envelope); `ProjectLifecycle`/`ProjectLifecycleCount`/`ProjectStats` mirrored in `frontend/src/types/projectStats.ts` + exported from the index, README endpoint list synced, 6 tests × 2 backends green (609 passed, contract parity included). Mocks/screens/CI wiring of the snapshot is a follow-up. My owned backend column had no unchecked items, so C53 was added under the Never-empty well.
- 2026-11-19 — `62775a5` — C54 (screens): rendered the authoritative asset inventory stats via a reusable `AssetStatsPanel` — workspace-wide on Home and project-scoped on the Assets browser and project detail — with four stat cards, zero-filled type/status breakdowns, all five UI states, and every display value derived in tested `assetStatsHelpers`; resolves the C49/C51/C52 screens follow-up. My owned column had no unchecked rows, so C54 was added under the Never-empty well; lint clean, 367 tests, build green.
- 2026-11-19 — `7d08eaf` — C55 (mocks): wired the authoritative project portfolio stats API (C53 follow-up) end to end — `getProjectStats`/`useProjectStats` across mockApi (seed-derived zero-filled lifecycle counts, org-scoped cross-domain totals, 3-decimal averages, newest-project recency with id tie-break, deleted-asset exclusion; 422 for malformed org id + zero-filled unknown org + injectable `projectStats` failure), the stable facade, live `httpApiClient` (`GET /projects/stats?org_id=`), `queryKeys` and `useQueries`, with a shared `lib/projectStats` helper; parity guard extended to both transports; lint clean, 383 tests, build green. Screens rendering + CI live-smoke probe are follow-ups.
- 2026-11-19 — `b8e2007` — C56 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/projects/stats` (zero-filled snapshot + lifecycle breakdown shapes, optional `org_id` scope with an unknown-but-valid org yielding a zero-filled 200, shared 422 `validation_error` envelope with request-id) — the CI follow-up from C53/C55. No unchecked CI row remained, so C56 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (45/45 probes OK) and with YAML parse + actionlint v1.7.12; frontend lint/test (383)/build and backend pytest (609) green. Screens project-stats rendering remains a screens follow-up.
- 2026-11-19 — `b66143a` — C57 (backend): added authoritative `GET /api/v1/providers/stats?location=&status=` deriving zero-filled status/location breakdowns, capability/operation coverage (per-operation provider + available counts) from the provider store with optional filters (invalid values → shared 422); `ProviderStats` + 3 nested contracts mirrored in TS, README synced, 6 tests × 2 backends green (621 passed, contract parity + tsc clean). Mocks/screens/CI wiring is a follow-up. My backend column had no unchecked items, so C57 was added under the Never-empty well.
- 2026-11-19 — `4088ea4` — C58 (screens): rendered the authoritative project portfolio stats via a reusable `ProjectStatsPanel` — workspace-wide on Home/Projects and org-scoped on Workspaces — with four stat cards, zero-filled lifecycle breakdown, cross-domain totals and per-project averages, all five UI states, and every display value derived in tested `projectStatsHelpers`; resolves the C53/C55/C56 screens follow-up. Lint clean, 394 tests, build green. My owned column had no unchecked rows, so C58 was added under the Never-empty well.
- 2026-11-19 — `9eaf9a3` — C59 (mocks): wired the authoritative provider fleet stats API (C57 follow-up) end to end — `getProviderStats`/`useProviderStats` atomically across mockApi, the stable facade, live `httpApiClient` (`GET /providers/stats?location=&status=`), `queryKeys` and `useQueries`, with a shared `lib/providerStats` derivation/validation helper; parity guard extended to both transports; injectable `providerStats` error domain documented + covered; lint clean, 412 tests, build green. Screens rendering + CI live-smoke probe are follow-ups for those agents. My owned column had no unchecked rows, so C59 was added under the Never-empty well.
- 2026-11-19 — `1beae67` — C60 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/providers/stats` (zero-filled snapshot + status/location breakdown shapes, `location`/`status` filters, shared 422 `validation_error` envelope with request-id) — the CI follow-up from C57/C59. No unchecked CI row remained, so C60 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (50/50 probes OK) with YAML parse + actionlint v1.7.12; frontend lint/test (412)/build and backend pytest (621) green. Screens provider-stats rendering remains a screens follow-up.
- 2026-11-19 — `9eaec7c` — C61 (backend): added authoritative `GET /api/v1/extensions/stats?type=&status=` deriving zero-filled registry type/status breakdowns, trust flags and permission/capability coverage from the authoritative extension stores (no second index), with independent `type`/`status` filters and a shared 422 envelope; `ExtensionStats` + 3 nested contracts mirrored in TS, README synced, 7 tests × 2 backends green (635 passed, contract parity + tsc clean). Mocks/screens/CI wiring is a follow-up. My owned backend column had no unchecked items, so C61 was added under the Never-empty well.
- 2026-11-19 — `9a62ea9` — C62 (screens): rendered the authoritative provider fleet stats via a reusable `ProviderStatsPanel` on the Providers screen — location/status filters wired from the existing selects, four stat cards, zero-filled status/location breakdowns and per-operation availability coverage, all five UI states, and every display value derived in tested `providerStatsHelpers`; resolves the C57/C59/C60 screens follow-up. Lint clean, 425 tests, build green. My owned column had no unchecked rows, so C62 was added under the Never-empty well.
- 2026-11-19 — `8b3cf2c` — C63 (mocks): wired the C61 extension stats API end to end — `getExtensionStats`/`useExtensionStats` atomically across mockApi, the stable facade, live `httpApiClient` (`GET /extensions/stats?type=&status=`), `queryKeys` and `useQueries`, with a shared `lib/extensionStats` seed-derivation/validation helper (zero-filled type/status breakdowns, trust flags, deterministic permission coverage, router-style 422), injectable `extensionStats` failure domain and parity guard across both transports; lint clean, 442 tests, build green. Screens rendering + CI live-smoke probe are follow-ups for those agents. My owned column had no unchecked rows, so C63 was added under the Never-empty well.
- 2026-11-19 — `562ab49` — C64 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/extensions/stats` (zero-filled snapshot + type/status/permission breakdown shapes, independent `type`/`status` filters, shared 422 `validation_error` envelope with request-id) — the CI follow-up from C61/C63. No unchecked CI row remained, so C64 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (55/55 probes OK) with YAML parse + actionlint v1.7.12; frontend lint/test (442)/build and backend pytest (635) green. Screens extension-stats rendering remains a screens follow-up.
- 2026-11-19 — `5bc5f46` — C65 (backend): added authoritative `GET /api/v1/operations/stats` deriving catalog size, streaming/provider coverage, total settings, unique output types and deterministic asset-type input/output breakdowns from the authoritative operation catalog (no second index); `OperationStats`/`OperationTypeCount` mirrored in TS, README synced, 7 tests × 2 backends green (647 passed, contract parity + route-surface guard clean). Mocks/screens/CI wiring is a follow-up. My owned backend column had no unchecked items, so C65 was added under the Never-empty well.
- 2026-11-19 — `d81bc55` — C66 (screens): rendered authoritative extension registry/installation stats via `useExtensionStats` — a reusable `ExtensionStatsPanel` on the Extensions screen with type/status filters, four stat cards, zero-filled type/status distributions, trust flags and permission coverage, and all five UI states; display values derived in tested `extensionStatsHelpers`. Resolves the C61/C63/C64 screens follow-up. Lint clean, 459 tests, build green. My owned column had no unchecked rows, so C66 was added under the Never-empty well.
- 2026-11-19 — `e9aebe3` — C67 (mocks): wired the C65 operations stats API end to end — `getOperationStats`/`useOperationStats` atomically across mockApi (seed-derived catalog coverage + deterministic asset-type input/output breakdowns, injectable `operationStats` failure), the stable facade, live `httpApiClient` (`GET /operations/stats`, no query params), `queryKeys` and `useQueries`, with a shared `lib/operationStats` helper; parity guard extended to both transports; lint clean, 466 tests, build green. Screens rendering + CI live-smoke probe are follow-ups. My owned column had no unchecked rows, so C67 was added under the Never-empty well.
- 2026-11-19 — `da42ae8` — C68 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/operations/stats` (catalog snapshot + asset-type breakdown shapes, provider/type split invariants, request-id header) — the CI follow-up from C65/C67. No unchecked CI row remained, so C68 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (59/59 executed probes OK) with actionlint v1.7.12 + YAML parse; frontend lint/test (466)/build and backend pytest (647) green. Screens operation-stats rendering remains a screens follow-up.
- 2026-11-19 — `e1a7531` — C69 (backend): added authoritative `GET /api/v1/orgs/stats?org_id=` (alias `/organizations/stats`) deriving organization/member/user totals, zero-filled role breakdowns, per-organization member counts, average and recency from the auth store, with optional org scope (unknown org → zero-filled 200, malformed id → shared 422); contracts mirrored in TS, README synced, 7 tests × 2 backends green (661 passed), tsc/contract parity/route guard clean. Mocks/screens/CI wiring is a follow-up. My owned backend column had no unchecked items, so C69 was added under the Never-empty well.
- 2026-11-19 — `9395f52` — C70 (screens): rendered authoritative operation catalog stats via `useOperationStats` — an `OperationStatsPanel` on the Jobs screen with five stat cards, provider-binding coverage, zero-filled deterministic input/output asset-type breakdowns, and all five UI states; every display value derived in tested `operationStatsHelpers`; resolves the C68 screens follow-up. Lint clean, 478 tests, build green. My owned column had no unchecked rows, so C70 was added under the Never-empty well.
- 2026-11-19 — `8d23794` — C71 (mocks): wired the C69 organization stats API end to end — `getOrganizationStats`/`useOrganizationStats` across mockApi (seed-derived zero-filled role/per-org breakdowns, global user total, 3-decimal average + recency, 422 for a malformed org id + zero-filled unknown org + injectable `organizationStats` failure), the stable facade, live `httpApiClient` (`GET /orgs/stats?org_id=`), queryKeys and useQueries, with a shared `lib/organizationStats` helper and new user/member seeds; parity guard extended to both transports; lint clean, 495 tests, build green. Screens rendering + CI live-smoke probe are follow-ups. My owned column had no unchecked rows, so C71 was added under the Never-empty well.
- 2026-11-19 — `100dd39` — C72 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/orgs/stats` (zero-filled snapshot + role/per-org breakdown shapes, optional `org_id` scope where an unknown-but-valid org yields a zero-filled 200, shared 422 `validation_error` envelope with request-id) — the CI follow-up from C69/C71. No unchecked CI row remained, so C72 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (63/63 probes OK) with YAML parse + actionlint v1.7.12; frontend lint/test (495)/build and backend pytest (661) green. Screens organization-stats rendering remains a screens follow-up.
- 2026-11-19 — `459314a` — C73 (backend): added authoritative `GET /api/v1/pipelines/stats?project_id=` deriving zero-filled per-kind (training/shot/splat) chain/job/asset breakdowns, per-project chain counts, totals and newest-chain recency from the three chain collections (no second index), with an optional project scope (unknown → shared 404 `project_not_found`, malformed → shared 422) and deterministic cross-backend ordering; `PipelineKind`/`PipelineKindStats`/`PipelineProjectCount`/`PipelineStats` mirrored in `frontend/src/types/pipelineStats.ts`, README endpoint list synced, 5 tests × 2 backends green (671 passed, contract parity + route guard clean), frontend tsc clean. Mocks/screens/CI wiring of the snapshot is a follow-up. My owned backend column had no unchecked items, so C73 was added under the Never-empty well.
- 2026-11-19 — `82c5f45` — C74 (screens): rendered the authoritative organization/membership stats (C69/C71/C72 follow-up) via `useOrganizationStats` — a reusable `OrganizationStatsPanel` on Home (workspace-wide) and Workspaces (org-scoped) with four stat cards, zero-filled member-role and per-org breakdowns, friendly org names and all five UI states; every display value derived in tested `organizationStatsHelpers`; lint clean, 507 tests, build green. My owned column had no unchecked rows, so C74 was added under the Never-empty well.
- 2026-11-19 — `70bd66b` — C75 (mocks): wired the C73 production-pipeline stats API end to end — `getPipelineStats`/`usePipelineStats` atomically across mockApi (seed-derived zero-filled per-kind/per-project breakdowns, totals + recency, router-style 422/unknown-project 404 + injectable `pipelineStats` failure), the stable facade, live `httpApiClient` (`GET /pipelines/stats?project_id=`), queryKeys and useQueries, with a shared `lib/pipelineStats` helper + chain seeds; parity guard extended to both transports; lint clean, 521 tests, build green. Screens rendering + CI live-smoke probe are follow-ups. My owned column had no unchecked rows, so C75 was added under the Never-empty well.
- 2026-11-19 — `e779f84` — C76 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/pipelines/stats` (zero-filled snapshot + per-kind/per-project breakdown shapes, the three canonical pipeline kinds, the optional `project_id` scope where an unknown project yields a shared 404, and the shared 422 `validation_error` envelope with request-id) — the CI follow-up from C73/C75. No unchecked CI row remained, so C76 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (69/69 probes OK) with YAML parse + actionlint v1.7.12; frontend lint/test (521)/build and backend pytest (671) green. Screens pipeline-stats rendering remains a screens follow-up.
- 2026-11-19 — `d8f08a0` — C77 (backend): added authoritative `GET /api/v1/lineage/stats?project_id=` deriving zero-filled relationship-type breakdowns (derived_from/variant_of/uses_input/related_to/duplicate_of), per-project link counts, distinct live-asset count and newest-link recency from the authoritative `ASSET_RELATIONSHIPS` store (joined to assets for project attribution; links from soft-deleted/unknown source assets excluded, no second index), with an optional `project_id` scope (unknown → shared 404 `project_not_found`, malformed → shared 422) and deterministic cross-backend ordering; `LineageStats`/`LineageTypeCount`/`LineageProjectCount` mirrored in `frontend/src/types/lineageStats.ts`, README endpoint list synced, 6 tests × 2 backends green (683 passed, contract parity + route-surface guard + frontend tsc clean). Mocks/screens/CI wiring of the snapshot is a follow-up. My owned backend column had no unchecked items, so C77 was added under the Never-empty well.
- 2026-11-19 — `c8409f4` — C78 (screens): rendered authoritative production-pipeline stats via a reusable `PipelineStatsPanel` — workspace-wide on Projects and project-scoped on project detail — with three stat cards, zero-filled training/shot/splat chain/job/asset breakdowns, per-project chain counts and a recency footer, all five UI states, and every display value derived in tested `pipelineStatsHelpers`; resolves the C76 screens follow-up. Lint clean, 534 tests, build green. My owned column had no unchecked rows, so C78 was added under the Never-empty well.
- 2026-11-19 — `fec5c4f` — C79 (mocks): wired the C77 authoritative asset lineage stats API end to end — `getLineageStats`/`useLineageStats` atomically across mockApi (relationship + asset seed derivation with zero-filled type buckets, per-project link counts, distinct live-asset count, recency, deleted/unknown-source exclusion, router-style 422/unknown-project 404 + injectable `lineageStats` failure), the stable facade, live `httpApiClient` (`GET /lineage/stats?project_id=`), queryKeys and useQueries, with a shared `lib/lineageStats` helper + relationship seeds; parity guard extended to both transports. Resolves the C77 mocks-transport follow-up. Lint clean, 548 tests, build green. My owned column had no unchecked rows, so C79 was added under the Never-empty well. Screens rendering + CI live-smoke probe remain follow-ups.
- 2026-11-19 — `4011bd5` — C80 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/lineage/stats` (zero-filled snapshot + by_type/by_project breakdown shapes, the five canonical relationship kinds, the optional `project_id` scope where an unknown project yields a shared 404, and the shared 422 `validation_error` envelope with request-id) — the CI follow-up from C77/C79. No unchecked CI row remained, so C80 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (75/75 probes OK) with YAML parse + actionlint v1.7.12; frontend lint/test (548)/build and backend pytest (683) green. Screens lineage-stats rendering remains a screens follow-up.
- 2026-11-19 — `fb6be47` — C81 (backend): added authoritative `GET /api/v1/collaboration/stats` deriving zero-filled presence-state breakdowns, per-project presence/comment activity, distinct participant count and newest-signal recency from the authoritative presence/comment stores (optional `project_id` scope with shared 404 `project_not_found` / 422 `validation_error` envelopes, deterministic cross-backend ordering); `CollaborationStats`/`PresenceStateCount`/`CollaborationProjectCount` mirrored in `frontend/src/types/collaborationStats.ts`, README endpoint list synced, 6 tests × 2 backends green (695 passed, contract parity + route-surface guard + tsc clean). Mocks transport, screens rendering and CI smoke wiring of the snapshot are follow-ups for those agents. My owned backend column had no unchecked items (only the repo-wide C6 docs pass remains, owned by other agents), so C81 was added under the Never-empty well.
- 2026-11-19 — `3dddb3b` — C82 (screens): rendered authoritative asset lineage stats via a reusable `LineageStatsPanel` — workspace-wide on Projects and project-scoped on project detail — with three stat cards, zero-filled derived_from/variant_of/uses_input/related_to/duplicate_of relationship-type and per-project breakdowns, all five UI states, and every display value derived in tested `lineageStatsHelpers`; resolves the C80 screens follow-up. Lint clean, 561 tests, build green. My owned column had no unchecked rows, so C82 was added under the Never-empty well.
- 2026-11-19 — `9eb617b` — C83 (mocks): wired the authoritative collaboration stats API (C81 follow-up) end to end — `getCollaborationStats`/`useCollaborationStats` atomically across mockApi (seed-derived zero-filled presence-state buckets, per-project activity sorted by comments/presence/id, distinct participant union, deterministic recency, router-style 422 + unknown-project 404 + injectable `collaborationStats` failure), the stable facade, live `httpApiClient` (`GET /collaboration/stats?project_id=`), `queryKeys` and `useQueries`, with a shared `lib/collaborationStats` derivation/validation helper; populated/empty/error seeds and the parity guard extended to both transports. Lint clean, 575 tests, build green. My owned column had no unchecked rows, so C83 was added under the Never-empty well. Screens rendering + CI live-smoke probe are follow-ups for those agents.
- 2026-11-19 — `4e932b9` — C84 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/collaboration/stats` (zero-filled snapshot + by_state/by_project breakdown shapes, the three canonical presence states, the optional `project_id` scope where an unknown project yields a shared 404, and the shared 422 `validation_error` envelope with request-id) — the CI follow-up from C81/C83. No unchecked CI row remained, so C84 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (81/81 probes OK) with YAML parse + actionlint v1.7.12; frontend lint/test (575)/build and backend pytest (695) green. Screens collaboration-stats rendering remains a screens follow-up.
- 2026-11-19 — `4632601` — C85 (backend): added authoritative `GET /api/v1/orchestration/stats` deriving zero-filled lifecycle-stage breakdowns (plan/resolve/submit/await/collect/done), per-project plan/run activity via a run→plan project join, plan-step and linked-job totals and newest-plan/run recency from the authoritative orchestration stores (optional `project_id` scope with shared 404 `project_not_found` / 422 `validation_error` envelopes, deterministic cross-backend ordering); `OrchestrationStats`/`OrchestrationStageCount`/`OrchestrationProjectCount` mirrored in `frontend/src/types/orchestrationStats.ts`, README endpoint list synced, 7 tests × 2 backends green (709 passed, contract parity + route-surface guard + tsc clean). Mocks transport, screens rendering and CI smoke wiring are follow-ups. My owned backend column had no unchecked items (only the repo-wide C6 docs pass remains, owned by other agents), so C85 was added under the Never-empty well.
- 2026-11-19 — `7aa2ab2` — C86 (screens): rendered the authoritative collaboration statistics (C81/C83/C84 follow-up) via `useCollaborationStats` — a reusable `CollaborationStatsPanel` on Workspaces (workspace-wide) and project detail (project-scoped) with four stat cards, zero-filled online/away/offline presence and per-project activity breakdowns, and all five UI states; every display value derived in tested `collaborationStatsHelpers`. Resolves the C84 screens follow-up. Lint clean, 586 tests, build green. My owned column had no unchecked rows, so C86 was added under the Never-empty well.
- 2026-11-19 — `f088f30` — C87 (mocks): wired the C85 orchestration stats API end to end — `getOrchestrationStats`/`useOrchestrationStats` atomically across mockApi (seed-derived zero-filled stage buckets, run→plan project attribution, plan-step/linked-job totals, deterministic recency, router-style 422 + unknown-project 404 + injectable `orchestrationStats` failure), the stable facade, live `httpApiClient` (`GET /orchestration/stats?project_id=`), queryKeys and useQueries, with a shared `lib/orchestrationStats` helper and new plan seeds; parity guard extended to both transports. Lint clean, 600 tests, build green. My owned column had no unchecked rows, so C87 was added under the Never-empty well. Screens rendering + CI live-smoke probe are follow-ups for those agents.
- 2026-11-19 — `6c6a787` — C88 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/orchestration/stats` (zero-filled snapshot + by_stage/by_project breakdown shapes, the six canonical lifecycle stages plan/resolve/submit/await/collect/done, the optional `project_id` scope where an unknown project yields a shared 404, and the shared 422 `validation_error` envelope with request-id) — the CI follow-up from C85/C87. No unchecked CI row remained, so C88 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (88/88 probes OK) with actionlint v1.7.12 + YAML parse; frontend lint/test (600)/build and backend pytest (709) green. Screens orchestration-stats rendering remains a screens follow-up.
- 2026-11-19 — `dc8b0b9` — C89 (backend): added authoritative `GET /api/v1/activity/stats` aggregating the same asset/publish/job/comment event stream as the activity feed (zero-filled per-kind breakdown, per-project event/participant counts, distinct participant total, newest-event recency; reuses the feed derivation so there is no second index), with optional `project_id` scope (shared 404/422 envelopes) and deterministic cross-backend ordering; `ActivityStats`/`ActivityKindCount`/`ActivityProjectCount` mirrored in TS, README endpoint list synced, 6 tests × 2 backends green (721 passed, contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring of the snapshot is a follow-up. My owned backend column had no unchecked items, so C89 was added under the Never-empty well.
- 2026-11-19 — `db504cc` — C90 (screens): rendered authoritative orchestration statistics (C85/C87/C88 follow-up) via `useOrchestrationStats` — a reusable `OrchestrationStatsPanel` on Jobs (workspace-wide) and project detail (project-scoped) with four stat cards, zero-filled plan/resolve/submit/await/collect/done stage and per-project activity breakdowns, and all five UI states; every display value derived in tested `orchestrationStatsHelpers`. Resolves the C87/C88 screens follow-up. Lint clean, 612 tests, build green. My owned column had no unchecked rows, so C90 was added under the Never-empty well.
- 2026-11-19 — `0752a55` — C91 (mocks): wired the C89 activity stats API end to end — `getActivityStats`/`useActivityStats` atomically across mockApi (reuses `deriveActivityFeed` with an unlimited limit so feed and snapshot cannot drift; zero-filled per-kind buckets, per-project event/participant counts, distinct participant total, newest-event recency, router-style 422 + unknown-project 404 + injectable `activityStats` failure), the stable facade, live `httpApiClient` (`GET /activity/stats?project_id=`), queryKeys and useQueries, with a shared `lib/activityStats` helper; parity guard extended to both transports (raised the two 20s parity safety caps to 45s for the extra simulated-latency queries). Lint clean, 625 tests, build green. My owned column had no unchecked rows, so C91 was added under the Never-empty well. Screens rendering + CI live-smoke probe remain follow-ups.
- 2026-11-19 — `8018614` — C92 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/activity/stats` (zero-filled snapshot + by_kind/by_project breakdown shapes, the four canonical activity kinds asset/publish/job/comment, the optional `project_id` scope where an unknown project yields a shared 404, and the shared 422 `validation_error` envelope with request-id) — the CI follow-up from C89/C91. No unchecked CI row remained, so C92 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (94/94 probes OK) with YAML parse + actionlint v1.7.12; frontend lint/test (625)/build and backend pytest (721) green. Screens activity-stats rendering remains a screens follow-up.
- 2026-11-19 — `cc29f83` — C93 (backend): added authoritative `GET /api/v1/search/stats?project_id=` index-coverage metrics (zero-filled project/asset/conversation document counts, total, newest-document recency) derived from the same stores `/search` reads (no second index, soft-deleted assets excluded), with optional project scope (shared 404 `project_not_found` / 422 `validation_error` envelopes); contracts mirrored in `frontend/src/types/searchStats.ts`, README endpoint list synced, 5 tests × 2 backends green (731 passed, contract parity + route guard + tsc clean). Mocks/screens/CI wiring is a follow-up. My owned backend column had no unchecked items, so C93 was added under the Never-empty well.
- 2026-11-19 — `78dabbe` — C94 (screens): rendered the authoritative activity statistics (C89/C91/C92 follow-up) via `useActivityStats` — a reusable `ActivityStatsPanel` on Home (workspace-wide, beside the activity feed) and project detail (project-scoped) with four stat cards, zero-filled asset/publish/job/comment kind and per-project event/participant breakdowns, and all five UI states; every display value derived in tested `activityStatsHelpers`. Resolves the C89/C91/C92 screens follow-up. Lint clean, 636 tests, build green. My owned column had no unchecked rows, so C94 was added under the Never-empty well.
- 2026-11-19 — `21df9fe` — C95 (mocks): wired the authoritative search index statistics API (C93 follow-up) end to end — `getSearchStats`/`useSearchStats` atomically across mockApi (seed-derived zero-filled project/asset/conversation document counts, total, newest-document recency, soft-deleted-asset exclusion, scoped-project self-count; router-style 422 + unknown-project 404 + injectable `searchStats` failure), the stable facade, live `httpApiClient` (`GET /search/stats?project_id=`), queryKeys and useQueries, with a shared `lib/searchStats` helper; parity guard extended to both transports (populated/scoped/empty/404/422 + surface guard). Lint clean, 650 tests, build green. My owned column had no unchecked rows, so C95 was added under the Never-empty well. Screens rendering + CI live-smoke probe are follow-ups for those agents.
- 2026-11-19 — `83fc093` — C96 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/search/stats?project_id=` (zero-filled snapshot shape `total_documents`/`by_kind`/`newest_document_at`/`generated_at` + by_kind breakdown, the three canonical search kinds project/asset/conversation, the optional `project_id` scope where an unknown project yields a shared 404 `project_not_found`, the shared 422 `validation_error` envelope and request-id) — the CI follow-up from C93/C95. No unchecked CI row remained, so C96 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (100/100 probes OK) with YAML parse + actionlint v1.7.12; frontend lint clean/650 tests/build green and backend pytest (731) green. Screens search-stats rendering remains a screens follow-up.
- 2026-11-19 — `2c3433c` — C97 (backend): added authoritative `GET /api/v1/uploads/stats?project_id=` deriving zero-filled pending/complete status counts, completed byte totals, deterministic per-project ticket activity and newest-ticket recency from the authoritative `UPLOADS` store (no second index), with optional project scope (shared 404 `project_not_found` / 422 `validation_error` envelopes) and a single canonical `UploadStatus` literal shared with `UploadRecord.status`; contracts mirrored in `frontend/src/types/uploadStats.ts`, README endpoint list synced, 5 tests × 2 backends green (741 passed, contract parity + route guard + tsc clean). Mocks/screens/CI wiring is a follow-up. My owned backend column had no unchecked items, so C97 was added under the Never-empty well.
- 2026-11-19 — `fbad6df` — C98 (screens): rendered the authoritative search index statistics (C93/C95/C96 follow-up) via `useSearchStats` — a reusable `SearchStatsPanel` on Home (workspace-wide) and project detail (project-scoped) with four stat cards, zero-filled project/asset/conversation kind breakdowns with share bars, and all five UI states; every display value derived in tested `searchStatsHelpers`. Resolves the C96 screens follow-up. Lint clean, 661 tests, build green. My owned column had no unchecked rows, so C98 was added under the Never-empty well.
- 2026-11-19 — `e985ec5` — C99 (mocks): wired the authoritative upload statistics API (C97 follow-up) end to end — `getUploadStats`/`useUploadStats` atomically across mockApi (seed-derived zero-filled pending/complete status buckets, completed-only byte totals, deterministic per-project ticket activity, newest-ticket recency; router-style 422 for a malformed project id + unknown-project 404 + injectable `uploadStats` failure), the stable facade, live `httpApiClient` (`GET /uploads/stats?project_id=`), queryKeys and useQueries, with a shared `lib/uploadStats` derivation/validation helper + ticket seeds; parity guard extended to both transports. My owned column had no unchecked rows, so C99 was added under the Never-empty well. Lint clean, 676 tests, build green. Screens rendering + CI live-smoke probe are follow-ups.
- 2026-11-19 — `2f28b46` — C100 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/uploads/stats` (zero-filled snapshot + by_status/by_project breakdown shapes, the two canonical statuses pending/complete, the optional `project_id` scope where an unknown project yields a shared 404 `project_not_found`, and the shared 422 `validation_error` envelope with request-id) — the CI follow-up from C97/C99. No unchecked CI row remained, so C100 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (107/107 probes OK) with actionlint v1.7.12 + YAML parse; frontend lint clean/676 tests/build green and backend pytest (741) green. Screens upload-stats rendering remains a screens follow-up.
- 2026-11-19 — `cf16a19` — C101 (backend): added authoritative `GET /api/v1/events/stats?project_id=` deriving zero-filled per-type event breakdowns, per-job event counts with recency, emitting-job total and newest-event recency from the authoritative `JOB_EVENTS` store (optional project scope joins events to jobs with shared 404/422 envelopes); `EventStats`/`EventTypeCount`/`EventJobCount` mirrored in `frontend/src/types/eventStats.ts`, README endpoint list synced, 5 tests × 2 backends green (751 passed, contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring of the snapshot is a follow-up. My owned backend column had no unchecked items, so C101 was added under the Never-empty well.
- 2026-11-19 — `4dd4ed1` — C102 (screens): rendered the authoritative upload statistics (C97/C99/C100 follow-up) via `useUploadStats` — a reusable `UploadStatsPanel` on Home (workspace-wide) and project detail (project-scoped) with four stat cards, zero-filled pending/complete status and per-project ticket activity breakdowns, and all five UI states; every display value derived in tested `uploadStatsHelpers`. Resolves the C100 screens follow-up. Lint clean, 691 tests, build green. My owned column had no unchecked rows, so C102 was added under the Never-empty well.
- 2026-11-19 — `a740483` — C103 (mocks): wired the authoritative job event stream statistics API (C101 follow-up) end to end — `getEventStats`/`useEventStats` atomically across mockApi (seed-derived zero-filled per-type buckets, per-job event activity with recency, event→job join for project scope with orphan exclusion, router-style 422 for a malformed project id + unknown-project 404 + injectable `eventStats` failure), the stable facade, live `httpApiClient` (`GET /events/stats?project_id=`), queryKeys and useQueries, with a shared `lib/eventStats` derivation/validation helper and `JOB_EVENTS` seeds; parity guard extended to both transports. My owned column had no unchecked rows, so C103 was added under the Never-empty well. Lint clean, 705 tests, build green. Screens rendering + CI live-smoke probe are follow-ups.
- 2026-11-19 — `7a65bab` — C104 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/events/stats` (zero-filled snapshot + by_type/by_job breakdown shapes, the six canonical event types status/progress/intermediate/result/error/log, the optional `project_id` scope where an unknown project yields a shared 404, and the shared 422 `validation_error` envelope with request-id) — the CI follow-up from C101/C103. No unchecked CI row remained, so C104 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (107/107 probes OK) with actionlint v1.7.12 + YAML parse; frontend lint/test (705)/build and backend pytest (751) green. Screens event-stats rendering remains a screens follow-up.
- 2026-11-19 — `9db35b3` — C105 (backend): added authoritative `GET /api/v1/retries/stats?project_id=` deriving accepted-retry totals, distinct retried-job counts, a zero-filled retried-jobs-by-status breakdown, per-project retry/job activity and newest retried-job recency from the authoritative `JOB_RETRIES` idempotency ledger joined to jobs (orphans excluded); `RetryStats`/`RetryStatusCount`/`RetryProjectCount` mirrored in `frontend/src/types/retryStats.ts`, README endpoint list synced, 5 tests × 2 backends green (761 passed, contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring is a follow-up. My owned backend column had no unchecked items, so C105 was added under the Never-empty well.
- 2026-11-19 — `0471d47` — C106 (screens): rendered the authoritative job event-stream statistics (C101/C103/C104 follow-up) via `useEventStats` — a reusable `EventStatsPanel` on Jobs (workspace-wide) and project detail (project-scoped) with four stat cards, zero-filled status/progress/intermediate/result/error/log type and per-job activity breakdowns, and all five UI states; every display value derived in tested `eventStatsHelpers`. Resolves the C104 screens follow-up. Lint clean, 719 tests, build green. My owned column had no unchecked rows, so C106 was added under the Never-empty well.
- 2026-11-19 — `87ae1e5` — C107 (mocks): wired the authoritative job retry statistics API (C105 follow-up) end to end — `getRetryStats`/`useRetryStats` atomically across mockApi (seed-derived zero-filled status buckets, duplicate-ledger retry counts, per-project retry/job activity sorted by retries then id, orphan exclusion, joined-job recency; router-style 422 + unknown-project 404 + injectable `retryStats` failure), the stable facade, live `httpApiClient` (`GET /retries/stats?project_id=`), queryKeys and useQueries, with a shared `lib/retryStats` derivation/validation helper + ledger seeds and parity extended to both transports; lint clean, 733 tests, build green. My owned column had no unchecked rows, so C107 was added under the Never-empty well. Screens rendering + CI live-smoke probe are follow-ups.
- 2026-11-19 — `d88537d` — C108 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/retries/stats` (zero-filled snapshot + by_status/by_project breakdown shapes, the five canonical job statuses queued/running/succeeded/failed/canceled, the optional `project_id` scope where an unknown project yields a shared 404 `project_not_found`, and the shared 422 `validation_error` envelope with request-id) — the CI follow-up from C105/C107. No unchecked CI row remained, so C108 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (115/115 probes OK, on a non-conflicting port because :8000 is held by another service) with YAML parse + actionlint v1.7.12; frontend lint/test (733)/build and backend pytest (761) green. Screens retry-stats rendering remains a screens follow-up.
- 2026-11-19 — `7711aec` — C109 (backend): added authoritative `GET /api/v1/versions/stats?project_id=` deriving version-record totals, distinct versioned assets, revision count, by-version and per-project breakdowns and newest-version recency from the authoritative `ASSET_VERSIONS` store joined to assets (deleted/unknown assets excluded, no second index, shared 404/422 envelopes); `VersionStats`/`VersionNumberCount`/`VersionProjectCount` mirrored in `frontend/src/types/versionStats.ts`, README endpoint list synced, 5 tests × 2 backends green (771 passed, contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring of the snapshot is a follow-up. My owned backend column had no unchecked items, so C109 was added under the Never-empty well.
- 2026-11-19 — `75f0b3b` — C110 (screens): rendered the authoritative job retry statistics (C105/C107/C108 follow-up) via `useRetryStats` — a reusable `RetryStatsPanel` on Jobs (workspace-wide) and project detail (project-scoped) with four stat cards, zero-filled queued/running/succeeded/failed/canceled status and per-project retry/job breakdowns, and all five UI states; every display value derived in tested `retryStatsHelpers`. Resolves the C108 screens follow-up. Lint clean, 747 tests, build green. My owned column had no unchecked rows, so C110 was added under the Never-empty well.
- 2026-11-19 — `28bac8a` — C111 (mocks): wired the authoritative asset version statistics API (C109 follow-up) end to end — `getVersionStats`/`useVersionStats` atomically across mockApi (seed-derived version records from `ASSETS` with one v1 per asset plus revisions, ascending by-version buckets, per-project version/asset counts sorted by descending versions then id, distinct live-asset total, newest `(created_at, asset_id)` recency, soft-deleted/unknown-asset exclusion, router-style 422 + unknown-project 404 + injectable `versionStats` failure), the stable facade, live `httpApiClient` (`GET /versions/stats?project_id=`), queryKeys and useQueries, with a shared `lib/versionStats` derivation/validation helper + seeds and parity extended to both transports; lint clean, 759 tests, build green. My owned column had no unchecked rows, so C111 was added under the Never-empty well. Screens rendering + CI live-smoke probe are follow-ups.
- 2026-11-19 — `8da0578` — C112 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/versions/stats` (zero-filled snapshot + by_version/by_project breakdown shapes, an on-demand v2 revision so the derived 200 shape is exercised, the optional `project_id` scope where an unknown project yields a shared 404 `project_not_found`, and the shared 422 `validation_error` envelope with request-id) — the CI follow-up from C109/C111. No unchecked CI row remained, so C112 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (129/129 probes OK, on a non-conflicting port because :8000 is held by another service) with YAML parse + actionlint v1.7.12; frontend lint clean/759 tests/build green and backend pytest (771) green. Screens version-stats rendering remains a screens follow-up.
- 2026-11-19 — `207d242` — C113 (backend): added authoritative `GET /api/v1/publishes/stats?project_id=` deriving published-asset totals, delivered bytes, deterministic by-version/by-project breakdowns and newest-publish recency from publish receipts in the authoritative asset store (no second index; soft-deleted/unpublished assets and malformed receipts excluded, shared 404/422 envelopes); `PublishStats`/`PublishVersionCount`/`PublishProjectCount` mirrored in `frontend/src/types/publishStats.ts`, README endpoint list synced, 6 tests × 2 backends green (783 passed, contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring is a follow-up. My owned backend column had no unchecked items, so C113 was added under the Never-empty well.
- 2026-11-19 — `bad8580` — C114 (screens): rendered the authoritative asset version statistics (C109/C111/C112 follow-up) via `useVersionStats` — a reusable `VersionStatsPanel` on Home (workspace-wide), the Assets browser and project detail (project-scoped) with four stat cards, version-number and per-project version/asset breakdowns, and all five UI states; every display value derived in tested `versionStatsHelpers`. Resolves the C112 screens follow-up. Lint clean, 770 tests, build green. My owned column had no unchecked rows, so C114 was added under the Never-empty well.
- 2026-11-19 — `91afa99` — C115 (mocks): wired the authoritative publish statistics API (C113 follow-up) end to end — `getPublishStats`/`usePublishStats` atomically across mockApi (receipt-derived totals, delivered bytes, ascending by-version buckets, per-project publish/byte counts sorted by descending publishes then id, newest-publish recency, soft-deleted/malformed-receipt exclusion, router-style 422 + unknown-project 404 + injectable `publishStats` failure), the stable facade, live `httpApiClient` (`GET /publishes/stats?project_id=`), queryKeys and useQueries, with a shared `lib/publishStats` derivation/validation helper + quantitative publish-receipt seeds; parity guard extended to both transports (populated/scoped/empty/404/422 + surface guard). Lint clean, 781 tests, build green. My owned column had no unchecked rows, so C115 was added under the Never-empty well. Screens rendering + CI live-smoke probe are follow-ups.
- 2026-11-19 — `8cc2730` — C116 (CI): extended the live-mode HTTP smoke job with the authoritative `GET /api/v1/publishes/stats?project_id=` (snapshot shape + by-version/by-project breakdown shapes, an on-demand `publish_receipt` PATCH on the registered asset so the derived 200 shape is exercised, the optional `project_id` scope where an unknown project yields a shared 404 `project_not_found` and a malformed id yields 422 `validation_error`, and the request-id header) — the CI follow-up from C113/C115. No unchecked CI row remained, so C116 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (all probes OK, on a non-conflicting port because :8000 is held by another service) with YAML parse + actionlint v1.7.12; frontend lint clean/781 tests/build green and backend pytest (783) green. Screens publish-stats rendering remains a screens follow-up.
- 2026-11-19 — `551fac6` — C117 (backend): added authoritative `GET /api/v1/jobs/{job_id}/logs?level=&since_seq=&limit=` deriving a chronological, severity-filtered, cursor-paginated job-console log from the authoritative `JOB_EVENTS` stream (no second index) — each event projected to a `JobLogEntry` with a coarse `LogLevel` (debug/info/success/error), a resume `next_seq` cursor and a stream-wide `total`; optional `level` filter + bounds with shared 404 `job_not_found` / 422 `validation_error` envelopes. `JobLogEntry`/`JobLogFrame`/`LogLevel` mirrored in `frontend/src/types/jobLogs.ts`, README endpoint list synced, 8 tests × 2 backends green (799 passed, contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring of the log view is a follow-up. My owned backend column had no unchecked items (only the repo-wide C6 docs pass remains), so C117 was added under the Never-empty well.
- 2026-11-19 — `068adb7` — C118 (screens): rendered authoritative publish statistics (C113/C115/C116 follow-up) via `usePublishStats` — a reusable `PublishStatsPanel` on Home (workspace-wide), the Assets browser and project detail (project-scoped) with four stat cards, ascending version and descending per-project publish/byte breakdowns, and all five UI states; every display value derived in tested `publishStatsHelpers`. Resolves the C116 screens follow-up. Lint clean, 793 tests, build green. My owned column had no unchecked rows, so C118 was added under the Never-empty well.
- 2026-11-19 — `c7331a4` — C119 (mocks): wired the authoritative per-job execution log API (C117 follow-up) end to end — `getJobLogs`/`useJobLogs` atomically across mockApi (JOB_EVENTS-derived chronological, severity-filtered, cursor-paginated frames with coarse levels, stream-wide totals, resume cursors; router-style 422 + unknown-job 404-to-undefined + injectable `jobLogs` failure), the stable facade, live `httpApiClient` (`GET /jobs/{job_id}/logs?level=&since_seq=&limit=`), queryKeys and useQueries, with a shared `lib/jobLogs` helper and enriched event seeds; parity guard extended to both transports (populated/filtered/paged/404/422 + surface guard). Lint clean, 807 tests, build green. My owned column had no unchecked rows, so C119 was added under the Never-empty well. Screens log-console rendering + CI live-smoke probe are follow-ups.
- 2026-11-19 — `60e6b6e` — C120 (CI): extended the live-mode HTTP smoke job with the authoritative `GET /api/v1/jobs/{job_id}/logs` (frame shape + derived entries with coarse levels, `level` filter, `limit` paging + `since_seq` resume cursor, shared 404 `job_not_found` / 422 `validation_error` envelopes with request-id and the request-id header), submitting a job on demand so the derived event stream is non-empty — the CI follow-up from C117/C119. No unchecked CI row remained, so C120 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (128/128 probes OK, on a non-conflicting port because :8000 is held by another service) with YAML parse + actionlint v1.7.12 (`-shellcheck=`, since shellcheck integration is pathologically slow on the large heredoc); frontend lint clean/807 tests/build green and backend pytest (799) green. Screens log-console rendering remains a screens follow-up.
- 2026-11-19 — `f76e856` — C121 (backend): added authoritative `GET /api/v1/jobs/queue?project_id=&limit=` deriving the active (queued + running) dispatch queue in FIFO order with 1-based positions, whole-queue waiting/running counters and a bounded page from the authoritative `JOBS` store (no second index; terminal jobs excluded, `(created_at, job_id)` FIFO tie-break for deterministic cross-backend order), optional `project_id` scope (unknown → shared 404 `project_not_found`, malformed → shared 422) and `limit` bounds; `JobQueueEntry`/`JobQueueView` mirrored in `frontend/src/types/jobQueue.ts`, README endpoint list synced, 8 tests × 2 backends green (815 passed, contract parity + route-surface guard + tsc clean). Mocks transport, screens rendering and CI live-smoke wiring of the queue view are follow-ups. My owned backend column had no unchecked items (only the repo-wide C6 docs pass remains, owned by other agents), so C121 was added under the Never-empty well.
- 2026-11-19 — `e8ac977` — C122 (screens): rendered the authoritative per-job execution log (C117/C119/C120 follow-up) via `useJobLogs` — a reusable `JobLogConsole` on the Jobs screen and project detail with a job picker, severity filter chips, page-size select and forward/backward cursor navigation, plus loading/error/missing/empty/populated states; every display value derived in tested `jobLogHelpers` (14 new tests). Resolves the C120 screens follow-up. Lint clean, 821 tests, build green. My owned column had no unchecked rows, so C122 was added under the Never-empty well.
- 2026-11-19 — `c26c1d9` — C123 (mocks): wired the authoritative job dispatch-queue API (C121 follow-up) end to end — `getJobQueue`/`useJobQueue` atomically across mockApi (FIFO active-job derivation with 1-based positions, whole-queue counters, bounded page, router-style 422 + unknown-project 404 + injectable `jobQueue` failure), the stable ApiClient facade, live `httpApiClient` (`GET /jobs/queue?project_id=&limit=`), queryKeys and useQueries, with a shared `lib/jobQueue` derivation/validation helper; parity guard extended to both transports; lint clean, 836 tests, build green. My owned column had no unchecked rows, so C123 was added under the Never-empty well. Screens rendering + CI live-smoke probe are follow-ups for those agents.
- 2026-11-19 — `bf28a6a` — C124 (CI): extended the live-mode HTTP smoke job with the newly live-wired `GET /api/v1/jobs/queue` (derived snapshot + entry shapes, whole-queue counter invariants and 1-based FIFO positions, reuse of the on-demand submitted job as a derived queued entry, `limit` page bound with unchanged counters, optional `project_id` scope, and shared 404 `project_not_found` / 422 `validation_error` envelopes with request-id) — the CI follow-up from C121/C123. No unchecked CI row remained, so C124 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (156/156 probes OK, on a non-conflicting port because :8000 is held by another service) with YAML parse + actionlint v1.7.12 (`-shellcheck=`, since shellcheck integration is pathologically slow on the large heredoc); frontend lint clean/836 tests/build green and backend pytest (815) green. Screens queue-view rendering remains a screens follow-up.
- 2026-11-19 — `3e145eb` — C125 (backend): added authoritative `GET /api/v1/publishes` newest-first publish feed derived from the same receipts as publishes/stats (no second index) — asset/project id + name, asset type, receipt version/bytes and publish time, project-name join, deterministic recency tie-break, bounded page + whole-scope `total`, optional `project_id` scope with shared 404/422 envelopes; `PublishFeed`/`PublishFeedItem` mirrored in `frontend/src/types/publishFeed.ts`, README endpoint list synced, 9 tests × 2 backends green (833 passed, contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring of the feed is a follow-up.
- 2026-11-19 — `ef8ab4e` — C126 (screens): rendered the authoritative job dispatch queue (C121/C123/C124 follow-up) via `useJobQueue` — a reusable `JobQueuePanel` on the Jobs screen and project detail with four whole-queue cards, waiting/running composition bars, FIFO rows with 1-based positions and friendly operation/project labels, a bounded page-size select and refresh, and loading/error/missing/empty/populated states; all display values derived in 11 new tested `jobQueueHelpers` cases. Resolves the C124 screens follow-up. Lint clean, 847 tests, build green. My owned column had no unchecked rows, so C126 was added under the Never-empty well.
- 2026-11-19 — `b009ad1` — C127 (mocks): wired the authoritative publish-feed API (C125 follow-up) end to end — `getPublishFeed`/`usePublishFeed` atomically across mockApi (newest-first receipt derivation with `(published_at, asset_id)` tie-break, joined project names with "Unknown project" fallback, soft-deleted/malformed-receipt exclusion, whole-scope `total` before the `limit` page, router-style 422 + unknown-project 404 + injectable `publishFeed` failure), the stable ApiClient facade, live `httpApiClient` (`GET /publishes?project_id=&limit=`), queryKeys and useQueries, with a shared `lib/publishFeed` derivation/validation helper; parity guard extended to both transports; lint clean, 863 tests, build green. My owned column had no unchecked rows, so C127 was added under the Never-empty well. Screens feed rendering + CI live-smoke probe are follow-ups for those agents.
- 2026-11-19 — `85c9f68` — C128 (CI): extended the live-mode HTTP smoke job with the authoritative `GET /api/v1/publishes?project_id=&limit=` publish feed (C125/C127 follow-up) — feed shape (`items`/`total`/`generated_at`), derived item shapes, newest-first `(published_at, asset_id)` ordering, whole-scope `total` before the `limit` page, the `limit` page bound with unchanged counters, the optional `project_id` scope and the shared 404 `project_not_found` / 422 `validation_error` envelopes (malformed id + invalid limit) with request-id — reusing the on-demand published asset from the publishes/stats probe. No unchecked CI row remained, so C128 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (all probes OK, on a non-conflicting port because :8000 is held by another service) with YAML parse + actionlint v1.7.12 (`-shellcheck=`); frontend lint clean/863 tests/build green and backend pytest (833) green. Screens publish-feed rendering remains a screens follow-up.
- 2026-11-19 — `f0ddf48` — C129 (backend): added authoritative `GET /api/v1/uploads/feed` newest-first upload-ticket feed derived from the same authoritative `UPLOADS` store as uploads/stats (no second index) — ticket/project identity with joined display names, filename/content type, lifecycle status, declared/uploaded bytes and creation/expiry timestamps, deterministic `(created_at, upload_id)` order, whole-scope `total` before the `limit` page, and optional `project_id` scope with shared 404 `project_not_found` / 422 `validation_error` envelopes; `UploadFeed`/`UploadFeedItem` mirrored in `frontend/src/types/uploadFeed.ts`, README endpoint list synced, 8 tests × 2 storage backends green (849 passed, contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring of the feed is a follow-up. My owned backend column had no unchecked items (only the repo-wide C6 docs pass remains, owned by other agents), so C129 was added under the Never-empty well.
- 2026-11-19 — `ad00286` — C130 (screens): rendered the authoritative publish feed (C125/C127/C128 follow-up) via `usePublishFeed` — a reusable `PublishFeedPanel` on Home (workspace-wide) and project detail (project-scoped) with page-size chips, newest-first rows showing asset/project names, type badges, version and byte-size labels and publish recency, deep links that scope the assets browser to the row project before selecting the asset, and loading/error/missing/empty/populated states; every display value derived in tested `publishFeedHelpers` (7 new tests). Resolves the C128 screens follow-up. Lint clean, 870 tests, build green. My owned column had no unchecked rows, so C130 was added under the Never-empty well.
- 2026-11-19 — `2402499` — C131 (mocks): wired the authoritative upload-ticket feed (C129 follow-up) end to end — `getUploadFeed`/`useUploadFeed` atomically across mockApi (seed-derived newest-first tickets with `(created_at, upload_id)` tie-break, joined project names with "Unknown project" fallback, declared/uploaded byte sizes + expiry, router-style 422 + unknown-project 404 + injectable `uploadFeed` failure), the stable ApiClient facade, live `httpApiClient` (`GET /uploads/feed?project_id=&limit=`), queryKeys and useQueries, with a shared `lib/uploadFeed` derivation/validation helper, feed-enriched upload seeds and populated/empty/error tests; parity guard extended to both transports. Lint clean, 885 tests, build green. My owned column had no unchecked rows, so C131 was added under the Never-empty well. Screens feed rendering + CI live-smoke probe are follow-ups.
- 2026-11-19 — `2aef7b8` — C132 (CI): extended the live-mode HTTP smoke job with the authoritative `GET /api/v1/uploads/feed?project_id=&limit=` upload-ticket feed (C129/C131 follow-up) — feed shape (`items`/`total`/`generated_at`), item shapes (upload/project ids + joined project name, filename/content type, status, declared/uploaded bytes, creation/expiry), newest-first `(created_at, upload_id)` ordering, whole-scope `total` before the `limit` page with unchanged counters, the optional `project_id` scope and the shared 404 `project_not_found` / 422 `validation_error` envelopes (malformed id + invalid limit) with request-id — issuing one upload ticket on demand so the derived feed is non-empty. No unchecked CI row remained, so C132 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (all probes OK, on a non-conflicting port because :8000 is held by another service) with YAML parse + actionlint v1.7.12 (no findings); frontend lint clean/885 tests/build green and backend pytest (849) green. Screens upload-feed rendering remains a screens follow-up.
- 2026-11-19 — `ffcb040` — C133 (backend): added authoritative `GET /api/v1/conversations/feed?project_id=&limit=` — a newest-first workspace conversation feed derived fresh from the authoritative `CONVERSATIONS`/`MESSAGES` stores (no second index) — conversation/project identity with joined project name, title, canonical message count and a last-message role/truncated-whitespace-normalized excerpt preview, deterministic `(updated_at, conversation_id)` order, a whole-scope `total` before the `limit` page, and an optional `project_id` scope with shared 404 `project_not_found` / 422 `validation_error` envelopes; `ConversationFeed`/`ConversationFeedItem` mirrored in `frontend/src/types/conversationFeed.ts`, README endpoint list synced, 10 tests × 2 storage backends green (869 passed, contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring of the feed is a follow-up. My owned backend column had no unchecked items (only the repo-wide C6 docs pass remains, owned by other agents), so C133 was added under the Never-empty well.
- 2026-11-19 — `be151cd` — C134 (screens): rendered the authoritative upload-ticket feed (C129/C131/C132 follow-up) via `useUploadFeed` — a reusable `UploadFeedPanel` on Home (workspace-wide) and project detail (project-scoped) with page-size chips, newest-first rows showing filenames, joined project names, status badges, declared/uploaded byte sizes and created/expiry labels, project-detail deep links, and all five UI states; every display value derived in tested `uploadFeedHelpers`, with `uploadStatusTone` shared from `uploadStatsHelpers`. Resolves the C132 screens follow-up. Lint clean, 892 tests, build green. My owned column had no unchecked rows, so C134 was added under the Never-empty well.
- 2026-11-19 — `f28c707` — C135 (mocks): wired the authoritative conversation feed (C133 follow-up) end to end — `getConversationFeed`/`useConversationFeed` atomically across mockApi (newest-first `(updated_at, conversation_id)` derivation, joined project names with "Unknown project" fallback, last-message role + whitespace-normalized/truncated excerpt preview from `MESSAGES` with an `(created_at, id)` tie-break and null previews for empty conversations, whole-scope `total` before the `limit` page, router-style 422 + unknown-project 404 + injectable `conversationFeed` failure), the stable `ApiClient` facade, live `httpApiClient` (`GET /conversations/feed?project_id=&limit=`), queryKeys and useQueries, with a shared `lib/conversationFeed` derivation/validation helper; parity guard extended to both transports. Lint clean, 908 tests, build green. My owned column had no unchecked rows, so C135 was added under the Never-empty well. Screens feed rendering + CI live-smoke probe remain follow-ups.
- 2026-11-19 — `edeb8cb` — C136 (CI): extended the live-mode HTTP smoke job with the authoritative `GET /api/v1/conversations/feed` conversation feed (the C133/C135 follow-up) — feed shape, derived item shapes with the last-message role/excerpt preview, newest-first `(updated_at, conversation_id)` ordering, whole-scope `total` before the `limit` page with unchanged counters, optional `project_id` scope and the shared 404 `project_not_found` / 422 `validation_error` envelopes (malformed id + invalid limit) with request-id — creating one conversation with an initial message plus an assistant reply on demand so the derived feed is non-empty. No unchecked CI row remained, so C136 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (189/189 probes OK, on a dynamically chosen free port because :8000 and :8123 are held by other services) with YAML parse + actionlint v1.7.12 (no findings); frontend lint clean/908 tests/build green and backend pytest (869) green. Screens conversation-feed rendering remains a screens follow-up.
- 2026-11-19 — `503f143` — C137 (backend): added authoritative `GET /api/v1/assets/feed?project_id=&limit=` — a newest-first workspace asset feed derived fresh from the authoritative `ASSETS` collection (no second index) — asset/project identity with a joined project display name, type/name/status, current version, recorded byte size and created/updated timestamps, deterministic `(created_at, asset_id)` order and a whole-scope `total` before the `limit` page, excluding soft-deleted assets (matching `/assets` and `/assets/stats`), with an optional `project_id` scope using shared 404 `project_not_found` / 422 `validation_error` envelopes; `AssetFeed`/`AssetFeedItem` mirrored in `frontend/src/types/assetFeed.ts`, README endpoint list synced, 10 tests × 2 storage backends green (889 passed, contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring of the feed is a follow-up. My owned backend column had no unchecked items (only the repo-wide C6 docs pass remains, owned by other agents), so C137 was added under the Never-empty well.
- 2026-11-19 — `7c62ff2` — C138 (screens): rendered the authoritative conversation feed via `useConversationFeed` — a reusable `ConversationFeedPanel` on Home (workspace-wide) and project detail (project-scoped) with page-size chips, newest-first rows showing conversation title, joined project name, message count and a last-message role badge + excerpt, and Open buttons that deep-link to the chat route with the selected conversation, plus loading/error/missing/empty/populated states — every display value derived in tested `conversationFeedHelpers` (15 new tests). My owned column had no unchecked rows, so C138 was added under the Never-empty well. Lint clean, 923 tests, build green.
- 2026-11-19 — `a0c1671` — C139 (mocks): wired the authoritative asset feed (C137 follow-up) end to end — `getAssetFeed`/`useAssetFeed` atomically across mockApi (newest-first `(created_at, asset_id)` derivation over live assets with joined project names + "Unknown project" fallback, soft-deleted exclusion, status/version defaults, whole-scope `total` before the `limit` page, router-style 422 + unknown-project 404 + injectable `assetFeed` failure), the stable `ApiClient` facade, live `httpApiClient` (`GET /assets/feed?project_id=&limit=`), queryKeys and useQueries, with a shared `lib/assetFeed` derivation/validation helper; parity guard extended to both transports (populated/scoped/limited/empty/404/422 + surface guard). Lint clean, 936 tests, build green. Screens feed rendering + CI live-smoke probe remain follow-ups. My owned column had no unchecked rows, so C139 was added under the Never-empty well.
- 2026-11-19 — `1e2f64b` — C140 (CI): extended the live-mode HTTP smoke job with the authoritative `GET /api/v1/assets/feed` asset feed (the C137/C139 follow-up) — feed shape (`items`/`total`/`generated_at`), derived item shapes with joined project name + type/name/status/version/byte size/timestamps, newest-first `(created_at, asset_id)` ordering, whole-scope `total` before the `limit` page with unchanged counters, optional `project_id` scope and the shared 404 `project_not_found` / 422 `validation_error` envelopes (malformed id + invalid limit) with request-id — reusing the on-demand registered asset so the derived feed is non-empty. No unchecked CI row remained, so C140 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (all probes OK, on a dynamically chosen free port) with YAML parse + actionlint v1.7.12 (`-shellcheck=`, since shellcheck integration is pathologically slow on the large heredoc); frontend lint clean/936 tests/build green and backend pytest (889) green. Screens asset-feed rendering remains a screens follow-up.
- 2026-11-19 — `22e1ca7` — C141 (backend): added authoritative `GET /api/v1/jobs/feed?project_id=&status=&limit=` — a newest-first workspace job feed derived fresh from the authoritative `JOBS` collection (no second index) — job/project identity with joined project display name, operation id, lifecycle status/progress/attempt/creator and created/started/finished timestamps, deterministic `(created_at, job_id)` newest-first order and a whole-scope `total` before the `limit` page; optional `project_id`/`status` scopes use shared 404 `project_not_found` / 422 `validation_error` envelopes; `JobFeed`/`JobFeedItem` mirrored in `frontend/src/types/jobFeed.ts`, README endpoint list synced, 11 tests × 2 storage backends green (911 passed, contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring of the feed is a follow-up. My owned backend column had no unchecked items (only the repo-wide C6 docs pass remains, owned by other agents), so C141 was added under the Never-empty well.
- 2026-11-19 — `fb6c50b` — C142 (screens): rendered the authoritative asset feed (C137/C139/C140 follow-up) via `useAssetFeed` — a reusable `AssetFeedPanel` on Home (workspace-wide) and project detail (project-scoped) with page-size chips, newest-first rows showing asset/project names, type and status badges, version and byte-size labels and create recency, and deep links that scope the assets browser to the row's project before selecting the asset, with all five UI states; every display value derived in tested `assetFeedHelpers`. Resolves the C140 screens follow-up. Lint clean, 949 tests, build green. My owned column had no unchecked rows, so C142 was added under the Never-empty well.
- 2026-11-19 — `8c92c39` — C143 (mocks): wired the authoritative job feed (C141 follow-up) end to end — `getJobFeed`/`useJobFeed` atomically across mockApi (newest-first `(created_at, job_id)` derivation over the existing job/project seeds with joined project names + "Unknown project" fallback, optional `project_id`/`status` scopes, progress/attempt/timestamp defaults, whole-scope `total` before the `limit` page, router-style 422 + unknown-project 404 + injectable `jobFeed` failure), the stable `ApiClient` facade, live `httpApiClient` (`GET /jobs/feed?project_id=&status=&limit=`), queryKeys and useQueries, with a shared `lib/jobFeed` derivation/validation helper; parity guard extended to both transports (populated/scoped/filtered/limited/empty/404/422 + surface guard). Lint clean, 962 tests, build green. My owned column had no unchecked rows, so C143 was added under the Never-empty well. Screens job-feed rendering + CI live-smoke probe remain follow-ups.
- 2026-11-19 — `ec5242d` — C144 (CI): extended the live-mode HTTP smoke job with the authoritative `GET /api/v1/jobs/feed` job feed (the C141/C143 follow-up) — feed shape (`items`/`total`/`generated_at`), derived item shapes with joined project name + operation/status/progress/attempt/creator/timestamps, newest-first `(created_at, job_id)` ordering, whole-scope `total` before the `limit` page with unchanged counters, `status` filter, optional `project_id` scope and the shared 404 `project_not_found` / 422 `validation_error` envelopes (malformed id + invalid status + invalid limit) with request-id — reusing the on-demand submitted job so the derived feed is non-empty. No unchecked CI row remained, so C144 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (211/211 probes OK, on a dynamically chosen free port because :8000/:8123/:8011 are held by other services) with YAML parse + actionlint v1.7.12 (`-shellcheck=`); frontend lint clean/962 tests/build green and backend pytest (911) green. Screens job-feed rendering remains a screens follow-up.
- 2026-11-19 — `a94ae88` — C145 (backend): added authoritative `GET /api/v1/projects/feed?org_id=&lifecycle=&limit=` — a newest-first workspace project feed derived fresh from the authoritative `PROJECTS` collection (no second index) with joined org display name (orphan fallback), description, canonical active/archived lifecycle, creator and timestamps, deterministic `(created_at, project_id)` order and a whole-scope `total` before the `limit` page; optional `org_id` scope yields a zero-filled 200 for an unknown-but-valid org (matching `/projects?org_id=`) with shared 422 envelopes for malformed id / invalid lifecycle / invalid limit. `ProjectFeed`/`ProjectFeedItem` mirrored in `frontend/src/types/projectFeed.ts`, README synced, 12 tests × 2 storage backends green (935 passed, contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring is a follow-up. My owned backend column had no unchecked items, so C145 was added under the Never-empty well.
- 2026-11-19 — `f7a5c27` — C146 (screens): rendered the authoritative job feed (C141/C143/C144 follow-up) via `useJobFeed` — a reusable `JobFeedPanel` on the Jobs screen (workspace-wide) and project detail (project-scoped) with status and page-size chips, newest-first rows showing prettified operation labels, joined project names, progress percent and attempt labels, and project-detail deep links, with all five UI states and every display value derived in tested `jobFeedHelpers`. Resolves the C144 screens follow-up. Lint clean, 978 tests, build green. My owned column had no unchecked rows, so C146 was added under the Never-empty well.
- 2026-11-19 — `33538cd` — C147 (mocks): wired the authoritative project feed (C145 follow-up) end to end — `getProjectFeed`/`useProjectFeed` atomically across mockApi (newest-first `(created_at, project_id)` derivation over the project/org seeds with joined org names + "Unknown organization" fallback, `archived`-derived lifecycle, org/lifecycle scopes, zero-filled unknown-org feed, whole-scope `total` before the `limit` page, router-style 422 + injectable `projectFeed` failure), the stable `ApiClient` facade, live `httpApiClient` (`GET /projects/feed?org_id=&lifecycle=&limit=`), queryKeys and useQueries, with a shared `lib/projectFeed` derivation/validation helper; parity guard extended to both transports (populated/scoped/filtered/limited/zero-filled-org/422 + surface guard). Lint clean, 989 tests, build green. My owned column had no unchecked rows, so C147 was added under the Never-empty well. Screens feed rendering + CI live-smoke probe remain follow-ups.
- 2026-11-19 — `52246f5` — C148 (CI): extended the live-mode HTTP smoke job with the authoritative `GET /api/v1/projects/feed` project feed (the C145/C147 follow-up) — feed shape (`items`/`total`/`generated_at`), derived item shapes with joined org name + active/archived lifecycle/creator/timestamps, newest-first `(created_at, project_id)` ordering, whole-scope `total` before the `limit` page with unchanged counters, `lifecycle` filter, optional `org_id` scope (unknown-but-valid org → zero-filled 200) and the shared 422 `validation_error` envelopes (malformed org + invalid lifecycle + invalid limit) with request-id — reusing the on-demand project so the derived feed is non-empty. No unchecked CI row remained, so C148 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (all probes OK, on a dynamically chosen free port) with YAML parse + actionlint v1.7.12 (`-shellcheck=`); frontend lint clean/989 tests/build green and backend pytest (935) green. Screens project-feed rendering remains a screens follow-up.
- 2026-11-19 — `93569fd` — C149 (backend): added authoritative `GET /api/v1/comments/feed?project_id=&limit=` — a newest-first workspace comment feed derived fresh from the authoritative `COMMENTS` collection (no second index) with joined project display name (orphan fallback), optional asset reference, author id, body and created timestamp, deterministic `(created_at, comment_id)` ordering and a whole-scope `total` before the `limit` page; an optional `project_id` scope validates the project (shared 404 `project_not_found`) with shared 422 envelopes for a malformed id / invalid limit. `CommentFeed`/`CommentFeedItem` mirrored in `frontend/src/types/commentFeed.ts` + exported from the types index, README endpoint list synced, 11 tests × 2 storage backends green (955 passed, contract parity + route-surface guard clean). Mocks/screens/CI wiring of the feed is a follow-up. My owned backend column had no unchecked items, so C149 was added under the Never-empty well.
- 2026-11-19 — `e2fa8e2` — C150 (screens): rendered the authoritative project feed (C145/C147/C148 follow-up) via `useProjectFeed` — a reusable `ProjectFeedPanel` on Projects (workspace-wide) and project detail (org-scoped) with lifecycle/page-size chips, newest-first rows showing project name, joined org name, lifecycle badge and created-at recency, and project-detail deep links, with all five UI states and every display value derived in tested `projectFeedHelpers` (11 new tests). Resolves the C148 screens follow-up. Lint clean, 1003 tests, build green. My owned column had no unchecked rows, so C150 was added under the Never-empty well.
- 2026-11-19 — `00b89e7` — C151 (mocks): wired the authoritative comment feed (C149 follow-up) end to end — `getCommentFeed`/`useCommentFeed` atomically across mockApi (seed-derived newest-first `(created_at, comment_id)` derivation over the comment/project stores with joined project names + "Unknown project" fallback, optional `project_id` scope, normalized 404 for an unknown project, `asset_id` null normalization, whole-scope `total` before the `limit` page, router-style 422 + injectable `commentFeed` failure), the stable `ApiClient` facade, live `httpApiClient` (`GET /comments/feed?project_id=&limit=`), `queryKeys` and `useQueries`, with a shared `lib/commentFeed` derivation/validation helper; parity guard extended to both transports (populated/scoped/limited/empty/404/422 + surface guard). Lint clean, 1011 tests, build green. My owned column had no unchecked rows (only the repo-wide C6 docs pass remains, owned by other agents), so C151 was added under the Never-empty well. Screens rendering + CI live-smoke probe remain follow-ups.
- 2026-11-19 — `be78a8b` — C152 (CI): extended the live-mode HTTP smoke job with the authoritative `GET /api/v1/comments/feed?project_id=&limit=` comment feed (the C149/C151 follow-up) — feed shape (`items`/`total`/`generated_at`), derived item shapes with joined project name + optional asset id / author id / body / created timestamp, newest-first `(created_at, comment_id)` ordering, whole-scope `total` before the `limit` page with unchanged counters, `limit` page bound, optional `project_id` scope and the shared 404 `project_not_found` / 422 `validation_error` envelopes (malformed id + invalid limit) with request-id — adding one comment to the on-demand project so the derived feed is non-empty. No unchecked CI row remained, so C152 was added under the Never-empty well. Verified the exact embedded smoke script against a real ASGI server (234 probes OK, dynamically chosen free port) with YAML parse; frontend lint/test (1011)/build green and backend pytest (955) green. Screens comment-feed rendering remains a screens follow-up.
- 2026-11-19 — `ab8e865` — C153 (backend): added authoritative `GET /api/v1/versions/feed?project_id=&limit=` — a newest-first workspace asset version feed derived fresh from the authoritative `ASSET_VERSIONS` store (no second index) with asset/project identity + joined project name, asset name/type, version number, creator and creation time, a deterministic `(created_at, asset_id, version)` tie-break and a whole-scope `total` before the `limit` page; soft-deleted/unknown-asset versions excluded (matching `/versions/stats`), optional `project_id` scope with shared 404 `project_not_found` / 422 `validation_error` envelopes; `VersionFeed`/`VersionFeedItem` mirrored in `frontend/src/types/versionFeed.ts` + exported from the types index, README endpoint list synced, 10 tests × 2 storage backends green (975 passed, contract parity + route-surface guard clean). Mocks/screens/CI wiring of the feed is a follow-up. My owned backend column had no unchecked items (only the repo-wide C6 docs pass remains, owned by other agents), so C153 was added under the Never-empty well.
- 2026-11-19 — `e762137` — C154 (screens): rendered the authoritative comment feed (C149/C151/C152 follow-up) via `useCommentFeed` — a reusable `CommentFeedPanel` on Home (workspace-wide) and project detail (project-scoped) with page-size chips, newest-first rows showing a whitespace-normalized body preview, joined project name, author badge, optional asset-reference badge and comment recency, deep links to project detail and to the referenced asset (scoping the assets browser first), and all five UI states — every display value derived in tested `commentFeedHelpers` (9 new tests). Resolves the C152 screens follow-up; lint clean, 1020 tests, build green. My owned column had no unchecked rows, so C154 was added under the Never-empty well.
- 2026-11-19 — `907fef2` — C155 (mocks): wired the authoritative asset version feed (C153 follow-up) end to end — `getVersionFeed`/`useVersionFeed` atomically across mockApi (seed-derived newest-first `(created_at, asset_id, version)` derivation over version/asset/project seeds with joined project names + "Unknown project" fallback, soft-deleted/unknown-asset exclusion, optional `project_id` scope, whole-scope `total` before the `limit` page, router-style 422 for a malformed project id / out-of-range limit + unknown-project 404 + injectable `versionFeed` failure), the stable `ApiClient` facade, live `httpApiClient` (`GET /versions/feed?project_id=&limit=`), `queryKeys` and `useQueries`, with a shared `lib/versionFeed` derivation/validation helper and enriched version seeds; parity guard extended to both transports (populated/scoped/limited/empty/404/422 + surface guard). Lint clean, 1029 tests, build green. My owned column had no unchecked rows (only the repo-wide C6 docs pass remains, owned by other agents), so C155 was added under the Never-empty well. Screens version-feed rendering + CI live-smoke probe remain follow-ups.
- 2026-11-19 — `f37a8ea` — C156 (CI): extended the live-mode HTTP smoke job with the authoritative `GET /api/v1/versions/feed?project_id=&limit=` asset version feed (the C153/C155 follow-up) — feed shape (`items`/`total`/`generated_at`), derived item shapes with joined project name + asset name/type/version/creator/timestamps, newest-first `(created_at, asset_id, version)` ordering with an asset-id/version tie-break, whole-scope `total` before the `limit` page with unchanged counters, optional `project_id` scope (unknown → shared 404 `project_not_found`), and the shared 422 `validation_error` envelopes (malformed id + invalid limit) with request-id — reusing the on-demand registered asset (v1 + appended v2) so the derived feed is non-empty. No unchecked CI row remained, so C156 was added under the Never-empty well; resolves the C155 CI follow-up. Verified the exact embedded smoke script against a real ASGI server on a dynamically chosen free port (244/244 probes OK) with YAML parse + actionlint v1.7.12 (`-shellcheck=`); frontend lint clean/1029 tests/build green and backend pytest (975) green. Screens version-feed rendering remains a screens follow-up.
- 2026-11-19 — `07ae5ed` — C157 (backend): added authoritative `GET /api/v1/lineage/feed?project_id=&limit=` — a newest-first, workspace-wide feed of typed asset relationships derived fresh from the authoritative `ASSET_RELATIONSHIPS` store (no second index) with relationship id, source/target asset ids + joined display names and project id/name, canonical relationship type and creation time, a deterministic `(created_at, id)` tie-break and a whole-scope `total` before the `limit` page; links from soft-deleted/unknown source assets excluded (matching `/lineage/stats`, feed total agrees with the snapshot) while a soft-deleted/unknown target keeps the link with a stable "Unknown asset" fallback; optional `project_id` scope with shared 404 `project_not_found` / 422 `validation_error` envelopes; `LineageFeed`/`LineageFeedItem` mirrored in `frontend/src/types/lineageFeed.ts` + exported from the types index, README endpoint list synced, 11 tests × 2 storage backends green (997 passed, contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring of the feed is a follow-up. My owned backend column had no unchecked items (only the repo-wide C6 docs pass remains, owned by other agents), so C157 was added under the Never-empty well.
- 2026-11-19 — `d6d0933` — C158 (screens): rendered the authoritative asset version feed (C153/C155/C156 follow-up) via `useVersionFeed` — a reusable `VersionFeedPanel` on Home (workspace-wide) and project detail (project-scoped) with page-size chips, newest-first rows showing asset/project names, version + type badges, creator and creation recency, and asset deep links that scope the assets browser first, plus loading/error/missing/empty/populated states — every display value derived in tested `versionFeedHelpers` (9 new tests). Resolves the C155/C156 screens follow-up; lint clean, 1038 tests, build green. My owned column had no unchecked rows, so C158 was added under the Never-empty well.
- 2026-11-19 — `42acc47` — C159 (mocks): wired the authoritative asset lineage feed (C157 follow-up) end to end — `getLineageFeed`/`useLineageFeed` atomically across mockApi (newest-first `(created_at, id)` typed-relationship derivation with source-project attribution, soft-deleted/unknown-source exclusion, stable unknown asset/project fallbacks, whole-scope `total` before the `limit` page, router-style 422 for a malformed project id / invalid limit + unknown-project 404 + injectable `lineageFeed` failure), the stable ApiClient facade, live `httpApiClient` (`GET /lineage/feed?project_id=&limit=`), queryKeys and useQueries, with a shared `lib/lineageFeed` derivation/validation helper and populated/empty/error tests; parity guard extended to both transports. Resolves the C157 mocks-transport follow-up; lint clean, 1048 tests, build green. My owned column had no unchecked rows, so C159 was added under the Never-empty well. Screens rendering + CI live-smoke probe remain follow-ups.
- 2026-11-19 — `e817534` — C160 (CI): extended the live-mode HTTP smoke job with the authoritative `GET /api/v1/lineage/feed?project_id=&limit=` asset lineage feed (the C157/C159 follow-up) — feed shape (`items`/`total`/`generated_at`), derived item shapes with joined asset/project names + canonical relationship type/timestamps, newest-first `(created_at, id)` ordering, whole-scope `total` before the `limit` page with unchanged counters, optional `project_id` scope (unknown → shared 404 `project_not_found`) and the shared 422 `validation_error` envelopes (malformed id + invalid limit) with request-id — registering one child asset on demand so the derived feed is non-empty. No unchecked CI row remained, so C160 was added under the Never-empty well; resolves the C159 CI live-smoke follow-up. Verified the exact embedded smoke script against a real ASGI server (298 probes OK, dynamically chosen free port) with YAML parse + actionlint v1.7.12 (`-shellcheck=`); frontend lint clean/1048 tests/build green and backend pytest (997) green. Screens lineage-feed rendering remains a screens follow-up.
- 2026-11-19 — `194bd45` — C161 (backend): added authoritative `GET /api/v1/orgs/feed?limit=` (alias `/organizations/feed`) — a newest-first, workspace-wide organization feed derived fresh from the authoritative `ORGANIZATIONS` store (no second index) with id/name/slug and joined member/project activity counts (orphan/malformed `_org_id` members and unknown-org projects excluded), a deterministic `(created_at, org_id)` tie-break and a whole-scope `total` before the `limit` page; shared 422 envelope for an invalid limit and literal paths registered before `/orgs/{org_id}`. `OrganizationFeed`/`OrganizationFeedItem` mirrored in `frontend/src/types/organizationFeed.ts` + exported from the types index, README endpoint list synced, 9 tests × 2 storage backends green (1015 passed, contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring of the feed is a follow-up. My owned backend column had no unchecked items, so C161 was added under the Never-empty well.
- 2026-11-19 — `0ab0bb3` — C162 (screens): rendered the authoritative asset lineage feed (C157/C159/C160 follow-up) via `useLineageFeed` — a reusable `LineageFeedPanel` on Projects (workspace-wide) and project detail (project-scoped) with page-size chips, newest-first typed relationship rows showing source → target asset names, joined project name, a relationship-type badge and creation recency, with source and (live-target-only) target deep links that scope the assets browser first, plus loading/error/missing/empty/populated states — every display value derived in tested `lineageFeedHelpers` (8 new tests). Resolves the C160 screens follow-up; lint clean, 1056 tests, build green. My owned column had no unchecked rows (only the repo-wide C6 docs pass remains, owned by other agents), so C162 was added under the Never-empty well.
- 2026-11-19 — `2b9c330` — C163 (mocks): wired the authoritative organization feed (C161 follow-up) end to end — `getOrganizationFeed`/`useOrganizationFeed` atomically across mockApi (newest-first `(created_at, id)` organization derivation with joined member/project activity counts, orphan-member/unknown-org-project exclusion, whole-scope `total` before the `limit` page, router-style 422 for an invalid limit + injectable `organizationFeed` failure), the stable ApiClient facade, live `httpApiClient` (`GET /orgs/feed?limit=`), queryKeys and useQueries, with a shared `lib/organizationFeed` derivation/validation helper and populated/empty/error tests; parity guard extended to both transports. Resolves the C161 mocks-transport follow-up; lint clean, 1063 tests, build green. My owned column had no unchecked rows, so C163 was added under the Never-empty well. Screens rendering + CI live-smoke probe remain follow-ups.
- 2026-11-19 — `9c27c69` — C164 (CI): extended the live-mode HTTP smoke job with the authoritative `GET /api/v1/orgs/feed?limit=` organization feed (the C161/C163 follow-up) — feed shape (`items`/`total`/`generated_at`), derived item shapes (org id/name/slug + joined member/project activity counts and created timestamp), newest-first `(created_at, org_id)` ordering, whole-scope `total` before the `limit` page with unchanged counters, the `limit` page bound, the `/organizations/feed` alias and the shared 422 `validation_error` envelope with request-id — creating one organization on demand so the derived feed is non-empty. No unchecked CI row remained (only the repo-wide C6 docs pass remains, owned by other agents), so C164 was added under the Never-empty well; resolves the C163 CI live-smoke follow-up. Verified the exact embedded smoke script against a real ASGI server (264 probes OK, on a dynamically chosen free port because :8000 is held by another service) with YAML parse + actionlint v1.7.12 (`-shellcheck=`); frontend lint clean/1063 tests/build green and backend pytest (1015) green. Screens organization-feed rendering remains a screens follow-up.
- 2026-11-19 — `84d82b3` — C165 (backend): added authoritative `GET /api/v1/comments/stats?project_id=` deriving comment totals, distinct author/project counts, a zero-filled asset/project reference breakdown, deterministic per-project (comments, authors) and per-author (comments) breakdowns and newest-comment recency from the authoritative `COMMENTS` store (no second index), with an optional project scope (shared 404 `project_not_found` / 422 `validation_error` envelopes) and a literal path registered alongside `/comments/feed`; `CommentStats`/`CommentReferenceCount`/`CommentProjectCount`/`CommentAuthorCount`/`CommentReference` mirrored in `frontend/src/types/commentStats.ts` + exported from the types index, README endpoint list synced, 5 tests × 2 storage backends green (1025 passed, contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring of the snapshot is a follow-up. My owned backend column had no unchecked items (only the repo-wide C6 docs pass remains, owned by other agents), so C165 was added under the Never-empty well.
- 2026-11-19 — `b45d06a` — C166 (screens): rendered the authoritative organization feed (C161/C163/C164 follow-up) via `useOrganizationFeed` — a reusable `OrganizationFeedPanel` on Workspaces with page-size chips, newest-first name/slug rows, joined member/project activity badges and creation recency, plus loading/error/missing/empty/populated states; every display value derived in tested `organizationFeedHelpers` (9 new tests). Resolves the C164 screens follow-up; lint clean, 1072 tests, build green. My owned column had no unchecked rows (only the repo-wide C6 docs pass remains, owned by other agents), so C166 was added under the Never-empty well.
- 2026-11-19 — `a595e33` — C167 (mocks): wired the authoritative comment statistics API (C165 follow-up) end to end — `getCommentStats`/`useCommentStats` atomically across mockApi (seed-derived zero-filled asset/project reference buckets, per-project comment+author and per-author comment breakdowns sorted by descending count then id, distinct totals and recency with an id tie-break; router-style 422 for a malformed project id + unknown-project 404 + injectable `commentStats` failure), the stable ApiClient facade, live `httpApiClient` (`GET /comments/stats?project_id=`), queryKeys and useQueries, with a shared `lib/commentStats` derivation/validation helper and populated/empty/error seeds; parity guard extended to both transports (populated/scoped/empty/404/422 + surface guard). Resolves the C165 mocks-transport follow-up; lint clean, 1082 tests, build green. My owned column had no unchecked rows, so C167 was added under the Never-empty well. Screens rendering + CI live-smoke probe are follow-ups for those agents.
- 2026-11-19 — `d924f40` — C168 (CI): extended the live-mode HTTP smoke job with the authoritative `GET /api/v1/comments/stats?project_id=` comment statistics endpoint (the C165/C167 follow-up) — zero-filled snapshot shape (`total_comments`/`total_authors`/`total_projects`/`by_reference`/`by_project`/`by_author`/`newest_comment_at`/`generated_at`), breakdown shapes and the two canonical reference categories (asset/project), derived non-zero shapes reusing the comment added in the comment-feed probe, the optional `project_id` scope (unknown → shared 404 `project_not_found`, malformed → shared 422 `validation_error`) and the request-id header, keeping CI aligned with the exact `/api/v1` URLs the live client calls as the repo grows. No unchecked CI row remained (only the repo-wide C6 docs pass remains, owned by other agents), so C168 was added under the Never-empty well; resolves the C167 CI live-smoke follow-up. Verified the exact embedded smoke script against a real ASGI server (272 probes OK, dynamically chosen free port because :8000 is held by another service) with YAML parse + actionlint v1.7.12 (`-shellcheck=`); frontend lint clean/1082 tests/build green and backend pytest (1025) green. Screens comment-stats rendering remains a screens follow-up.
- 2026-11-19 — `48484b7` — C169 (backend): added authoritative `GET /api/v1/events/feed?project_id=&type=&limit=` — a newest-first workspace feed of job events derived fresh from the authoritative `JOB_EVENTS` stream (no second index; the same store `/events/stats` aggregates), with event identity + joined operation/project identity and display name, all lifecycle fields (status/progress/message/asset_id/error/timestamp), a deterministic `(timestamp, job_id, seq)` tie-break and a whole-scope `total` before the `limit` page; orphan events with a missing parent job are excluded (matching the event-stats project-scope join), and optional `project_id`/`type` filters use shared 404 `project_not_found` / 422 `validation_error` envelopes with request-id. `EventFeed`/`EventFeedItem` mirrored in `frontend/src/types/eventFeed.ts` + exported from the types index, README endpoint list synced, 14 tests × 2 storage backends green (1053 passed, contract parity + route-surface guard + tsc clean). Mocks/screens/CI wiring of the feed is a follow-up. My owned backend column had no unchecked items, so C169 was added under the Never-empty well.
- 2026-11-19 — `220dbaa` — C170 (screens): rendered the authoritative comment statistics (C165/C167/C168 follow-up) via `useCommentStats` — a reusable `CommentStatsPanel` on Home (workspace-wide) and project detail (project-scoped) with four stat cards, zero-filled asset/project reference and per-project/per-author breakdowns, and all five UI states; every display value derived in 13 new tested `commentStatsHelpers` cases. Resolves the C168 screens follow-up. Lint clean/1095 tests/build green on a clean worktree of HEAD + only my changes; shared tree transiently red from a sibling's uncommitted in-progress event-feed transport work in mocks-owned `src/lib` (owner: studio-mocks). My owned column had no unchecked rows, so C170 was added under the Never-empty well. C169 event-feed screens rendering remains a follow-up.
- 2026-11-19 — `08acef1` — C171 (mocks): wired the authoritative job event feed API (C169 follow-up) end to end — `getEventFeed`/`useEventFeed` atomically across mockApi (newest-first `(timestamp, job_id, seq)` derivation over the shared `JOB_EVENTS` seeds joined to parent jobs for operation/project identity with orphan exclusion and a stable project-name fallback, `project_id`/`type` filters, whole-scope `total` before the `limit` page, router-style 422 for a malformed id / unknown type / invalid limit, unknown-project 404 + injectable `eventFeed` failure), the stable ApiClient facade, live `httpApiClient` (`GET /events/feed?project_id=&type=&limit=`), queryKeys and useQueries, with a shared `lib/eventFeed` derivation/validation helper and populated/empty/error tests; parity guard extended to both transports. Resolves the C169 mocks-transport follow-up; lint clean, 1115 tests, build green. My owned column had no unchecked rows, so C171 was added under the Never-empty well. Screens rendering + CI live-smoke probe are follow-ups for those agents.
- 2026-11-19 — `3da13a8` — C172 (CI): extended the live-mode HTTP smoke job with the authoritative `GET /api/v1/events/feed?project_id=&type=&limit=` job event feed (the C169/C171 follow-up) — feed shape (`items`/`total`/`generated_at`), derived item shapes (job/seq/type/operation/project identity + joined project name/timestamp), newest-first `(timestamp, job_id, seq)` ordering, whole-scope `total` before the `limit` page with unchanged counters, `type` filter, optional `project_id` scope and the shared 404 `project_not_found` / 422 `validation_error` envelopes (malformed id + invalid type + invalid limit) with request-id — reusing the on-demand submitted job with a real JOB_EVENTS stream so the derived feed is non-empty. No unchecked CI row remained, so C172 was added under the Never-empty well; resolves the C171 CI live-smoke follow-up. Verified the exact embedded smoke script against a real ASGI server (333 checks OK, dynamically chosen free port) with YAML parse + actionlint v1.7.12 (`-shellcheck=`); frontend lint/1115 tests/build green and backend pytest (1053) green. Screens event-feed rendering remains a screens follow-up.
- 2026-11-19 — `4f4d25e` — C174 (screens): rendered the authoritative job event feed (C169/C171/C172 follow-up) via `useEventFeed` — a reusable `EventFeedPanel` on Jobs (workspace-wide) and project detail (project-scoped) with event-type/page-size filter chips, newest-first rows showing type/status badges, prettified operation label, short job id + seq, joined project name, message/error excerpt and recency, and Open buttons deep-linking to project detail, with all five UI states — every display value derived in 17 new tested `eventFeedHelpers` cases. Resolves the C172 screens follow-up; lint clean, 1132 tests, build green. My owned column had no unchecked rows, so C174 was added under the Never-empty well.
- 2026-11-19 — `60a203a` — C175 (mocks): wired the authoritative extension installation feed (C173 follow-up) end to end — `getExtensionFeed`/`useExtensionFeed` atomically across mockApi (newest-first `(installed_at, extension_id)` derivation over the `EXTENSIONS` seeds with a pure-JS uuid5 matching the backend's installation-derived id, manifest display fields + trust flags, `type`/`status` filters, whole-scope `total` before the `limit` page, no-install-time skip, router-style 422 for invalid type/status/limit + injectable `extensionFeed` failure), the stable ApiClient facade, live `httpApiClient` (`GET /extensions/feed?type=&status=&limit=`), queryKeys and useQueries, with a shared `lib/extensionFeed` derivation/validation helper and populated/empty/error tests; parity guard extended to both transports. Resolves the C173 mocks-transport follow-up; lint clean, 1154 tests, build green. My owned column had no unchecked rows, so C175 was added under the Never-empty well. Screens rendering + CI live-smoke probe are follow-ups.

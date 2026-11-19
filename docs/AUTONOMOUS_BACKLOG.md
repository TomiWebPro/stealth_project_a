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

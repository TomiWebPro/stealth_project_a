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

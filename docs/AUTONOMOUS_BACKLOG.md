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
   log at the bottom. Then take the next item. Keep going until ~15 minutes before
   your timeout — many small shippable changes per run, never just one.
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
| `studio-p1-backend-core` | `backend/**`, `frontend/src/types/**`, `docs/AUTONOMOUS_BACKLOG.md` (backend rows) | `frontend/src/{features,lib,hooks,api,app,layout,navigation,ui,styles}` |
| `studio-p1-screens` | `frontend/src/{app,layout,navigation,stores,ui,features,styles}`, `App.tsx`, `main.tsx`, `index.css`, backlog (screens rows) | `frontend/src/{types,lib,hooks,api}`, `backend/**`, `.github/**` |
| `studio-p1-mocks` | `frontend/src/{lib,hooks,api}`, `frontend/src/lib/mock/**`, backlog (mocks rows) | `frontend/src/{types,features,app,layout,navigation,ui,styles}`, `backend/**`, `.github/**` |
| `studio-p1-ci` | `.github/**`, repo config, CI/test tooling, backlog (CI rows) | product code under `frontend/src/**` or `backend/app/**` |

## Phase 2 — Backend hookup (OPEN — owner: backend-core, mocks, screens)

- [ ] P2.1 Operations/jobs API: `GET /operations` catalog + `GET/POST /jobs`,
  `GET /jobs/{id}`, `POST /jobs/{id}/cancel`, `POST /jobs/{id}/retry` backed by a
  repository + in-memory/SQLite store; respect `JobListQuery`, `JobError`,
  `JobEvent`. Add backend tests.
- [ ] P2.2 Providers + capability query API: `GET /providers`, `GET /providers/{id}`,
  `GET /capabilities` using existing schemas; add tests.
- [ ] P2.3 Orchestration API: plan/run endpoints, presence, comments, storage stats
  using existing `orchestration` schemas; add tests.
- [ ] P2.4 Auth/session API: login/refresh/session, organizations and members using
  existing `auth` schemas; dev-local auth adapter, no external IdP required yet.
- [ ] P2.5 Workspaces/extension registry API: list/install/enable/disable extensions
  with permission checks; a stub registry is fine as long as contracts hold.
- [ ] P2.6 Real-time job state: WebSocket or SSE stream for job events/presence,
  with a graceful polling fallback; document the contract.
- [ ] P2.7 Live-mode transport: finish `frontend/src/lib/httpApiClient.ts` against the
  new routers; make `VITE_API_MODE=live` work end-to-end without screen rewrites.
- [ ] P2.8 Wire screens to live mode behind the existing `ApiClient` interface; keep
  mock mode working. Add a contract/integration smoke test for both modes.

## Phase 3 — Asset management (owner: backend-core + screens)

- [ ] P3.1 Materialize the project folder tree (`docs/PROJECT_FOLDERS.md`) on disk:
  `Pipeline/`, `Projects/Default/`, `Assets/Char|Prop|Env`, `Shots/s01_c01`,
  `Output/` vs `Publish/`.
- [ ] P3.2 `Ver_NNN` ↔ `AssetVersion` mapping with immutable Publish copies and
  publish receipt sidecars.
- [ ] P3.3 Reference links (`.link.txt` fallback + `.links.json`) with dry-run plan
  mode; never copy weights.
- [ ] P3.4 Asset search/filter, previews and metadata editing in the UI.
- [ ] P3.5 Settings screen: backend URL, API mode, provider connections, test button.

## Phase 4 — First production capability (owner: backend-core + mocks + screens)

- [ ] P4.1 Provider adapters: local ComfyUI + cloud/RunPod adapter interfaces behind
  one execution contract; simulate locally so UI works without GPU.
- [ ] P4.2 Dataset-prep → ai-toolkit YAML → LoRA-train operation chain as real job
  operations with lineage.
- [ ] P4.3 First/last-frame + video generation operations with LoRA auto-mounting.
- [ ] P4.4 Splat/COLMAP + camera-path bridge operations (CPU smoke mode by default).
- [ ] P4.5 GPU validation harness: scripted end-to-end smoke run targeting
  `ssh gpu-reach` box; record real numbers, replace provisional mock values.
- [ ] P4.6 Chat screen: connect conversations API to a real orchestration loop with
  streaming events.

## Phase 5 — Extension platform (owner: backend-core + screens)

- [ ] P5.1 Manifest/schema + registration, install/remove, enable/disable.
- [ ] P5.2 Permission enforcement and isolation boundary for extensions.
- [ ] P5.3 SDK + connector examples; replace the Extensions placeholder screen.

## Phase 6 — Professional capabilities (owner: all)

- [ ] P6.1 Workspaces with collaboration roles and presence.
- [ ] P6.2 Multiple providers/local runtimes with health/degraded states.
- [ ] P6.3 Advanced lineage graph UI + audit trail.
- [ ] P6.4 Audio integration (TTS/dialogue hooks) behind capability flags.
- [ ] P6.5 Export paths to UE / Blender.

## Never-empty well (pick these when your column is otherwise done)

- [ ] C1 Expand backend tests for error envelopes, auth failures, pagination and
  concurrency; keep ≥90% coverage of routers.
- [ ] C2 Expand frontend tests for loading/error/empty/populated states on every
  screen and for live-vs-mock parity.
- [ ] C3 Accessibility pass: keyboard navigation, focus rings, ARIA labels, contrast.
- [ ] C4 Replace single-glyph navigation icons with a real icon set; add Tauri build
  job to CI with cached Rust target.
- [ ] C5 Add a real router ( History API deep links) without changing `RouteId`.
- [ ] C6 Docs accuracy pass: keep README, API.md, architecture docs and this backlog
  in sync with what is actually shipped.

## Log (append one line per completed item)

- 2026-11-17 — backlog created; Phase 2 declared open; backend agent revived.

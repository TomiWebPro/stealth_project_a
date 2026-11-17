# Agent Workflow

Roles: Principal Architect, Product Manager, UI/UX Designer, Frontend Architect, Desktop/Tauri, Backend Architect, Extension Platform, AI Orchestration, Asset Management, QA/Security.

Process: repository discovery -> specialist analysis -> architecture synthesis -> foundation prep -> approval -> implementation.

Rules: delegate only when useful; communicate via docs/contracts; no silent shared changes; document alternatives; report incomplete work honestly.

## Scheduled workforce (opencode-scheduler, `studio-p1-*`)

Four active jobs share this repo; each prompt is self-contained (agents have no
memory). Cadence is intentionally sparse (every 2h, staggered) with big per-run
batches: orientation is overhead, so each run ships item after item until ~15
min before its timeout instead of doing one thing and exiting. All three builder
jobs chain to `studio-p1-ci`, which verifies their combined output.

The authoritative execution queue is `docs/AUTONOMOUS_BACKLOG.md`. Phases 2–6
are all open; no job waits on a human decision. Agents make small reversible
choices, document them, and keep shipping.

| Job | Cadence | Owns (may write) | Never touches |
|-----|---------|------------------|---------------|
| `studio-p1-screens` | `10 */2 * * *`, 90 min | `frontend/src/app,layout,navigation,stores,ui,features,styles`, `App.tsx`, `main.tsx`, `index.css`, backlog (screens rows) | `frontend/src/{types,api,lib,hooks}`, `backend/`, `.github/` |
| `studio-p1-backend-core` | `25 */2 * * *`, 90 min | `backend/**`, `frontend/src/types/**`, backlog (backend rows) | other frontend dirs |
| `studio-p1-mocks` | `40 */2 * * *`, 90 min | `frontend/src/lib`, `frontend/src/hooks`, `frontend/src/api` (incl. `lib/mock`), backlog (mocks rows) | `frontend/src/types`, `backend/`, UI dirs |
| `studio-p1-ci` | `55 */2 * * *`, 45 min | `.github/`, repo config, tooling, backlog (CI rows) | product code (reports failures with owner instead) |

Rules for scheduled agents:

- Contract parity: `frontend/src/types` mirrors `backend/app/schemas`
  (checked by backend contract tests). Neither side changes alone; the backend
  job owns both sides atomically.
- New mock queries land atomically: `mockApi` + `ApiClient` + `httpApiClient`
  + `queryKeys` + `useQueries` + test, in one run.
- Definition of done: `npm run lint`, `npm test`, `npm run build` green
  (frontend jobs); `python3 -m pytest -q` green (backend job).
- Blocked by another area: note owner in the final report, move to next item.
- **Never idle.** Do not report `QUEUE-EMPTY` / `ALL-GREEN` and exit while any
  unchecked backlog item exists that you could start. If your owned column is
  empty, add the next useful improvement to the Never-empty well and ship it.
- Never mark work "blocked on human", "gated", or "needs approval".

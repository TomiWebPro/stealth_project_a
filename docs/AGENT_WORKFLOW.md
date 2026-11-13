# Agent Workflow

Roles: Principal Architect, Product Manager, UI/UX Designer, Frontend Architect, Desktop/Tauri, Backend Architect, Extension Platform, AI Orchestration, Asset Management, QA/Security.

Process: repository discovery -> specialist analysis -> architecture synthesis -> foundation prep -> approval -> implementation.

Rules: delegate only when useful; communicate via docs/contracts; no silent shared changes; document alternatives; report incomplete work honestly.

## Scheduled workforce (opencode-scheduler, `studio-p1-*`)

Four jobs share this repo; each prompt is self-contained (agents have no memory).
Cadence is intentionally sparse (every 2h, staggered) with big per-run batches:
orientation is overhead, so each run ships item after item until ~15 min before
its timeout instead of doing one thing and exiting.

| Job | Cadence | Owns (may write) | Never touches |
|-----|---------|------------------|---------------|
| `studio-p1-screens` | `10 */2 * * *`, 90 min | `frontend/src/app,layout,navigation,stores,ui,features,styles`, `App.tsx`, `main.tsx`, `index.css` | `frontend/src/{types,api,lib,hooks}`, `backend/`, `.github/` |
| `studio-p1-mocks` | `40 */2 * * *`, 90 min | `frontend/src/lib`, `frontend/src/hooks` (incl. `lib/mock`) | `frontend/src/types`, `frontend/src/api`, `backend/`, UI dirs |
| `studio-p1-ci` | `55 */2 * * *`, 45 min | `.github/`, repo config only | product code (reports failures with owner instead) |
| `studio-p1-backend-core` | DISABLED (parked) | `backend/` when Phase 2 opens | `backend/app/schemas` without contracts coordination |

Rules for scheduled agents:

- Frontend-only phase: no `backend/` changes until a human opens Phase 2.
- Contract parity: `frontend/src/types` mirrors `backend/app/schemas`
  (checked by backend contract tests). Neither side changes alone.
- New mock queries land atomically: `mockApi` + `ApiClient` + `httpApiClient`
  + `queryKeys` + `useQueries` + test, in one run.
- Definition of done: `npm run lint`, `npm test`, `npm run build` green
  (frontend jobs); `python3 -m pytest -q` green (backend, when open).
- Blocked by another area: note owner in the final report, move to next item.
- Queue empty and checks green: report `QUEUE-EMPTY` / `ALL-GREEN` fast,
  no padding.

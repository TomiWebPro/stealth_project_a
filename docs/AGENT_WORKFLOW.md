# Agent Workflow

Roles: Principal Architect, Product Manager, UI/UX Designer, Frontend Architect, Desktop/Tauri, Backend Architect, Extension Platform, AI Orchestration, Asset Management, QA/Security.

Process: repository discovery -> specialist analysis -> architecture synthesis -> foundation prep -> approval -> implementation.

Rules: delegate only when useful; communicate via docs/contracts; no silent shared changes; document alternatives; report incomplete work honestly.

## Scheduled workforce (opencode-scheduler, `studio-p1-*`)

Four active jobs share this repo; each prompt is self-contained (agents have no
memory). They run as a **completion-driven relay loop**, not on a fixed cron
cadence:

```
studio-p1-backend-core -> studio-p1-screens -> studio-p1-mocks -> studio-p1-ci
        ^                                                                |
        +-------------------------(ALWAYS)--------------------------------+
```

Each job is `@once`; the scheduler re-arms the next job the instant the current
one finishes (`--on ALWAYS`, so a failure never stalls the loop). Only the root
job starts on setup; there is no wait time between agents. The timeout is a
safety cap only — agents finish promptly once a complete batch ships, then hand
off. The loop needs no human input and never idles.

The authoritative execution queue is `docs/AUTONOMOUS_BACKLOG.md`. Phases 2–6
are all open; no job waits on a human decision. Agents make small reversible
choices, document them, and keep shipping.

| Job | Loop position | Owns (may write) | Never touches |
|-----|---------------|------------------|---------------|
| `studio-p1-backend-core` | root → screens | `backend/**`, `frontend/src/types/**`, backlog (backend rows) | other frontend dirs |
| `studio-p1-screens` | after backend → mocks | `frontend/src/app,layout,navigation,stores,ui,features,styles`, `App.tsx`, `main.tsx`, `index.css`, backlog (screens rows) | `frontend/src/{types,api,lib,hooks}`, `backend/`, `.github/` |
| `studio-p1-mocks` | after screens → ci | `frontend/src/lib`, `frontend/src/hooks`, `frontend/src/api` (incl. `lib/mock`), backlog (mocks rows) | `frontend/src/types`, `backend/`, UI dirs |
| `studio-p1-ci` | after mocks → backend | `.github/`, repo config, tooling, backlog (CI rows) | product code (reports failures with owner instead) |

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

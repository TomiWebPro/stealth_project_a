# Professional AI Creative Studio Platform

Cross-platform desktop application for AI-assisted creative production.

This repository is the grand platform implementation (not the legacy Backlot MVP). It follows the architecture brief in `docs/`.

## Status

Phase 1 frontend shell implemented: reusable layout (header/sidebar/main), design
tokens, mock API client (TanStack Query + Zustand), and a Home screen wired to
mock data. Backend and remaining phases in progress.

## Stack (target)

- Desktop: Tauri 2 + React + TypeScript + Tailwind + shadcn/ui
- Frontend state: Zustand + TanStack Query
- Backend: Python + FastAPI + PostgreSQL + S3-compatible storage + Redis (when justified)
- Real-time: WebSockets
- Execution: provider adapters (local/studio/cloud/ComfyUI)

## Continuous integration

`.github/workflows/ci.yml` runs on pushes to `main`, pull requests, and manual
dispatches, with two Linux jobs:

- **Frontend** — `npm ci`, `npm run lint`, `npm test` (Vitest), `npm run build`.
- **Backend** — installs `requirements.txt` + `requirements-dev.txt`, runs
  `python -m pytest -q` on Python 3.12 (includes the frontend/backend contract
  parity tests, so it needs the full repo checkout).

Caching: `actions/setup-node` caches `~/.npm` keyed by
`frontend/package-lock.json`; `actions/setup-python` caches pip downloads keyed
by both requirements files.

Reproduce locally from the repository root:

```bash
cd frontend && npm ci && npm run lint && npm test && npm run build
cd ../backend && python3 -m pytest -q
```

The Tauri/Rust shell is not built in CI yet; a Rust job will need the Linux
WebKit/GTK packages plus a `src-tauri/target` cache.

## Getting started

See `docs/DEVELOPMENT_ROADMAP.md` and `AGENTS.md`.

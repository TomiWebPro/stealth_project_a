# Professional AI Creative Studio Platform

Cross-platform desktop application for AI-assisted creative production.

This repository is the grand platform implementation (not the legacy Backlot MVP). It follows the architecture brief in `docs/`.

## Status

Phase 1b is shipped: reusable desktop shell (Tauri 2 + React + TS), design
tokens, full mock data layer, and mock-backed Home / Projects / Assets / Jobs /
Providers / Workspaces screens (lineage, version chains, shot grouping, workflow
templates). Phase 2 backend hookup is **open and actively developed** by
scheduled agents; all remaining work is tracked in `docs/AUTONOMOUS_BACKLOG.md`.
The frontend still defaults to mock mode until `VITE_API_MODE=live` is switched
on. CI, lint, frontend tests (46) and backend tests (148) are green.

## Stack (target)

- Desktop: Tauri 2 + React + TypeScript + Tailwind + shadcn/ui
- Frontend state: Zustand + TanStack Query
- Backend: Python + FastAPI + PostgreSQL + S3-compatible storage + Redis (when justified)
- Real-time: WebSockets
- Execution: provider adapters (local/studio/cloud/ComfyUI)

## Continuous integration

`.github/workflows/ci.yml` runs on pushes to `main`, pull requests, and manual
dispatches, with three Linux jobs:

- **Frontend** — `npm ci`, `npm run lint`, `npm test` (Vitest), `npm run build`.
- **Backend** — installs `requirements.txt` + `requirements-dev.txt`, runs
  `python -m pytest -q` on Python 3.12 (includes the frontend/backend contract
  parity tests, so it needs the full repo checkout).
- **Tauri shell** — installs WebKit/GTK build dependencies, builds the frontend,
  then compiles the Rust shell with `npx tauri build --no-bundle` on stable Rust.

Caching: `actions/setup-node` caches `~/.npm` keyed by
`frontend/package-lock.json`; `actions/setup-python` caches pip downloads keyed
by both requirements files; `Swatinem/rust-cache` caches the Cargo registry and
`frontend/src-tauri/target` keyed by the Cargo manifests/lockfile.

Reproduce locally from the repository root:

```bash
cd frontend && npm ci && npm run lint && npm test && npm run build
cd ../backend && python3 -m pytest -q
```

The Tauri/Rust shell is compiled in CI by the **Tauri shell** job (Webkit/GTK
packages are installed via `apt`); it uses `--no-bundle` so CI verifies the
Rust build without producing installers.

## Getting started

See `docs/DEVELOPMENT_ROADMAP.md` and `AGENTS.md`.

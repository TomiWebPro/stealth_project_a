# Frontend — Studio Platform

React + TypeScript (Vite) frontend for the Studio Platform desktop app.
Runs inside the Tauri shell (`src-tauri/`) but builds independently as a plain
web app for fast iteration.

## Scripts

```bash
npm run dev      # Vite dev server (mock API by default)
npm run build    # tsc -b (type-check) && vite build -> dist/
npm run preview  # serve the production build
npm run lint     # oxlint
npm test         # vitest run
```

## Configuration

Environment is read in one place — `src/lib/env.ts`:

| Variable            | Default                     | Purpose                                  |
| ------------------- | --------------------------- | ---------------------------------------- |
| `VITE_API_MODE`     | `mock`                      | `mock` uses in-memory data; `live` uses HTTP |
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Backend origin when `live`            |

Phase 1 ships on the mock client so the UI can be built before the backend is
available.

## Architecture

```
src/
  main.tsx           App bootstrap: QueryClientProvider + popstate sync
  App.tsx            Composes ApiProvider + AppLayout + active screen
  layout/            Reusable shell: AppLayout (header/sidebar/main), AppHeader, AppSidebar
  navigation/        Route model (route ids, nav groups, path <-> route helpers)
  stores/            Zustand UI store (active route, sidebar collapsed)
  hooks/             TanStack Query hooks (useHomeSummary, useProjects, ...)
  lib/
    env.ts           Validated environment config
    apiClient.ts     ApiClient interface + mock implementation facade
    createApiClient.ts  Resolves mock vs live client from env
    httpApiClient.ts Live HTTP implementation of ApiClient
    queryKeys.ts     Centralised query keys (part of the caching contract)
    mock/            Mock data + transport (same shapes as backend contracts)
    types.ts         Re-export surface for shared API contracts
    homeSummary.ts   Home screen view models
  types/             Canonical API contracts (mirror backend/app/schemas)
  api/               Typed transport + per-resource clients for the live API
  features/          Screens (home/, PlaceholderScreen)
  ui/                Design-system primitives (Button, Card, Badge, ...)
  styles/tokens.css  Design tokens (colors, radii, type scale) — source of truth
```

### Data flow

Screens call query hooks → hooks call the injected `ApiClient` → the client is
either the mock (`lib/mock`) or the live HTTP client. Components never import
the mock directly. Swapping mock for live touches only `createApiClient`/env.

### Styling

Design tokens live in `src/styles/tokens.css` and are exposed to Tailwind v4
via `@theme inline` in `src/index.css`. Use the token-derived utilities
(`bg-surface`, `text-content`, `text-2xs`, `duration-(--duration-fast)`, …)
rather than hardcoded colors/sizes.

## Constraints

- Strict TypeScript; no `any` (enforced by `tsconfig.app.json` incl.
  `noUncheckedIndexedAccess`).
- Shared interfaces in `src/types` mirror the backend and are parity-checked —
  do not change them silently.

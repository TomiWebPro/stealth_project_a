# Studio Platform Backend

FastAPI application implementing the stable application API (`/api/v1`). The
backend is authoritative for jobs and assets; routers depend only on contracts
in `app/schemas`, never on provider/GPU internals.

## Run

```bash
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

OpenAPI docs: `http://127.0.0.1:8000/docs`.

`python` is not available on all dev machines; use `python3` (or activate a
virtualenv, which provides `python`).

## Storage

| `STUDIO_STORAGE` | Behaviour |
| --- | --- |
| `memory` (default) | Process-local, discarded on restart. Used by tests. |
| `sqlite` | Durable local JSON-document store at `STUDIO_SQLITE_PATH`. |

Both implement `app.storage.base.DocumentStore`, so a PostgreSQL-backed store
can be added without changing routers or repositories.

Other environment variables:

- `STUDIO_SQLITE_PATH` (default `data/studio.db`)
- `STUDIO_UPLOAD_DIR` (default `data/uploads`)
- `STUDIO_ROOT` (default `data/studio`) — on-disk project tree root
- `STUDIO_MAX_UPLOAD_BYTES` (default 512 MiB)
- `STUDIO_STORAGE_QUOTA_BYTES` (default 10 GiB) — reported by `/storage/stats`
- `STUDIO_DEFAULT_ORG_ID`, `STUDIO_DEFAULT_USER_ID`
- `STUDIO_CORS_ORIGINS` (comma separated), `STUDIO_CORS_ALLOW_CREDENTIALS`

## Endpoints

All paths are prefixed with `/api/v1`.

- **Core:** `GET /health`, `GET /version`
- **Activity:** `GET /activity?project_id=&kind=&limit=` — newest-first workspace
  activity (asset/publish/job/comment events with actor and project context)
  derived from the authoritative stores; scoped by `project_id` or workspace-wide
- **Dashboard:** `GET /dashboard?recent_limit=` — authoritative workspace snapshot
  (entity counts, zero-filled job-status/asset-type breakdowns and the newest
  jobs/assets) derived from the stores; deleted assets are excluded
- **Projects:** `GET|POST /projects`, `GET|PATCH|DELETE /projects/{id}`,
  `GET /projects/stats?org_id=` — authoritative portfolio metrics (lifecycle
  breakdown, cross-domain totals/averages, recency) derived from the stores;
  soft-deleted assets are excluded

- **Project tree:** `GET|POST /projects/{id}/tree`,
  `POST /projects/{id}/links/{plan|apply}`, `GET /projects/{id}/links`
- **Conversations:** `GET /conversations?project_id=`,
  `POST /projects/{id}/conversations`, `GET /conversations/{id}`,
  `GET|POST /conversations/{id}/messages`
- **Assets:** `GET /assets`, `POST /assets/register`,
  `GET|PATCH|DELETE /assets/{id}`,
  `GET|POST /assets/{id}/versions`, `GET /assets/{id}/relationships|lineage|download|content`,
  `GET|POST /assets/{id}/publish`, `GET|POST /assets/{id}/exports`,
  `GET /assets/stats?project_id=` — inventory metrics (zero-filled type/status
  breakdowns, stored bytes, version revisions, recency) derived from the asset
  store; deleted assets are excluded
- **Uploads:** `POST /uploads`, `PUT /uploads/{id}`, `GET /uploads/{id}/content`
- **Operations/jobs:** `GET /operations`, `GET /operations/{id}`,
  `GET|POST /jobs`, `GET /jobs/{id}`, `GET /jobs/{id}/events`,
  `POST /jobs/{id}/cancel|retry|run`,
  `GET /jobs/{id}/events/stream` (SSE, `since`/`idle_timeout`)
- **Providers/adapters:** `GET /providers`, `GET /providers/{id}`,
  `GET /capabilities`, `GET /adapters`, `GET /adapters/{id}/health`
- **Orchestration/collaboration:** `GET|POST /orchestration/plans`,
  `GET|POST /orchestration/runs`, `GET /orchestration/plans/{id}`,
  `GET /orchestration/runs/{id}`, `GET|POST /presence`,
  `GET|POST /comments`, `GET /storage/stats`
- **Auth/orgs:** `POST /auth/login|refresh`, `GET /auth/session|me`,
  `GET|POST /orgs` (alias `/organizations`), `GET /orgs/{id}`,
  `GET|POST /orgs/{id}/members`
- **Extensions:** `GET /extensions/registry`, `GET /extensions`,
  `POST /extensions/install`, `GET /extensions/{id}`,
  `POST /extensions/{id}/enable|disable`, `DELETE /extensions/{id}`
- **Pipelines:** `GET|POST /pipelines/lora`, `/pipelines/shot`, `/pipelines/splat`
  (each with `GET /pipelines/<kind>/{id}`)
- **Exports:** `GET /projects/{id}/exports`, `GET /assets/{id}/exports`
- **Search:** `GET /search?q=&kind=&limit=` — ranked, best-first project/asset/
  conversation matches derived from the authoritative stores (no second index);
  blank queries and no-match queries return an empty `results` list
- **Tags:** `GET /tags?project_id=&prefix=&limit=` — most-used-first asset tag
  facets (count of non-deleted assets per tag) derived from the authoritative
  store; optional case-insensitive prefix filter for autocomplete

All non-2xx responses use the shared `ErrorResponse` envelope with an
`X-Request-ID` header. Bearer tokens from `POST /auth/login` authenticate
`/auth/me` and `/auth/session`; other endpoints accept `X-User-Id`/`X-Org-Id`
headers or the configured development identities.

## Testing

```bash
cd backend
python3 -m pytest -q
```

Tests run every API test against both storage backends, verify SQLite
persistence across restarts, and check Pydantic/TypeScript contract parity in
`tests/test_contract_parity.py`.

## Boundaries / integration dependencies

- **Auth**: dev-local adapter only. Tokens are opaque random strings in the
  document store; no external IdP, JWT verification or password hashing yet.
- **Uploads**: dev-local filesystem adapter. The ticket contract is stable; an
  S3 adapter will return real presigned URLs.
- **Assets**: version 1 is recorded on registration; `POST /assets/{id}/versions`
  creates subsequent versions. Publishing copies bytes into `Publish/` with a
  `_vNNN` suffix and a JSON receipt; re-publishing different bytes for the same
  version is rejected.
- **Real-time**: job events stream over SSE (`/jobs/{id}/events/stream`) with a
  polling fallback (`GET /jobs/{id}/events`). Presence is polled via
  `/presence`; the shared `StreamEvent` contract is not wired to a conversation
  WebSocket yet.
- **Adapters/execution**: local and cloud runtimes are CPU-only simulations
  behind one `ExecutionAdapter` contract. No ComfyUI/RunPod/GPU connection yet
  (see P4.5 in the backlog).
- **Pagination**: asset `cursor` is the last asset ID from the previous page
  (keyset). The shared `Asset[]` response has no `next_cursor`; this limitation
  is tracked for a future contract revision.

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
  `GET /activity/stats?project_id=` — authoritative activity metrics (zero-filled
  per-kind breakdown, per-project event/participant counts, distinct participant
  total and newest-event recency) derived from the same event stream; optional
  project scope with shared 404/422 envelopes
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
  `GET /lineage/stats?project_id=` — authoritative lineage metrics (zero-filled
  relationship-type breakdown, per-project link counts, distinct live-asset count
  and newest-link recency) derived from the asset relationship store; links from
  soft-deleted/unknown source assets are excluded
  `GET /versions/stats?project_id=` — authoritative version metrics (total version
  records, distinct versioned assets, revision count, by-version distribution,
  per-project activity and newest-version recency) derived from the asset version
  store; versions of soft-deleted/unknown assets are excluded, optional project
  scope with shared 404/422 envelopes
  `GET /publishes/stats?project_id=` — authoritative publish metrics (total
  published assets and bytes, by-version distribution, per-project activity and
  newest-publish recency) derived from publish receipts in the asset store;
  soft-deleted/unpublished assets and malformed receipts are excluded
- **Uploads:** `POST /uploads`, `PUT /uploads/{id}`, `GET /uploads/{id}/content`,
  `GET /uploads/stats?project_id=` — authoritative upload-ticket metrics
  (zero-filled pending/complete breakdown, per-project activity, completed byte
  totals and newest-ticket recency) derived from the upload store; optional
  project scope with shared 404/422 envelopes
- **Operations/jobs:** `GET /operations`, `GET /operations/{id}`,
  `GET /operations/stats` — authoritative catalog metrics (total/streaming/
  provider coverage, setting counts and zero-free asset-type breakdowns) derived
  from the operation catalog
  `GET|POST /jobs`, `GET /jobs/{id}`, `GET /jobs/{id}/events`,
  `POST /jobs/{id}/cancel|retry|run`,
  `GET /jobs/{id}/events/stream` (SSE, `since`/`idle_timeout`)
  `GET /jobs/{id}/logs?level=&since_seq=&limit=` — authoritative per-job
  execution log (chronological, severity-filtered, cursor-paginated entries with
  a total) derived from the job event store; shared 404/422 envelopes
  `GET /events/stats?project_id=` — authoritative job-event stream metrics
  (zero-filled event-type breakdown, per-job event counts with recency and
  newest-event recency) derived from the authoritative job event store; an
  optional project scope joins events to jobs with shared 404/422 envelopes
  `GET /retries/stats?project_id=` — authoritative job retry metrics
  (zero-filled retried-jobs-by-status breakdown, per-project retry/job counts,
  accepted-retry totals and newest retried-job activity) derived from the
  authoritative `JOB_RETRIES` idempotency ledger joined to jobs; orphaned
  entries are excluded and an optional project scope uses shared 404/422
  envelopes
- **Providers/adapters:** `GET /providers`, `GET /providers/{id}`,
  `GET /providers/stats?location=&status=` — authoritative fleet metrics
  (zero-filled health/location breakdowns, capability/operation coverage) derived
  from the provider store, with optional location/status filters
  `GET /capabilities`, `GET /adapters`, `GET /adapters/{id}/health`
- **Orchestration/collaboration:** `GET|POST /orchestration/plans`,
  `GET|POST /orchestration/runs`, `GET /orchestration/plans/{id}`,
  `GET /orchestration/runs/{id}`, `GET /orchestration/stats?project_id=` —
  authoritative orchestration metrics (zero-filled lifecycle-stage breakdown,
  per-project plan/run activity, plan-step and linked-job totals, newest-plan/run
  recency) derived from the plan/run stores; runs are joined to plans for project
  attribution and unknown `project_id` uses the shared 404 envelope
  `GET|POST /presence`,
  `GET|POST /comments`, `GET /storage/stats`,
  `GET /collaboration/stats?project_id=` — authoritative collaboration metrics
  (zero-filled presence-state breakdown, per-project activity counts, distinct
  participant count and newest-signal recency) derived from the presence/comment
  stores; optional project scope with shared 404/422 envelopes
- **Auth/orgs:** `POST /auth/login|refresh`, `GET /auth/session|me`,
  `GET|POST /orgs` (alias `/organizations`), `GET /orgs/{id}`,
  `GET|POST /orgs/{id}/members`,
  `GET /orgs/stats?org_id=` (alias `/organizations/stats`) — authoritative
  membership metrics (organization/member/user totals, zero-filled role
  breakdown, per-organization counts, average and recency) derived from the
  auth store; optional org scope with shared 422 envelope
- **Extensions:** `GET /extensions/registry`, `GET /extensions`,
  `POST /extensions/install`, `GET /extensions/{id}`,
  `POST /extensions/{id}/enable|disable`, `DELETE /extensions/{id}`,
  `GET /extensions/stats?type=&status=` — authoritative registry/installation
  metrics (zero-filled type/status breakdowns, trust flags, permission/capability
  coverage) derived from the extension stores, with optional type/status filters
- **Pipelines:** `GET|POST /pipelines/lora`, `/pipelines/shot`, `/pipelines/splat`
  (each with `GET /pipelines/<kind>/{id}`)
  `GET /pipelines/stats?project_id=` — authoritative production-pipeline metrics
  (zero-filled per-kind chain/job/asset breakdowns, per-project chain counts,
  totals and newest-chain recency) derived from the chain stores; unknown
  `project_id` uses the shared 404 envelope
- **Exports:** `GET /projects/{id}/exports`, `GET /assets/{id}/exports`
- **Search:** `GET /search?q=&kind=&limit=` — ranked, best-first project/asset/
  conversation matches derived from the authoritative stores (no second index);
  blank queries and no-match queries return an empty `results` list
  `GET /search/stats?project_id=` — authoritative index-coverage metrics (zero-filled
  per-kind document counts, total, newest-document recency) derived from the same
  stores the search reads; soft-deleted assets are excluded, optional project scope
  with shared 404/422 envelopes
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

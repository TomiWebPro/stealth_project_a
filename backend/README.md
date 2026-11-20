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
  `GET /projects/feed?org_id=&lifecycle=&limit=` — authoritative newest-first
  project feed (org-name join, lifecycle label, whole-scope total before the
  page) derived fresh from the project store;
  `GET /projects/stats?org_id=` — authoritative portfolio metrics (lifecycle
  breakdown, cross-domain totals/averages, recency) derived from the stores;
  soft-deleted assets are excluded;
  `GET /projects/{id}/overview?recent_limit=` — authoritative single-project
  snapshot (identity + lifecycle, cross-domain counts and the newest jobs/assets)
  derived fresh from the stores; soft-deleted assets are excluded; unknown project
  uses the shared 404 envelope

- **Project tree:** `GET|POST /projects/{id}/tree`,
  `POST /projects/{id}/links/{plan|apply}`, `GET /projects/{id}/links`
- **Conversations:** `GET /conversations?project_id=`,
  `POST /projects/{id}/conversations`, `GET /conversations/{id}`,
  `GET|POST /conversations/{id}/messages`,
  `GET /conversations/feed?project_id=&limit=` — newest-first conversation feed
  (conversation/project identity with joined project name, title, message count
  and a last-message role/excerpt preview) derived from the authoritative
  conversation/message stores, with a whole-scope `total` before the `limit` page
  and a deterministic `(updated_at, conversation_id)` tie-break;
  `GET /conversations/stats?project_id=` — authoritative conversation metrics
  (zero-filled role/status breakdowns, totals, average and recency) derived from
  the conversation/message stores; optional project scope with shared 404/422
  envelopes; `GET /conversations/{id}/overview?recent_limit=` — compact
  single-conversation snapshot with identity, zero-filled role/status message
  breakdowns, a last-message role/excerpt preview and the newest messages,
  derived fresh from the conversation/message stores (no second index; shared
  404 `conversation_not_found` / 422 envelopes)
- **Assets:** `GET /assets`, `POST /assets/register`,
  `GET|PATCH|DELETE /assets/{id}`,
  `GET|POST /assets/{id}/versions`, `GET /assets/{id}/relationships|lineage|download|content`,
  `GET|POST /assets/{id}/publish`, `GET|POST /assets/{id}/exports`,
  `GET /assets/feed?project_id=&limit=` — newest-first asset feed (asset/project
  identity with joined project name, type/name/status, version, byte size and
  created/updated timestamps; whole-scope `total` before the `limit` page)
  derived from the asset store; deleted assets are excluded
  `GET /assets/stats?project_id=` — inventory metrics (zero-filled type/status
  breakdowns, stored bytes, version revisions, recency) derived from the asset
  store; deleted assets are excluded
  `GET /assets/{id}/overview?recent_limit=` — single-asset snapshot (identity +
  joined project name, current version, published flag, cross-domain counts for
  versions/upstream/downstream/comments/tags and the newest version records)
  derived from the authoritative stores; lineage counts reuse the relationship
  set and the published flag reuses the publish receipt parser
  `GET /lineage/stats?project_id=` — authoritative lineage metrics (zero-filled
  relationship-type breakdown, per-project link counts, distinct live-asset count
  and newest-link recency) derived from the asset relationship store; links from
  soft-deleted/unknown source assets are excluded
  `GET /lineage/feed?project_id=&limit=` — newest-first asset lineage feed (typed
  relationship with both endpoint asset names and joined project name; whole-scope
  `total` before the `limit` page) derived from the relationship store with a
  deterministic `(created_at, id)` tie-break; links from soft-deleted/unknown
  source assets are excluded
  `GET /lineage/{relationship_id}/overview?recent_limit=` — compact single-relationship
  snapshot (both endpoint assets' identity/type with joined names, project context,
  whole-source-asset upstream/downstream/type/project counts reusing the canonical
  relationship set, and a bounded newest-first `recent_relationships` page reusing
  `LineageFeedItem`) derived fresh from the relationship store; links from
  soft-deleted/unknown source assets are excluded (shared 404
  `relationship_not_found` / 422 envelopes)
  `GET /versions/stats?project_id=` — authoritative version metrics (total version
  records, distinct versioned assets, revision count, by-version distribution,
  per-project activity and newest-version recency) derived from the asset version
  store; versions of soft-deleted/unknown assets are excluded, optional project
  scope with shared 404/422 envelopes
  `GET /versions/feed?project_id=&limit=` — newest-first asset version feed
  (asset/project identity with joined project name, asset name/type, version
  number, creator and creation time; whole-scope `total` before the `limit` page)
  derived from the version store with a deterministic `(created_at, asset_id,
  version)` tie-break; versions of soft-deleted/unknown assets are excluded
  `GET /assets/{asset_id}/versions/{version}/overview?recent_limit=` — authoritative
  single-version snapshot (the requested version's identity and storage, joined
  parent-asset/project context, `is_latest` flag, whole-asset version/revision
  counts that reuse `/versions/stats` semantics and a bounded newest-first sibling
  list); unknown asset → shared 404 `asset_not_found`, unknown version → shared 404
  `version_not_found`, malformed path/`recent_limit` → shared 422 envelope
  `GET /publishes?project_id=&limit=` — newest-first publish feed of published
  deliverables (asset/project id + name, type, receipt version/bytes, publish
  time) derived from the same authoritative receipts; soft-deleted/unpublished
  assets and malformed receipts are excluded
  `GET /publishes/stats?project_id=` — authoritative publish metrics (total
  published assets and bytes, by-version distribution, per-project activity and
  newest-publish recency) derived from publish receipts in the asset store;
  soft-deleted/unpublished assets and malformed receipts are excluded
- **Uploads:** `POST /uploads`, `PUT /uploads/{id}`, `GET /uploads/{id}/content`,
  `GET /uploads/feed?project_id=&limit=` — newest-first upload-ticket feed (ticket
  + project identity, filename/content type, lifecycle status, declared/uploaded
  bytes and creation/expiry times) derived from the upload store, with a whole-scope
  `total` before the `limit` page and a deterministic `(created_at, upload_id)` tie-break;
  `GET /uploads/stats?project_id=` — authoritative upload-ticket metrics
  (zero-filled pending/complete breakdown, per-project activity, completed byte
  totals and newest-ticket recency) derived from the upload store; optional
  project scope with shared 404/422 envelopes;
  `GET /uploads/{id}/overview` — single-ticket snapshot (identity, joined project
  name, byte accounting, derived remaining/progress/expiry and whole-project
  upload activity reusing the stats per-project bucket); unknown ticket → shared
  404 `upload_not_found`, malformed id → shared 422 envelope
- **Operations/jobs:** `GET /operations`, `GET /operations/{id}`,
  `GET /operations/feed?streaming=&provider_id=&limit=` — deterministic operation
  catalog feed (identity/display, asset types, settings count, streaming flag and
  sorted/deduplicated provider bindings; whole-scope `total` before the bounded
  page) projected fresh from the authoritative catalog, with optional
  `streaming`/`provider_id` filters;
  `GET /operations/{operation_id}/overview` — authoritative single-operation
  snapshot (catalog identity/shape, declared provider ids and the actual
  advertising fleet with advertised-vs-catalog schema-drift flags, plus
  zero-filled shape/coverage counts) derived from the catalog + provider store;
  shared 404 envelope for an unknown operation;
  `GET /operations/stats` — authoritative catalog metrics (total/streaming/
  provider coverage, setting counts and zero-free asset-type breakdowns) derived
  from the operation catalog
  `GET|POST /jobs`, `GET /jobs/{id}`, `GET /jobs/{id}/events`,
  `POST /jobs/{id}/cancel|retry|run`,
  `GET /jobs/{id}/events/stream` (SSE, `since`/`idle_timeout`)
  `GET /jobs/{id}/logs?level=&since_seq=&limit=` — authoritative per-job
  execution log (chronological, severity-filtered, cursor-paginated entries with
  a total) derived from the job event store; shared 404/422 envelopes
  `GET /jobs/queue?project_id=&limit=` — authoritative dispatch queue (active
  queued/running jobs in FIFO order with positions, whole-queue waiting/running
  counters and a bounded page) derived from the job store; shared 404/422 envelopes
  `GET /jobs/feed?project_id=&status=&limit=` — authoritative newest-first job
  feed (project-name join, lifecycle fields and whole-scope total before the
  bounded page) derived from the job store; shared 404/422 envelopes
  `GET /jobs/{job_id}/overview?recent_limit=` — authoritative single-job snapshot
  (identity + terminal result/error, joined project name, event/retry totals with
  a zero-filled event-type breakdown, and the newest events bounded by
  `recent_limit`) derived fresh from the job/event/retry stores; shared 404/422
  envelopes
  `GET /events/feed?project_id=&type=&limit=` — authoritative newest-first job
  event feed (operation/project-name join, all event lifecycle fields and a
  whole-scope total before the bounded page) derived from the job event store;
  `/events/stats` aggregates the same stream. Orphan events are excluded; shared
  404/422 envelopes
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
  `GET /retries/feed?project_id=&limit=` — authoritative newest-first feed of
  retried jobs derived from the same `JOB_RETRIES` ledger joined to jobs/projects
  (operation/lifecycle fields, accepted-retry count and joined project name;
  whole-scope `total` before the bounded page); orphan entries are excluded and
  an optional project scope uses shared 404/422 envelopes
- **Providers/adapters:** `GET /providers`, `GET /providers/{id}`,
  `GET /providers/feed?location=&status=&limit=` — deterministic provider feed
  (identity/health, sorted advertised operation ids and capability count;
  whole-scope `total` before the bounded page) derived fresh from the provider
  store, with optional location/status filters;
  `GET /providers/stats?location=&status=` — authoritative fleet metrics
  (zero-filled health/location breakdowns, capability/operation coverage) derived
  from the provider store, with optional location/status filters
  `GET /providers/{id}/overview` — authoritative single-provider snapshot
  (identity/health, sorted advertised operation ids, capability/coverage totals
  and catalog-backed operations with advertised-vs-catalog schema matching)
  joined fresh from the provider store and the versioned operation catalog;
  unknown provider uses the shared 404 `provider_not_found` envelope
  `GET /capabilities`, `GET /adapters`, `GET /adapters/{id}/health`
- **Orchestration/collaboration:** `GET|POST /orchestration/plans`,
  `GET|POST /orchestration/runs`, `GET /orchestration/plans/{id}`,
  `GET /orchestration/runs/{id}`, `GET /orchestration/stats?project_id=` —
  authoritative orchestration metrics (zero-filled lifecycle-stage breakdown,
  per-project plan/run activity, plan-step and linked-job totals, newest-plan/run
  recency) derived from the plan/run stores; runs are joined to plans for project
  attribution and unknown `project_id` uses the shared 404 envelope
  `GET /orchestration/feed?project_id=&kind=&limit=` — authoritative newest-first
  feed of plans and runs derived from the same plan/run stores (kind + project
  scope, joined project name, plan-step/run-job counts, whole-scope total before
  the `limit` page; orphan runs excluded, shared 404/422 envelopes)
  `GET /orchestration/plans/{plan_id}/overview?recent_limit=` — compact single-plan
  snapshot (identity + joined project name, whole-scope step/run/job totals,
  zero-filled run-stage breakdown shared with `/orchestration/stats` and newest
  runs bounded by `recent_limit`) derived fresh from the plan/run stores; unknown
  plan uses the shared 404 `plan_not_found` envelope
  `GET /orchestration/runs/{run_id}/overview?recent_limit=` — compact single-run
  snapshot (run identity + joined plan/project context, whole-scope linked/resolved
  job and plan-step counts, zero-filled job-status breakdown shared with
  `/jobs/stats`, newest linked jobs bounded by `recent_limit`) derived fresh from
  the run/plan/job stores; unknown run uses the shared 404 `run_not_found` envelope
  `GET|POST /presence`,
  `GET|POST /comments`, `GET /storage/stats`,
  `GET /comments/feed?project_id=&limit=` — authoritative newest-first comment
  feed (project-name join, asset reference and whole-scope total before the
  `limit` page) derived from the comment store; optional project scope with
  shared 404/422 envelopes
  `GET /collaboration/stats?project_id=` — authoritative collaboration metrics
  (zero-filled presence-state breakdown, per-project activity counts, distinct
  participant count and newest-signal recency) derived from the presence/comment
  stores; optional project scope with shared 404/422 envelopes
  `GET /collaboration/feed?project_id=&signal=&limit=` — authoritative newest-first
  feed of presence/comment signals derived from the same presence/comment stores
  (coarse presence/comment kind, joined project name, unified recency and
  whole-scope total before the `limit` page; optional project + signal filters with
  shared 404/422 envelopes)
  `GET /comments/stats?project_id=` — authoritative comment metrics (zero-filled
  asset/project reference breakdown, per-project and per-author comment counts,
  distinct author/project totals and newest-comment recency) derived from the
  comment store; optional project scope with shared 404/422 envelopes
  `GET /comments/{comment_id}/overview?recent_limit=` — single-comment snapshot
  (identity + joined project name, canonical asset/project reference, whole-project
  and same-thread comment activity shared with `/comments/stats`, newest-first
  same-thread comments bounded by `recent_limit`) derived fresh from the comment
  store; unknown comment uses the shared 404 `comment_not_found` envelope
- **Auth/orgs:** `POST /auth/login|refresh`, `GET /auth/session|me`,
  `GET|POST /orgs` (alias `/organizations`), `GET /orgs/{id}`,
  `GET|POST /orgs/{id}/members`,
  `GET /orgs/stats?org_id=` (alias `/organizations/stats`) — authoritative
  membership metrics (organization/member/user totals, zero-filled role
  breakdown, per-organization counts, average and recency) derived from the
  auth store; optional org scope with shared 422 envelope
  `GET /orgs/feed?limit=` (alias `/organizations/feed`) — authoritative newest-first
  organization feed (member/project activity joins, whole-scope total before the
  `limit` page) derived from the auth/project stores; shared 422 envelope
  `GET /orgs/{id}/overview?recent_limit=` (alias `/organizations/{id}/overview`) —
  authoritative single-organization snapshot (identity, whole-scope
  member/project counts, a zero-filled role breakdown and bounded newest-first
  members/projects) derived from the auth/project stores; shared 404
  `organization_not_found` / 422 envelopes
  `GET /users/{id}/overview?recent_limit=` — authoritative single-user profile
  snapshot (identity, joined organization memberships, whole-scope
  organization/project/conversation/comment/presence counts and bounded
  newest-first projects/comments) derived fresh from the authoritative stores;
  shared 404 `user_not_found` / 422 envelopes
- **Extensions:** `GET /extensions/registry`, `GET /extensions`,
  `POST /extensions/install`, `GET /extensions/{id}`,
  `POST /extensions/{id}/enable|disable`, `DELETE /extensions/{id}`,
  `GET /extensions/feed?type=&status=&limit=` — authoritative newest-first feed
  of installed extensions (manifest display fields, lifecycle status, trust
  flags and install time; whole-scope `total` before the `limit` page) derived
  from the extension store with a deterministic `(installed_at, extension_id)`
  tie-break and optional type/status filters; shared 422 envelope
  `GET /extensions/stats?type=&status=` — authoritative registry/installation
  metrics (zero-filled type/status breakdowns, trust flags, permission/capability
  coverage) derived from the extension stores, with optional type/status filters
  `GET /extensions/{id}/overview` — authoritative single-extension snapshot
  (manifest identity, lifecycle/trust state and a sorted deduplicated declared
  permission/capability/provider/UI/dependency scope with counts agreeing with the
  emitted lists) derived fresh from the extension store; shared 404
  `extension_not_found` / 422 `validation_error` envelopes
- **Pipelines:** `GET|POST /pipelines/lora`, `/pipelines/shot`, `/pipelines/splat`
  (each with `GET /pipelines/<kind>/{id}`)
  `GET /pipelines/feed?project_id=&kind=&limit=` — newest-first workspace feed of
  LoRA/shot/splat chains with joined project name, job/asset counts and a
  deterministic `(created_at, chain_id)` tie-break; whole-scope `total` before the
  `limit` page, optional `project_id`/`kind` filters, shared 404/422 envelopes
  `GET /pipelines/stats?project_id=` — authoritative production-pipeline metrics
  (zero-filled per-kind chain/job/asset breakdowns, per-project chain counts,
  totals and newest-chain recency) derived from the chain stores; unknown
  `project_id` uses the shared 404 envelope
  `GET /pipelines/{chain_id}/overview?recent_limit=` — compact single-chain snapshot:
  identity/canonical kind, joined project name, whole-scope job/asset counts (reusing
  the stats/feed derivation) and bounded newest-first linked jobs/assets resolved from
  the authoritative stores (orphan/deleted links skipped); unknown chain uses the
  shared 404 `chain_not_found` envelope, bad id/limit uses the shared 422 envelope
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

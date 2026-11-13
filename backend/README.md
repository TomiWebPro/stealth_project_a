# Studio Platform Backend (Phase 2)

FastAPI application implementing the stable application API (`/api/v1`) for
health, projects, conversations, assets/lineage/versions and uploads.

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
- `STUDIO_MAX_UPLOAD_BYTES` (default 512 MiB)
- `STUDIO_DEFAULT_ORG_ID`, `STUDIO_DEFAULT_USER_ID`
- `STUDIO_CORS_ORIGINS` (comma separated), `STUDIO_CORS_ALLOW_CREDENTIALS`

## Endpoints

- `GET /api/v1/health`, `GET /api/v1/version`
- `GET|POST /api/v1/projects`, `GET|PATCH|DELETE /api/v1/projects/{id}`
- `GET /api/v1/conversations?project_id=`
- `POST /api/v1/projects/{id}/conversations`
- `GET /api/v1/conversations/{id}` and `/messages` (`GET`/`POST`)
- `GET /api/v1/assets`, `POST /api/v1/assets/register`
- `GET|PATCH|DELETE /api/v1/assets/{id}`
- `GET /api/v1/assets/{id}/versions|relationships|lineage|download|content`
- `POST /api/v1/uploads`, `PUT /api/v1/uploads/{id}`,
  `GET /api/v1/uploads/{id}/content`

All non-2xx responses use the shared `ErrorResponse` envelope with an
`X-Request-ID` header.

## Testing

```bash
cd backend
python3 -m pytest -q
```

Tests run every API test against both storage backends, verify SQLite
persistence across restarts, and check Pydantic/TypeScript contract parity in
`tests/test_contract_parity.py`.

## Phase 2 boundaries / integration dependencies

- **Auth**: no session verification yet. Requests use `X-User-Id` / `X-Org-Id`
  headers or the configured development identities. Replace
  `app.deps.get_current_user_id` when the auth service lands.
- **Uploads**: dev-local filesystem adapter. The ticket contract is stable; an
  S3 adapter will return real presigned URLs. `AssetRegisterRequest` has no
  `upload_id`, so the client currently builds the `StorageRef` itself (using the
  upload ID as `key` works with the local adapter). Adding an explicit binding
  field is a future shared-contract change.
- **Asset versions**: version 1 is recorded on registration; a create-version
  endpoint needs a shared contract addition (frontend type + schema) first.
- **Real-time**: conversation WebSocket streaming (`/conversations/{id}/stream`)
  is not implemented yet; the shared `StreamEvent` contract exists and the REST
  message endpoints are ready to feed it.
- **Jobs/operations/providers**: schemas exist, routers are not part of this
  slice.
- **Pagination**: asset `cursor` is the last asset ID from the previous page
  (keyset). The shared `Asset[]` response has no `next_cursor`; this limitation
  is tracked for a future contract revision.

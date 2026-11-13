# API

The API layer is the stable contract between frontend and backend. It belongs
to the application, not to any AI framework, provider, or execution engine.

Frontend communicates exclusively through this API. Backend implements it with
any suitable internal architecture. No direct dependency on ComfyUI/GPU/
provider internals. Backend authoritative for jobs/assets.

## 1. Layers

1. Frontend (desktop UX)
2. API layer (stable application contract)
3. Backend (services, orchestration, execution)

## 2. Design philosophy

Design around creative operations and application concepts, not models or
infrastructure.

Operations include text-to-text, text-to-image, image-to-image, editing,
upscaling, text/image-to-video, processing, 3D reconstruction, Gaussian
splatting, audio, dataset prep, training, etc. (examples, not all required now).

Each operation has a unique ID, schema version, input/output, validation,
execution semantics, optional user-facing settings. Technical params stay internal.

## 3. Domains

auth, orgs/membership, projects, conversations, assets/relationships/versions,
operations/jobs, providers/capabilities, extensions, orchestration, storage,
collaboration.

## 4. Execution and jobs

Common lifecycle: submit, job ID, status, progress, intermediate results, final
results, errors, cancellation, retry/recovery. Long-running ops consistent.
Streaming text retains streaming.

## 5. Assets and results

Generated outputs become assets with stable IDs/metadata. Reference
input/generated/intermediate/derived assets and provenance. Large files via
upload/download/storage, never embedded in ordinary responses.

## 6. Backend independence and adapters

Backend free to replace models/providers/execution. ComfyUI optional adapter.
Provider-specific translation behind boundary.

## 7. Capability discovery and extensibility

Discover available operations/settings/features. Avoid hardcoding models. Keep
important ops explicitly typed/versioned.

## 8. Versioning and compatibility

Version API and operation schemas. Backward compatibility, deprecation,
validation, error codes, naming conventions. Backend changes should not force
frontend changes. Explicit schemas (Pydantic + TS types), versioned contracts,
machine-readable forms, real-time progress with recovery, capability/provider
discovery.

## 9. Frontend/backend independence

Shared spec is source of truth. Typed schemas, validation, errors,
generated/synced types, mocks, contract tests. Coordinated changes.

## 10. Non-goals

Not a ComfyUI wrapper, not a clone of another platform, not provider-specific
endpoints, not universal technical params, not forced identical execution for
all modalities, not a monolith, not infra disguised as app API.

## 11. Initial scope

Start with core conventions, operation contracts, job lifecycle, asset refs,
streaming/events, adapter boundaries, versioning, frontend type gen/contract tests.

Representative initial ops: text-to-text, text-to-image, image-to-image.

## 12. Deliverables

Architecture proposal, responsibility separation, domain/resource structure,
operation contract design, job lifecycle, asset integration, adapter strategy,
versioning strategy, dev workflow, incremental roadmap.

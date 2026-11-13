# API Contracts

See `docs/API_ARCHITECTURE.md` for the full unified API layer architecture.

Frontend communicates via stable application API. No direct dependency on ComfyUI/GPU/provider internals. Backend authoritative for jobs/assets.

Domains: auth, orgs/membership, projects, conversations, assets/relationships/versions, operations/jobs, providers/capabilities, extensions, orchestration, storage, collaboration.

Rules: explicit schemas (Pydantic + TS types), versioned contracts, machine-readable forms, real-time progress with recovery, capability/provider discovery.

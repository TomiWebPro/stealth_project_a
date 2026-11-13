# Architecture Decisions

Confirmed:
- Desktop-first product; backend independent.
- Capability/provider abstraction.
- Asset lineage.
- Extension ecosystem.

Recommended (provisional):
- Tauri 2 desktop shell.
- PostgreSQL for multi-user/hosted; SQLite optional local.
- S3-compatible storage.
- WebSockets real-time.
- Evaluate Temporal vs simpler queue.

Assumptions:
- Linux-first dev; cross-platform via CI.
- No local GPU required initially.

Open questions:
- Extension isolation model.
- Capability/provider contract details.
- Large media storage.
- Multi-tenant boundaries.
- Local runtime install strategy.
- Collaboration scope.

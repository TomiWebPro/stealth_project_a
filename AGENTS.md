# AGENTS.md — Professional AI Creative Studio Platform

Read `docs/` before working. Key docs:
- PRODUCT_VISION.md
- PRODUCTION_PIPELINE.md
- SYSTEM_ARCHITECTURE.md
- TECH_STACK.md
- API.md
- ASSET_MANAGEMENT.md
- PROJECT_FOLDERS.md
- EXTENSIONS_SECURITY.md
- DEVELOPMENT_ROADMAP.md
- FRONTEND_MOCK_SCOPE.md
- AGENT_WORKFLOW.md

## Principles
- Modular architecture, stable contracts, strict TS, explicit data models.
- LLM is orchestration layer, not source of truth.
- Backend authoritative for jobs/assets.
- Extensions require permissions and isolation.
- Cross-platform (Linux/Windows/macOS), Linux-first dev.

## Rules
- Do not silently change shared interfaces.
- Run relevant tests/checks before marking complete.
- Prefer small, reviewable changes.
- Report integration dependencies.

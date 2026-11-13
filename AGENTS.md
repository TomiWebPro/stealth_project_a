# AGENTS.md — Professional AI Creative Studio Platform

Read `docs/` before working. Key docs:
- PRODUCT_VISION.md
- SYSTEM_ARCHITECTURE.md
- TECH_STACK.md
- EXTENSION_ARCHITECTURE.md
- ASSET_MANAGEMENT.md
- PROJECT_FOLDERS.md
- API_CONTRACTS.md
- API_ARCHITECTURE.md
- AGENT_WORKFLOW.md
- DEVELOPMENT_ROADMAP.md
- ARCHITECTURE_DECISIONS.md
- SECURITY_MODEL.md

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

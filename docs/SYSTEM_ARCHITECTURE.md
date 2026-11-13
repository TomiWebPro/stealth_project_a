# System Architecture

## Layers
1. Desktop client (Tauri 2 + React/TS) — app shell, chat, projects, assets, workspaces, extensions, backend connections.
2. Backend services (Python/FastAPI + PostgreSQL + S3 + Redis) — auth, projects, conversations, assets/lineage, operations/jobs, providers/extensions, orchestration, storage, collaboration.
3. Production infrastructure — provider adapters for ComfyUI, image/video/3D/splatting, Blender, training, custom workers, third-party services (local/studio/cloud).

## Principles
- Stable API contracts; frontend never depends on execution internals.
- Application services separate from GPU execution.
- Modular monolith first; split only when justified.
- Capability/provider abstraction; asset lineage; extension platform.

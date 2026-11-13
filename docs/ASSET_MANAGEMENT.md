# Asset Management

Every uploaded/generated/imported/derived item is a registered asset. Types:
`image`, `video`, `audio`, `model3d`, `splat`, `texture`, `dataset`, `lora`,
`scene`, `resource`.

- `dataset` — training set with spec in metadata (counts, prompts, seeds,
  source-model version). Feeds `lora-train`. Auto-generates ai-toolkit YAML.
- `lora` — trained weights with provenance (dataset id, base model, steps,
  config hash). Slotted per sequence: character / prop / environment
  (`metadata.lora_slot`). Shared by all shots in the sequence.
- `scene` — shot record / camera path / environment assembly. Points at the
  shot's LoRAs, frames, videos, and version chain.
- `splat` — trained 3D environment. Links to source footage + COLMAP poses.
- `resource` — workflow templates, scripts, shared configs (never embedded
  raw node JSON in app state).

Metadata: identity, type, project, creator, timestamps, format/props, storage,
previews, tags, version, source operation/conversation, prompt,
model/workflow/provider info, params, parent/derived, related scenes/datasets.
Sequence/shot inlora_slot/dataset_spec/camera_path/publish_receipt live in
`metadata` (frontend view-model concern, not contract bloat).

Lineage forms traceable production history. Canonical chain:
design (`image`) → dataset (`dataset`) → LoRA (`lora`) → frames (`image`) →
video (`video`) → publish. Every generated asset carries `parent_asset_ids` +
`provenance` (operation, prompt, model/workflow/provider, LoRA ids).

UX: grid/list, previews, search/filter/sort, tags, collections, folders,
multi-select, bulk ops, details, versions, relationship viz. Shot browser and
lineage view are Phase 1b screens (mock-backed; see
`docs/FRONTEND_MOCK_SCOPE.md`).

Storage/ownership: project-owned by default; publish to reusable libs;
explicit cross-project refs; soft delete/recovery; dependency warnings.

Publish ceremony: `Output/` (working) vs `Publish/` (approved, immutable).
Explicit action + comment + thumbnail + sidecar JSON. Published files also
carry the `_vNNN` suffix.

On-disk layout: the canonical local project tree (template-copy creation,
`Ver_NNN` versioning, `Output/` vs `Publish/`, reference-never-copy shared
libraries) is specified in `PROJECT_FOLDERS.md`.

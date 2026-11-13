# Asset Management

Every uploaded/generated/imported/derived item is a registered asset. Types: image, video, audio, 3D, splat, texture, dataset, LoRA, scene, resource.

Metadata: identity, type, project, creator, timestamps, format/props, storage, previews, tags, version, source operation/conversation, prompt, model/workflow/provider info, params, parent/derived, related scenes/datasets.

Lineage forms traceable production history.

UX: grid/list, previews, search/filter/sort, tags, collections, folders, multi-select, bulk ops, details, versions, relationship viz.

Storage/ownership: project-owned by default; publish to reusable libs; explicit cross-project refs; soft delete/recovery; dependency warnings.

On-disk layout: the canonical local project tree (template-copy creation, `Ver_NNN` versioning, `Output/` vs `Publish/`, reference-never-copy shared libraries) is specified in `PROJECT_FOLDERS.md`.

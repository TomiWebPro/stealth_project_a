# Production Pipeline

Canonical end-to-end spec for the AI film/animation pipeline. Builder agents
treat this as normative for stage ordering, operation IDs, asset types, and
folder mappings. App-level API rules live in `docs/API_ARCHITECTURE.md`;
on-disk rules live in `docs/PROJECT_FOLDERS.md`.

## 0. Mental model

ComfyUI gives single-shot generation. This pipeline adds what a Maya/Nuke crew
pipeline has: **projects, assets, shots, versions, publish** — plus LoRAs that
hold identity across shots. Same assets + same LoRAs reused in many shots;
no per-shot re-rolling.

## 1. Stages

| # | Stage | Operation ID(s) | Input | Output asset types |
|---|-------|-----------------|-------|--------------------|
| 1 | Concept / design frames | `text-to-image`, `image-to-image` | prompt, refs | `image` (design) |
| 2 | Dataset generation | `dataset-prep` | concept frames, poses, backgrounds | `dataset` |
| 3 | LoRA training | `lora-train` | dataset | `lora` |
| 4 | Shot setup | — (project API) | — | `scene` (shot record), folders |
| 5 | First / last frames | `text-to-image`, `image-to-image` | prompt + shot LoRAs | `image` (shot frames) |
| 6 | Shot video | `image-to-video`, `flf2v`, `text-to-video` | first/last + all shot LoRAs | `video` |
| 7 | Upscale / edit | `upscale`, `image-to-image` | video frames | `video`, `image` |
| 8 | 3D environment | `3d-reconstruction`, `splat-train` | images / video | `splat`, `model3d`, `scene` (camera path) |
| 9 | Publish | — (asset API) | selected outputs | immutable `Publish/` + sidecar JSON |

Stages 2–3 run once per identity (character / prop / environment) per sequence,
not once per shot. Stages 5–6 run per shot and preload the sequence LoRAs.

## 2. Consistency & LoRA chain (normative)

1. Generate concept frames for the identity.
2. Use an image-edit model (current: Qwen Image Edit) to expand into a dataset:
   multi-angle, multi-pose, multi-background. Record the dataset spec
   (counts, prompts, seeds, model version) on the `dataset` asset.
3. Auto-generate the ai-toolkit training YAML from the dataset spec. The YAML
   is a derived artifact of the `dataset` asset, not hand-written per run.
4. Train on rented GPUs (RunPod / vast.ai) via the training provider adapter.
   Long-running job with progress + logs + cancellation + retry.
5. Register the resulting weights as a `lora` asset with provenance
   (dataset id, base model, steps, config hash).
6. Auto-bake the LoRA into the shot's ComfyUI workflow / generation request.
   The frontend never hand-edits node JSON; it picks assets, the backend
   translates.

Minimum per sequence: one `lora` each for character, prop, environment where
applicable (test short may skip a category, but the slot exists).

## 3. Shot management

- Shot token: `{sequence}_{shot}`, e.g. `s01_c01` (see `docs/PROJECT_FOLDERS.md`).
- Each shot is a `scene` asset (or project-scoped shot record) pointing at:
  its sequence LoRAs, first/last frame images, generated videos, version chain.
- Shot versions are folders (`Ver_001`, bump creates `Ver_002`, never mutate).
- `Output/` = working files. `Publish/` = approved immutable deliverables with
  explicit action + comment + thumbnail + sidecar JSON.
- Pickers and galleries are live views of the tree. No file browser, no typed paths.

## 4. Video generation

- Modes: first-frame (`image-to-video`), first+last (`flf2v`), text (`text-to-video`).
- Model-agnostic catalog; current targets: LTX-2.5, Wan 2.2, Flux. One model
  goes end-to-end first; others arrive as provider adapters with the same
  operation IDs.
- Shot submit carries: `project_id`, `input_asset_ids` (frames), `prompt`,
  user-facing `settings` only (never raw node params), `provider_id` optional.
- Common job lifecycle for all long ops: submit → job id → queued/running with
  progress + intermediate results → succeeded/failed/canceled → retry/recovery.
  See `docs/API_ARCHITECTURE.md` §4.

## 5. 3D / splat environments

- Chain: image/video → COLMAP poses → splat-train → flyable environment.
- AI video fills dead viewpoints; re-splat for coverage.
- Camera path exported from the splat scene (`scene` asset) drives video-gen
  camera moves.
- Frame filtering + pose checks run before training (thresholds provisional
  until the GPU validation gate passes — see `docs/DEVELOPMENT_ROADMAP.md`).
- Splat/world-gen is a module, not the product. Do not build product UI around
  any single 3D vendor.

## 6. Models & execution map (current)

| Role | Current choice | Notes |
|------|---------------|-------|
| Image edit / dataset expansion | Qwen Image Edit | multi-pose/background generation |
| Video | Wan 2.2, LTX-2.5 | LTX-2.5 full flow needs ~96 GB GPU |
| Still / design | Flux (+ Qwen) | model-agnostic, first-one-then-many |
| Training config | ai-toolkit YAML (auto-generated) | checked-in generator, not hand YAML |
| Training GPUs | RunPod / vast.ai | rented, never required local |
| Reconstruction | COLMAP | poses before splat |
| Splat | gsplat (+ version pins) | version pitfalls documented in research |
| Dialogue (future) | ElevenLabs-class TTS | audio-LoRA under consideration, not committed |

No local GPU required to run the desktop shell. GPU work goes through provider
adapters (local / studio / cloud).

## 7. Provenance & lineage (required on every generated asset)

Every output records: source operation + schema version, prompt, model/workflow/
provider info + params, parent/derived asset links, conversation/message link
when applicable, LoRA asset IDs used. Lineage must render as a traceable chain
(design → dataset → LoRA → frames → video → publish).

## 8. What is NOT in this pipeline (yet)

- Full audio integration (dialogue, mix, lip-sync) — staged after video holds.
- Color/AOV/bit-depth mastering for downstream comp — tracked, not built.
- UE/Blender live links — export-first, live sync later.

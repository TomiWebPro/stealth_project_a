# Product Vision

## 30-second pitch

We are building an open-source, model-agnostic AI film/animation pipeline.
It turns ComfyUI's single-shot generation power into something that works like
a Maya/Nuke crew pipeline: with projects, assets, shots, and version management —
plus LoRAs that keep characters, props, and environments consistent across shots.

In one line: make AI-generated output go from "cool random images" to
"professional shots that cut together and can be delivered".

## 1. The problem

Using generative AI for films today is like working with a gifted amnesiac intern:

1. **Inconsistency.** Every shot renders the character slightly differently.
   Props deform, environments drift. Nothing cuts together.
2. **Uncontrollable.** AI is great at "good-looking random", bad at doing exactly
   what the shot requires — and holding that across multiple shots.
3. **Fragmented tooling.** ComfyUI, ai-toolkit, RunPod, various model repos.
   Painful installs, workflows that cannot be reused or shared.
4. **No "project" concept.** ComfyUI is one giant install directory. There is no
   asset / shot / version / publish notion, so team collaboration is hard.
5. **Not professional output.** Bit depth, AOVs, color management, and the comp
   pipeline do not connect. 3D assets and environments are hard to get into
   UE / Blender.
6. **Studios want "their own AI".** Train on their own data, own their models —
   but nobody has packaged the whole thing into a usable product.

Core judgment (from VFX practice): what a professional pipeline needs is not a
flashier model, but **controllability, consistency, organization, deliverability**.

## 2. What we are building

Five layers. ComfyUI-first today, standalone-capable tomorrow.

### 2.1 Project & asset layer (Pipeline / Project)

Give AI production the directory layout and discipline of a professional CG studio:

- `Default/` project template — copy to create, customizable (add `vehicle`,
  `creature`, etc.).
- `Assets/`: `Char` / `Prop` / `Env`, each asset versioned (`Ver_001`).
- `Sequences/`: shots organized as `Seq_Shot` (e.g. `s01_c01`).
- Every task dir split into `Output/` (working) vs `Publish/` (approved, immutable).
- `Resources/`: LoRAs, Scripts, Workflows per project.
- Root `Pipeline/`: shared non-project resources (generic models, scripts, workflows).
- Auto reference-links (symlink / `.link.txt` fallback + `.links.json`) for global
  LoRAs and shared workflows — never copy weights, never lock the user in.
- ComfyUI custom nodes: create project, create asset/shot, read/write dirs,
  launch jobs scoped to project/asset/shot, auto-mount the right LoRAs.

Full conventions: see `docs/PROJECT_FOLDERS.md`.

### 2.2 Consistency & LoRA pipeline (the "continuity" core)

1. Concept / design frames.
2. Dataset generation with an image-edit model (e.g. Qwen Image Edit):
   multi-angle, multi-pose, multi-background sets.
3. Auto-generated ai-toolkit training configs (YAML).
4. LoRA training on rented GPUs (RunPod / vast.ai).
5. Trained LoRAs wired back into the video generation workflows automatically.

One LoRA each for character, prop, environment. All shots in the same sequence
share those LoRAs — that is what keeps the look consistent.

### 2.3 Shot & video generation layer

- First-frame / last-frame generation, `i2v`, `flf2v`, `t2v`.
- Model-agnostic (LTX-2.5, Wan 2.2, Flux, …). Get one model working end-to-end first.
- Managed per sequence / shot; the shot's required LoRAs preload automatically.
- Audio comes later: some video models already carry audio; dialogue via tools
  like ElevenLabs; audio-LoRA under consideration.

Goal is not another "prompt-to-video toy" but a reusable template chain:
design character → build dataset → train LoRA → generate shot first/last frames →
generate shots with video model + all LoRAs.

### 2.4 3D / Gaussian-splat environment layer

- Image/video → COLMAP camera poses → Gaussian splat → flyable 3D environment.
- AI video fills viewpoint dead zones, then re-splat for better coverage.
- Export camera paths from the splat scene to drive video-generation camera moves.
- Uses: backgrounds, environments, virtual production, fast scene previz.

We are not building another World Labs. 3D world-generation is one module in the
pipeline; we wire existing open blocks (COLMAP, gsplat, Wan/LTX, Qwen,
ai-toolkit) into stable, reusable workflows.

### 2.5 Product principles

- **Open core.** Code is open so community and studios can extend it.
- **Model-agnostic.** No single-model lock-in; new models slot in as adapters.
- **Land in ComfyUI first.** Users already live in ComfyUI — ship nodes and the
  project layer there first, then extract into an independent app.
- **Portable Python.** ComfyUI nodes are just Python; they must be able to run
  standalone later, outside ComfyUI.
- **Desktop is the product.** AI/GPU/infra are independent and interchangeable
  behind provider adapters. No local GPU required to use the app shell.
- **Backend authoritative, on-disk tree canonical-local.** The registry is the
  source of truth; the folder tree is its local materialization (see
  `docs/PROJECT_FOLDERS.md`).

## 3. Canonical workflow (what "done" looks like)

```text
script / prompt
  → concept art
  → dataset for character / prop / environment
  → LoRA training
  → project organized by sequence / shot
  → per-shot first / last frames
  → video model + all LoRAs → shot footage
  → splat-based 3D environment / camera moves where needed
  → publish → comp / UE / downstream pipeline
```

Core value: **the same assets and LoRAs get reused across many shots** instead of
re-rolling every shot from scratch.

Detailed stage specs, operation IDs, and folder mappings:
see `docs/PRODUCTION_PIPELINE.md`.

## 4. Users

Primary:

- Professional CG/VFX artists (Maya / Houdini / Nuke / UE / Blender).
- Animation / VFX studios that want a private AI pipeline on their own data.
- Indie filmmakers already using ComfyUI who are blocked by shot-to-shot drift.
- AI creators hitting the "files everywhere, every shot rebuilt by hand" wall.

Explicit non-users (for now): casual one-click video consumers, social-clip
factories. We optimize for controllable, deliverable shots, not volume.

## 5. Business model (open core)

- Open-source core + hosted / support / enterprise tiers.
- Private AI pipelines for VFX/animation studios: studio data trains studio
  LoRAs; models and data belong to the studio.
- Own content production + related revenue; grant support for content work.
- SaaS / acquisition are optional future exits, not the current focus.

Long-term team direction includes a worker-owned cooperative structure;
current consensus is that the core stays open.

## 6. Non-goals (what we will NOT build)

- Not a ComfyUI wrapper or clone of another platform.
- Not a 3D world-model company; splat/world-gen is one pipeline module.
- Not provider-specific endpoints or universal raw technical params in the app API.
- Not forced identical execution semantics across modalities.
- Not social-feed generation or prompt-marketplace features.

## 7. Success criteria

The vision is working when a small crew can:

1. Create a project from the `Default/` template without touching a file browser.
2. Train (or plug in) character/prop/environment LoRAs once per sequence.
3. Generate 5+ shots that visibly share the same cast, props, and locations.
4. Track every output back to its prompt, model, workflow, LoRAs, and parent
   assets (lineage) and publish approved versions immutably.
5. Move the project between machines/studios via the registry + folder tree
   without breaking references.
6. Swap the video model (e.g. Wan ↔ LTX) without rewriting the app.

## 8. Honest current status (2026-11)

Proven / verified:

- CPU-side 6-stage pipeline: input → frames → filter → poses → dataset → render.
- Real COLMAP verification: synthetic panorama → 12-frame flythrough →
  9/12 registered, point cloud produced.
- Camera-path generation, frame quality filtering, pose checks.
- 326 tests passing; 7 ComfyUI nodes + splat→camera bridge.
- LoRA automation chain: dataset spec → ai-toolkit YAML → RunPod job →
  shot scripts → auto-baked ComfyUI workflows.
- Room-scan splat demo (first cut, ~30 min render, viewport navigation fixed).
- Model/license research done (Wan 2.2 5B camera control, gsplat version
  pitfalls, Krea-2 licensing, …).

Not yet verified (needs GPU):

- Whether real Wan/LTX video frames reconstruct stably under COLMAP.
- Frame-filter thresholds on real AI video.
- Real splat training quality.
- Full LTX-2.5 flow (needs ~96 GB-class GPU: RTX Pro 96 GB / H100).

Not started:

- UI/UX (in design), formal packaging, docs site, brand name.
- Business plan, team contracts, full audio integration.

Biggest blocker: **one 2–6 hour real GPU end-to-end validation.** Until that
runs, downstream demo tuning, filter thresholds, and real splat quality are
projections, not facts.

Roadmap implications: see `docs/DEVELOPMENT_ROADMAP.md` (GPU validation gate)
and `docs/ARCHITECTURE_DECISIONS.md` (open questions with owners).

/**
 * Mock API data.
 *
 * Values use the same shapes the backend returns (`src/types`, which mirror
 * `backend/app/schemas`), so screens built against mocks need no changes when
 * the live API is enabled.
 */

import type {
  Asset,
  Comment,
  Conversation,
  Extension,
  Job,
  Message,
  OperationCatalog,
  Organization,
  OrchestrationRun,
  Presence,
  Project,
  Provider,
  StorageStats,
  User,
} from "../types";

/** Fixed reference time so mock data renders deterministically. */
export const REFERENCE_NOW = "2026-03-18T10:30:00.000Z";

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.parse(REFERENCE_NOW) - minutes * 60_000).toISOString();
}

/** Placeholder preview image; swapped for real asset URLs once the API ships. */
function placeholderPreview(seed: number): string {
  return `https://picsum.photos/seed/studio-${seed}/640/480`;
}

const ORG_ID = "0b5c1e2a-0000-4000-8000-000000000001";
const CREATOR_ID = "0b5c1e2a-0000-4000-8000-0000000000aa";

function storageRef(key: string, contentType: string, url: string | null) {
  return {
    backend: "s3" as const,
    bucket: "studio-assets",
    key,
    size_bytes: 1_048_576,
    content_type: contentType,
    etag: null,
    url,
  };
}

function emptyProvenance(): {
  operation_id: string | null;
  operation_version: string | null;
  conversation_id: string | null;
  message_id: string | null;
  job_id: string | null;
  prompt: string | null;
  provider_id: string | null;
  workflow: string | null;
  params: Record<string, unknown>;
} {
  return {
    operation_id: null,
    operation_version: null,
    conversation_id: null,
    message_id: null,
    job_id: null,
    prompt: null,
    provider_id: null,
    workflow: null,
    params: {},
  };
}

/**
 * Stable project ids, referenced by assets and jobs so they never index into
 * the `PROJECTS` array (which is unsafe under `noUncheckedIndexedAccess`).
 */
const PROJECT_IDS = {
  brand: "0b5c1e2a-1000-4000-8000-000000000001",
  environment: "0b5c1e2a-1000-4000-8000-000000000002",
  character: "0b5c1e2a-1000-4000-8000-000000000003",
  archive: "0b5c1e2a-1000-4000-8000-000000000004",
  moonshot: "0b5c1e2a-1000-4000-8000-000000000005",
  empty: "0b5c1e2a-1000-4000-8000-000000000006",
} as const;

export const PROJECTS: readonly Project[] = [
  {
    id: PROJECT_IDS.brand,
    org_id: ORG_ID,
    name: "Northlight — Brand Campaign",
    description: "Key visual exploration and hero assets for the spring launch.",
    created_by: CREATOR_ID,
    created_at: isoMinutesAgo(20_160),
    updated_at: isoMinutesAgo(24),
    archived: false,
  },
  {
    id: PROJECT_IDS.environment,
    org_id: ORG_ID,
    name: "Atlas — 3D Environment",
    description: "Reconstruction and lookdev for the rooftop scene.",
    created_by: CREATOR_ID,
    created_at: isoMinutesAgo(14_400),
    updated_at: isoMinutesAgo(180),
    archived: false,
  },
  {
    id: PROJECT_IDS.character,
    org_id: ORG_ID,
    name: "Sable — Character Study",
    description: "Concept iterations and LoRA training set curation.",
    created_by: CREATOR_ID,
    created_at: isoMinutesAgo(8_640),
    updated_at: isoMinutesAgo(1_440),
    archived: false,
  },
  {
    id: PROJECT_IDS.archive,
    org_id: ORG_ID,
    name: "Archive 2025",
    description: "Delivered work kept for reference and reuse.",
    created_by: CREATOR_ID,
    created_at: isoMinutesAgo(86_400),
    updated_at: isoMinutesAgo(43_200),
    archived: true,
  },
  {
    id: PROJECT_IDS.moonshot,
    org_id: ORG_ID,
    name: "Moonshot — Short Film",
    description:
      "Astronaut, moon buggy, and moon surface held consistent by sequence LoRAs across s01 shots.",
    created_by: CREATOR_ID,
    created_at: isoMinutesAgo(4_320),
    updated_at: isoMinutesAgo(12),
    archived: false,
  },
  {
    id: PROJECT_IDS.empty,
    org_id: ORG_ID,
    name: "Blank Slate — New Project",
    description: "Fresh project with no assets or jobs yet.",
    created_by: CREATOR_ID,
    created_at: isoMinutesAgo(30),
    updated_at: isoMinutesAgo(30),
    archived: false,
  },
];

function imageAsset(
  id: string,
  projectId: string,
  name: string,
  seed: number,
  tags: string[],
  minutesAgo: number,
): Asset {
  const url = placeholderPreview(seed);
  return {
    id,
    project_id: projectId,
    type: "image",
    name,
    status: "ready",
    creator_id: CREATOR_ID,
    version: 1,
    tags,
    storage: storageRef(`assets/${id}.png`, "image/png", url),
    props: { width: 640, height: 480, duration_ms: null, fps: null, format: "png" },
    preview_url: url,
    thumbnail_url: url,
    provenance: emptyProvenance(),
    parent_asset_ids: [],
    metadata: {},
    created_at: isoMinutesAgo(minutesAgo),
    updated_at: isoMinutesAgo(minutesAgo),
  };
}

function fileAsset(
  id: string,
  projectId: string,
  name: string,
  type: Asset["type"],
  contentType: string,
  tags: string[],
  minutesAgo: number,
): Asset {
  return {
    id,
    project_id: projectId,
    type,
    name,
    status: "ready",
    creator_id: CREATOR_ID,
    version: 1,
    tags,
    storage: storageRef(`assets/${id}`, contentType, null),
    props: { width: null, height: null, duration_ms: null, fps: null, format: null },
    preview_url: null,
    thumbnail_url: null,
    provenance: emptyProvenance(),
    parent_asset_ids: [],
    metadata: {},
    created_at: isoMinutesAgo(minutesAgo),
    updated_at: isoMinutesAgo(minutesAgo),
  };
}

/**
 * Pipeline asset with full lineage: storage key follows `PROJECT_FOLDERS.md`
 * POSIX layout (`Output/` vs `Publish/`), provenance names the operation +
 * provider, metadata carries `sequence` / `shot` / `lora_slot` / dataset spec.
 * Uses only shared contract shapes — no new types.
 */
function pipelineAsset(
  id: string,
  projectId: string,
  name: string,
  type: Asset["type"],
  key: string,
  contentType: string,
  seed: number | null,
  tags: string[],
  minutesAgo: number,
  options: {
    provenance?: Partial<ReturnType<typeof emptyProvenance>>;
    parentAssetIds?: string[];
    metadata?: Record<string, unknown>;
    version?: number;
  } = {},
): Asset {
  const url = seed === null ? null : placeholderPreview(seed);
  const isImage = type === "image";
  return {
    id,
    project_id: projectId,
    type,
    name,
    status: "ready",
    creator_id: CREATOR_ID,
    version: options.version ?? 1,
    tags,
    storage: storageRef(key, contentType, isImage ? url : null),
    props: isImage
      ? { width: 640, height: 480, duration_ms: null, fps: null, format: "png" }
      : type === "video"
        ? { width: 1280, height: 720, duration_ms: 4_000, fps: 24, format: "mp4" }
        : { width: null, height: null, duration_ms: null, fps: null, format: null },
    preview_url: isImage ? url : null,
    thumbnail_url: isImage ? url : null,
    provenance: { ...emptyProvenance(), ...options.provenance },
    parent_asset_ids: options.parentAssetIds ?? [],
    metadata: options.metadata ?? {},
    created_at: isoMinutesAgo(minutesAgo),
    updated_at: isoMinutesAgo(minutesAgo),
  };
}

export const ASSETS: readonly Asset[] = [
  imageAsset(
    "0b5c1e2a-2000-4000-8000-000000000001",
    PROJECT_IDS.brand,
    "hero-shot-04.png",
    11,
    ["hero", "lighting"],
    18,
  ),
  imageAsset(
    "0b5c1e2a-2000-4000-8000-000000000002",
    PROJECT_IDS.brand,
    "color-lookdev.webp",
    12,
    ["lookdev"],
    52,
  ),
  fileAsset(
    "0b5c1e2a-2000-4000-8000-000000000003",
    PROJECT_IDS.environment,
    "rooftop-splat.ply",
    "splat",
    "application/octet-stream",
    ["reconstruction"],
    140,
  ),
  fileAsset(
    "0b5c1e2a-2000-4000-8000-000000000004",
    PROJECT_IDS.character,
    "sable-turnaround.mp4",
    "video",
    "video/mp4",
    ["character", "turntable"],
    320,
  ),
  fileAsset(
    "0b5c1e2a-2000-4000-8000-000000000005",
    PROJECT_IDS.character,
    "training-set-v2",
    "dataset",
    "application/zip",
    ["lora", "curation"],
    600,
  ),
  imageAsset(
    "0b5c1e2a-2000-4000-8000-000000000006",
    PROJECT_IDS.environment,
    "concrete-brushed.png",
    16,
    ["material"],
    980,
  ),
  // --- Moonshot short-film chain: design → dataset → LoRA → frames → video.
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000011",
    PROJECT_IDS.moonshot,
    "moonAstronaut-concept_v001.png",
    "image",
    "moonshot/Assets/Char/moonAstronaut/Ver_001/Design/Output/concept_v001.png",
    "image/png",
    21,
    ["concept", "astronaut"],
    9,
    {
      provenance: {
        operation_id: "text-to-image",
        prompt: "astronaut concept, front view, studio lighting",
        provider_id: "prov_comfy",
      },
      metadata: { sequence: "s01", lora_slot: "character", trigger_word: "moonAstronaut" },
    },
  ),
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000012",
    PROJECT_IDS.moonshot,
    "moonAstronaut-dataset",
    "dataset",
    "moonshot/Assets/Char/moonAstronaut/Ver_001/Dataset/Output/dataset.zip",
    "application/zip",
    null,
    ["dataset", "lora-source"],
    40,
    {
      provenance: {
        operation_id: "dataset-prep",
        job_id: "0b5c1e2a-3000-4000-8000-000000000011",
        provider_id: "prov_comfy",
      },
      parentAssetIds: ["0b5c1e2a-2000-4000-8000-000000000011"],
      metadata: {
        sequence: "s01",
        lora_slot: "character",
        trigger_word: "moonAstronaut",
        dataset_spec: { views: 24, poses: ["front", "back", "three-quarter"], backgrounds: ["moon"] },
      },
    },
  ),
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000013",
    PROJECT_IDS.moonshot,
    "moonAstronaut.safetensors",
    "lora",
    "moonshot/Assets/Char/moonAstronaut/Ver_001/Loras/Publish/moonAstronaut.safetensors",
    "application/octet-stream",
    null,
    ["lora", "character"],
    120,
    {
      provenance: {
        operation_id: "lora-train",
        job_id: "0b5c1e2a-3000-4000-8000-000000000012",
        provider_id: "prov_train",
      },
      parentAssetIds: ["0b5c1e2a-2000-4000-8000-000000000012"],
      metadata: {
        sequence: "s01",
        lora_slot: "character",
        trigger_word: "moonAstronaut",
        publish_receipt: {
          comment: "s01 approved character LoRA",
          publisher: CREATOR_ID,
          sidecar: "Publish/moonAstronaut.sidecar.json",
        },
      },
    },
  ),
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000014",
    PROJECT_IDS.moonshot,
    "moonBuggy.safetensors",
    "lora",
    "moonshot/Assets/Prop/moonBuggy/Ver_001/Loras/Publish/moonBuggy.safetensors",
    "application/octet-stream",
    null,
    ["lora", "prop"],
    130,
    {
      provenance: {
        operation_id: "lora-train",
        job_id: "0b5c1e2a-3000-4000-8000-000000000013",
        provider_id: "prov_train",
      },
      metadata: {
        sequence: "s01",
        lora_slot: "prop",
        trigger_word: "moonBuggy",
        publish_receipt: {
          comment: "s01 approved prop LoRA",
          publisher: CREATOR_ID,
          sidecar: "Publish/moonBuggy.sidecar.json",
        },
      },
    },
  ),
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000015",
    PROJECT_IDS.moonshot,
    "moonSurface.safetensors",
    "lora",
    "moonshot/Assets/Env/moonSurface/Ver_001/Loras/Publish/moonSurface.safetensors",
    "application/octet-stream",
    null,
    ["lora", "environment"],
    140,
    {
      provenance: {
        operation_id: "lora-train",
        provider_id: "prov_train",
      },
      metadata: {
        sequence: "s01",
        lora_slot: "environment",
        trigger_word: "moonSurface",
        publish_receipt: {
          comment: "s01 approved environment LoRA",
          publisher: CREATOR_ID,
          sidecar: "Publish/moonSurface.sidecar.json",
        },
      },
    },
  ),
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000016",
    PROJECT_IDS.moonshot,
    "s01_c01-first_v001.png",
    "image",
    "moonshot/Shots/s01_c01/Ver_001/Compose/Output/first_v001.png",
    "image/png",
    22,
    ["shot", "first-frame", "s01_c01"],
    15,
    {
      provenance: {
        operation_id: "image-to-image",
        prompt: "s01_c01 first frame, moonAstronaut beside moonBuggy on moonSurface",
        provider_id: "prov_comfy",
      },
      parentAssetIds: [
        "0b5c1e2a-2000-4000-8000-000000000013",
        "0b5c1e2a-2000-4000-8000-000000000014",
        "0b5c1e2a-2000-4000-8000-000000000015",
      ],
      metadata: { sequence: "s01", shot: "s01_c01" },
    },
  ),
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000017",
    PROJECT_IDS.moonshot,
    "s01_c01_v001.mp4",
    "video",
    "moonshot/Shots/s01_c01/Ver_001/Compose/Publish/s01_c01_v001.mp4",
    "video/mp4",
    null,
    ["shot", "s01_c01", "published"],
    8,
    {
      provenance: {
        operation_id: "image-to-video",
        job_id: "0b5c1e2a-3000-4000-8000-000000000014",
        prompt: "slow push-in, astronaut walks to buggy, no dialogue",
        provider_id: "prov_comfy",
      },
      parentAssetIds: [
        "0b5c1e2a-2000-4000-8000-000000000016",
        "0b5c1e2a-2000-4000-8000-000000000013",
        "0b5c1e2a-2000-4000-8000-000000000014",
        "0b5c1e2a-2000-4000-8000-000000000015",
      ],
      metadata: {
        sequence: "s01",
        shot: "s01_c01",
        publish_receipt: {
          comment: "Approved s01_c01 final cut",
          publisher: CREATOR_ID,
          sidecar: "Publish/s01_c01_v001.sidecar.json",
        },
      },
    },
  ),
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000018",
    PROJECT_IDS.moonshot,
    "moon-surface-splat.ply",
    "splat",
    "moonshot/Assets/Env/moonSurface/Ver_001/Workflows/Output/env-splat.ply",
    "application/octet-stream",
    null,
    ["environment", "splat"],
    200,
    {
      provenance: { operation_id: "splat-train", provider_id: "prov_train" },
      metadata: { sequence: "s01", lora_slot: "environment" },
    },
  ),
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000019",
    PROJECT_IDS.moonshot,
    "s01_c01-camera.json",
    "scene",
    "moonshot/Shots/s01_c01/Ver_001/Compose/Output/camera.json",
    "application/json",
    null,
    ["shot", "camera-path", "s01_c01"],
    190,
    {
      provenance: { operation_id: "3d-reconstruction", provider_id: "prov_cloud" },
      parentAssetIds: ["0b5c1e2a-2000-4000-8000-000000000018"],
      metadata: { sequence: "s01", shot: "s01_c01" },
    },
  ),
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000020",
    PROJECT_IDS.moonshot,
    "shot-video-lora.json",
    "resource",
    "moonshot/Resources/Workflows/Video/shot-video-lora.json",
    "application/json",
    null,
    ["workflow", "template"],
    300,
    {
      metadata: { template: true, operations: ["image-to-video", "flf2v"] },
    },
  ),
  // --- Moonshot s01_c02: reuses the same three sequence LoRAs; published deliverable.
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000021",
    PROJECT_IDS.moonshot,
    "s01_c02-first_v001.png",
    "image",
    "moonshot/Shots/s01_c02/Ver_001/Compose/Output/first_v001.png",
    "image/png",
    23,
    ["shot", "first-frame", "s01_c02"],
    7,
    {
      provenance: {
        operation_id: "image-to-image",
        prompt: "s01_c02 first frame, moonAstronaut drives moonBuggy across moonSurface",
        provider_id: "prov_comfy",
      },
      parentAssetIds: [
        "0b5c1e2a-2000-4000-8000-000000000013",
        "0b5c1e2a-2000-4000-8000-000000000014",
        "0b5c1e2a-2000-4000-8000-000000000015",
      ],
      metadata: { sequence: "s01", shot: "s01_c02" },
    },
  ),
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000022",
    PROJECT_IDS.moonshot,
    "s01_c02_v001.mp4",
    "video",
    "moonshot/Shots/s01_c02/Ver_001/Compose/Publish/s01_c02_v001.mp4",
    "video/mp4",
    null,
    ["shot", "s01_c02", "published"],
    6,
    {
      provenance: {
        operation_id: "image-to-video",
        prompt: "tracking shot, buggy crosses crater rim, steady cam",
        provider_id: "prov_comfy",
      },
      parentAssetIds: [
        "0b5c1e2a-2000-4000-8000-000000000021",
        "0b5c1e2a-2000-4000-8000-000000000013",
        "0b5c1e2a-2000-4000-8000-000000000014",
        "0b5c1e2a-2000-4000-8000-000000000015",
      ],
      metadata: {
        sequence: "s01",
        shot: "s01_c02",
        publish_receipt: {
          comment: "Approved s01_c02 final cut",
          publisher: CREATOR_ID,
          sidecar: "Publish/s01_c02_v001.sidecar.json",
        },
      },
    },
  ),
  // --- Moonshot s02_c01: different sequence, shares the same character/prop/env LoRAs.
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000023",
    PROJECT_IDS.moonshot,
    "s02_c01-first_v001.png",
    "image",
    "moonshot/Shots/s02_c01/Ver_001/Compose/Output/first_v001.png",
    "image/png",
    24,
    ["shot", "first-frame", "s02_c01"],
    5,
    {
      provenance: {
        operation_id: "text-to-image",
        prompt: "s02_c01 establishing, moonAstronaut and moonBuggy on moonSurface at dusk",
        provider_id: "prov_comfy",
      },
      parentAssetIds: [
        "0b5c1e2a-2000-4000-8000-000000000013",
        "0b5c1e2a-2000-4000-8000-000000000014",
        "0b5c1e2a-2000-4000-8000-000000000015",
      ],
      metadata: { sequence: "s02", shot: "s02_c01" },
    },
  ),
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000024",
    PROJECT_IDS.moonshot,
    "s02_c01_v001.mp4",
    "video",
    "moonshot/Shots/s02_c01/Ver_001/Compose/Publish/s02_c01_v001.mp4",
    "video/mp4",
    null,
    ["shot", "s02_c01", "published"],
    4,
    {
      provenance: {
        operation_id: "image-to-video",
        prompt: "wide establishing move, shared sequence LoRAs, low sun",
        provider_id: "prov_cloud",
      },
      parentAssetIds: [
        "0b5c1e2a-2000-4000-8000-000000000023",
        "0b5c1e2a-2000-4000-8000-000000000013",
        "0b5c1e2a-2000-4000-8000-000000000014",
        "0b5c1e2a-2000-4000-8000-000000000015",
      ],
      metadata: {
        sequence: "s02",
        shot: "s02_c01",
        publish_receipt: {
          comment: "s02 establishing locked",
          publisher: CREATOR_ID,
          sidecar: "Publish/s02_c01_v001.sidecar.json",
        },
      },
    },
  ),
  // --- Moonshot s02_c02: second shot in s02, still reusing the same three LoRAs.
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000025",
    PROJECT_IDS.moonshot,
    "s02_c02-first_v001.png",
    "image",
    "moonshot/Shots/s02_c02/Ver_001/Compose/Output/first_v001.png",
    "image/png",
    25,
    ["shot", "first-frame", "s02_c02"],
    3,
    {
      provenance: {
        operation_id: "image-to-image",
        prompt: "s02_c02 first frame, moonAstronaut parks moonBuggy on moonSurface ridge",
        provider_id: "prov_comfy",
      },
      parentAssetIds: [
        "0b5c1e2a-2000-4000-8000-000000000013",
        "0b5c1e2a-2000-4000-8000-000000000014",
        "0b5c1e2a-2000-4000-8000-000000000015",
      ],
      metadata: { sequence: "s02", shot: "s02_c02" },
    },
  ),
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000027",
    PROJECT_IDS.moonshot,
    "s02_c02-last_v001.png",
    "image",
    "moonshot/Shots/s02_c02/Ver_001/Compose/Output/last_v001.png",
    "image/png",
    26,
    ["shot", "last-frame", "s02_c02"],
    3,
    {
      provenance: {
        operation_id: "image-to-image",
        prompt: "s02_c02 last frame, buggy settled on ridge, dust cloud drifting",
        provider_id: "prov_comfy",
      },
      parentAssetIds: [
        "0b5c1e2a-2000-4000-8000-000000000013",
        "0b5c1e2a-2000-4000-8000-000000000014",
        "0b5c1e2a-2000-4000-8000-000000000015",
      ],
      metadata: { sequence: "s02", shot: "s02_c02" },
    },
  ),
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000026",
    PROJECT_IDS.moonshot,
    "s02_c02_v001.mp4",
    "video",
    "moonshot/Shots/s02_c02/Ver_001/Compose/Publish/s02_c02_v001.mp4",
    "video/mp4",
    null,
    ["shot", "s02_c02", "published"],
    2,
    {
      provenance: {
        operation_id: "flf2v",
        prompt: "s02_c02 buggy settles on ridge, dust kick, shared LoRAs",
        provider_id: "prov_cloud",
      },
      parentAssetIds: [
        "0b5c1e2a-2000-4000-8000-000000000025",
        "0b5c1e2a-2000-4000-8000-000000000027",
        "0b5c1e2a-2000-4000-8000-000000000013",
        "0b5c1e2a-2000-4000-8000-000000000014",
        "0b5c1e2a-2000-4000-8000-000000000015",
      ],
      metadata: {
        sequence: "s02",
        shot: "s02_c02",
        publish_receipt: {
          comment: "s02_c02 ridge beat approved",
          publisher: CREATOR_ID,
          sidecar: "Publish/s02_c02_v001.sidecar.json",
        },
      },
    },
  ),
  // --- Version chain: s01_c01 Ver_002 iterates on Ver_001 with Output + Publish.
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000028",
    PROJECT_IDS.moonshot,
    "s01_c01_v002.mp4",
    "video",
    "moonshot/Shots/s01_c01/Ver_002/Compose/Output/s01_c01_v002.mp4",
    "video/mp4",
    null,
    ["shot", "s01_c01", "wip"],
    1,
    {
      version: 2,
      provenance: {
        operation_id: "image-to-video",
        prompt: "s01_c01 iteration: slower push-in, adjusted dust pass",
        provider_id: "prov_comfy",
      },
      parentAssetIds: [
        "0b5c1e2a-2000-4000-8000-000000000017",
        "0b5c1e2a-2000-4000-8000-000000000013",
        "0b5c1e2a-2000-4000-8000-000000000014",
        "0b5c1e2a-2000-4000-8000-000000000015",
      ],
      metadata: { sequence: "s01", shot: "s01_c01" },
    },
  ),
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000029",
    PROJECT_IDS.moonshot,
    "s01_c01_v002_publish.mp4",
    "video",
    "moonshot/Shots/s01_c01/Ver_002/Compose/Publish/s01_c01_v002.mp4",
    "video/mp4",
    null,
    ["shot", "s01_c01", "published"],
    0,
    {
      version: 2,
      provenance: {
        operation_id: "image-to-video",
        prompt: "s01_c01 v002 approved publish",
        provider_id: "prov_comfy",
      },
      parentAssetIds: [
        "0b5c1e2a-2000-4000-8000-000000000028",
        "0b5c1e2a-2000-4000-8000-000000000013",
        "0b5c1e2a-2000-4000-8000-000000000014",
        "0b5c1e2a-2000-4000-8000-000000000015",
      ],
      metadata: {
        sequence: "s01",
        shot: "s01_c01",
        publish_receipt: {
          comment: "s01_c01 v002 supersedes v001 with refined motion",
          publisher: CREATOR_ID,
          sidecar: "Publish/s01_c01_v002.sidecar.json",
        },
      },
    },
  ),
  // --- Additional workflow-template resource seeds for template gallery/filtering.
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000030",
    PROJECT_IDS.moonshot,
    "dataset-prep-template.json",
    "resource",
    "moonshot/Resources/Workflows/Dataset/dataset-prep-template.json",
    "application/json",
    null,
    ["workflow", "template", "dataset"],
    310,
    {
      metadata: {
        template: true,
        workflow_template: {
          operation_id: "dataset-prep",
          description: "Curate and expand a character dataset for LoRA training.",
          inputs: ["concept-frames"],
          outputs: ["dataset"],
        },
        operations: ["dataset-prep"],
      },
    },
  ),
  pipelineAsset(
    "0b5c1e2a-2000-4000-8000-000000000031",
    PROJECT_IDS.moonshot,
    "lora-train-template.json",
    "resource",
    "moonshot/Resources/Workflows/Training/lora-train-template.json",
    "application/json",
    null,
    ["workflow", "template", "training"],
    320,
    {
      metadata: {
        template: true,
        workflow_template: {
          operation_id: "lora-train",
          description: "Train a sequence LoRA from a prepared dataset.",
          inputs: ["dataset"],
          outputs: ["lora"],
        },
        operations: ["lora-train"],
      },
    },
  ),
];

function job(
  id: string,
  projectId: string,
  operationId: string,
  status: Job["status"],
  progress: number,
  minutesAgo: number,
): Job {
  return {
    id,
    project_id: projectId,
    operation_id: operationId,
    schema_version: "v1",
    status,
    progress,
    result: null,
    error: null,
    attempt: 1,
    created_by: CREATOR_ID,
    created_at: isoMinutesAgo(minutesAgo),
    started_at: isoMinutesAgo(minutesAgo),
    finished_at: null,
  };
}

export const JOBS: readonly Job[] = [
  job("0b5c1e2a-3000-4000-8000-000000000001", PROJECT_IDS.brand, "text-to-image", "running", 0.62, 2),
  job("0b5c1e2a-3000-4000-8000-000000000002", PROJECT_IDS.character, "image-to-video", "running", 0.23, 6),
  job("0b5c1e2a-3000-4000-8000-000000000003", PROJECT_IDS.brand, "upscale", "queued", 0, 1),
  job("0b5c1e2a-3000-4000-8000-000000000011", PROJECT_IDS.moonshot, "dataset-prep", "running", 0.45, 4),
  job("0b5c1e2a-3000-4000-8000-000000000012", PROJECT_IDS.moonshot, "lora-train", "running", 0.31, 10),
  job("0b5c1e2a-3000-4000-8000-000000000013", PROJECT_IDS.moonshot, "lora-train", "queued", 0, 3),
  job("0b5c1e2a-3000-4000-8000-000000000014", PROJECT_IDS.moonshot, "image-to-video", "running", 0.58, 5),
  job("0b5c1e2a-3000-4000-8000-000000000015", PROJECT_IDS.moonshot, "splat-train", "queued", 0, 7),
  {
    ...job("0b5c1e2a-3000-4000-8000-000000000016", PROJECT_IDS.moonshot, "lora-train", "failed", 0.82, 90),
    finished_at: isoMinutesAgo(20),
    error: { code: "TRAIN_OOM", message: "24 GB VRAM exhausted at step 812; retry on 48 GB+ worker.", retryable: true },
  },
  {
    ...job("0b5c1e2a-3000-4000-8000-000000000017", PROJECT_IDS.moonshot, "text-to-image", "succeeded", 1, 200),
    finished_at: isoMinutesAgo(150),
    result: { asset_ids: ["0b5c1e2a-2000-4000-8000-000000000011"], text: null, metadata: {} },
  },
  {
    ...job("0b5c1e2a-3000-4000-8000-000000000018", PROJECT_IDS.moonshot, "3d-reconstruction", "canceled", 0.12, 300),
    finished_at: isoMinutesAgo(280),
  },
];

function provider(
  id: string,
  name: string,
  location: Provider["location"],
  status: Provider["status"],
  operationIds: readonly string[],
): Provider {
  return {
    id,
    name,
    location,
    status,
    capabilities: operationIds.map((operationId) => ({
      operation_id: operationId,
      schema_versions: ["v1"],
    })),
    metadata: {},
  };
}

export const PROVIDERS: readonly Provider[] = [
  provider("prov_local", "Local Runtime", "local", "available", [
    "text-to-image",
    "image-to-image",
    "upscale",
  ]),
  provider("prov_comfy", "ComfyUI (studio)", "studio", "available", [
    "text-to-image",
    "image-to-image",
    "image-to-video",
    "flf2v",
    "upscale",
  ]),
  provider("prov_cloud", "Cloud Rendering", "cloud", "degraded", [
    "image-to-video",
    "text-to-video",
    "3d-reconstruction",
    "splat-train",
  ]),
  provider("prov_train", "RunPod Training", "cloud", "available", [
    "dataset-prep",
    "lora-train",
    "splat-train",
  ]),
];

/** Projects that are archived (for drill/filter states). */
export const ARCHIVED_PROJECTS: readonly Project[] = PROJECTS.filter(
  (project) => project.archived,
);

// --- Operation catalog (P4 pipeline capability discovery) --------------------

/**
 * Static catalog mirroring docs/PRODUCTION_PIPELINE.md stages 1-9. Operation
 * ids are the stable contract; providers in {@link PROVIDERS} advertise which
 * ones they can execute through their `capabilities`.
 */
export const OPERATION_CATALOG: OperationCatalog = {
  version: "v1",
  operations: [
    {
      id: "text-to-image",
      title: "Text to image",
      description: "Generate concept/design frames from a prompt.",
      schema_version: "v1",
      streaming: false,
      input: { asset_types: [] },
      output: { asset_types: ["image"] },
      settings: [
        { key: "width", label: "Width", type: "integer", default: 1024 },
        { key: "height", label: "Height", type: "integer", default: 1024 },
      ],
    },
    {
      id: "image-to-image",
      title: "Image to image",
      description: "Edit or restyle a reference frame.",
      schema_version: "v1",
      input: { asset_types: ["image"], required: true },
      output: { asset_types: ["image"] },
    },
    {
      id: "dataset-prep",
      title: "Dataset preparation",
      description: "Expand concept frames into a multi-pose training dataset.",
      schema_version: "v1",
      input: { asset_types: ["image"], required: true, multiple: true },
      output: { asset_types: ["dataset"] },
      settings: [
        { key: "angles", label: "Angles", type: "integer", default: 12 },
        { key: "seeds", label: "Seed count", type: "integer", default: 48 },
      ],
    },
    {
      id: "lora-train",
      title: "LoRA training",
      description: "Train a sequence identity LoRA from a prepared dataset.",
      schema_version: "v1",
      input: { asset_types: ["dataset"], required: true },
      output: { asset_types: ["lora"] },
      settings: [
        { key: "steps", label: "Steps", type: "integer", default: 1200 },
        { key: "learning_rate", label: "Learning rate", type: "number", default: 0.0001 },
      ],
    },
    {
      id: "image-to-video",
      title: "Image to video",
      description: "Animate a first frame into a shot clip.",
      schema_version: "v1",
      streaming: true,
      input: { asset_types: ["image"], required: true },
      output: { asset_types: ["video"] },
      settings: [
        { key: "duration_ms", label: "Duration (ms)", type: "integer", default: 5000 },
        { key: "fps", label: "FPS", type: "integer", default: 24 },
      ],
    },
    {
      id: "flf2v",
      title: "First/last frame to video",
      description: "Interpolate a shot between first and last frames.",
      schema_version: "v1",
      streaming: true,
      input: { asset_types: ["image"], required: true, multiple: true },
      output: { asset_types: ["video"] },
    },
    {
      id: "text-to-video",
      title: "Text to video",
      description: "Generate a shot clip directly from a prompt.",
      schema_version: "v1",
      streaming: true,
      output: { asset_types: ["video"] },
    },
    {
      id: "upscale",
      title: "Upscale",
      description: "Increase resolution of an existing frame or clip.",
      schema_version: "v1",
      input: { asset_types: ["image", "video"], required: true },
      output: { asset_types: ["image", "video"] },
    },
    {
      id: "3d-reconstruction",
      title: "3D reconstruction",
      description: "Estimate camera poses with COLMAP before splat training.",
      schema_version: "v1",
      input: { asset_types: ["image", "video"], required: true, multiple: true },
      output: { asset_types: ["splat", "scene"] },
    },
    {
      id: "splat-train",
      title: "Splat training",
      description: "Train a flyable Gaussian-splat environment.",
      schema_version: "v1",
      input: { asset_types: ["splat"], required: false },
      output: { asset_types: ["splat", "scene"] },
    },
  ],
};

// --- Conversations (P4.6 chat / orchestration loop) ---------------------------

const CONVERSATION_IDS = {
  moonshot: "0b5c1e2a-5000-4000-8000-000000000001",
  character: "0b5c1e2a-5000-4000-8000-000000000002",
  empty: "0b5c1e2a-5000-4000-8000-000000000003",
} as const;

export const CONVERSATIONS: readonly Conversation[] = [
  {
    id: CONVERSATION_IDS.moonshot,
    project_id: PROJECT_IDS.moonshot,
    title: "s01 sequence plan",
    created_by: CREATOR_ID,
    created_at: isoMinutesAgo(180),
    updated_at: isoMinutesAgo(8),
    message_count: 3,
  },
  {
    id: CONVERSATION_IDS.character,
    project_id: PROJECT_IDS.character,
    title: "Mara identity — dataset review",
    created_by: CREATOR_ID,
    created_at: isoMinutesAgo(720),
    updated_at: isoMinutesAgo(240),
    message_count: 2,
  },
  {
    id: CONVERSATION_IDS.empty,
    project_id: PROJECT_IDS.empty,
    title: "Blank slate",
    created_by: CREATOR_ID,
    created_at: isoMinutesAgo(30),
    updated_at: isoMinutesAgo(30),
    message_count: 0,
  },
];

export const MESSAGES: readonly Message[] = [
  {
    id: "0b5c1e2a-5100-4000-8000-000000000001",
    conversation_id: CONVERSATION_IDS.moonshot,
    role: "user",
    content: "Plan the dataset → LoRA chain for sequence s01.",
    status: "complete",
    created_at: isoMinutesAgo(40),
  },
  {
    id: "0b5c1e2a-5100-4000-8000-000000000002",
    conversation_id: CONVERSATION_IDS.moonshot,
    role: "assistant",
    content: "I'll prepare character, prop and environment datasets first, then queue three LoRA jobs.",
    status: "complete",
    operation_id: "dataset-prep",
    created_at: isoMinutesAgo(39),
  },
  {
    id: "0b5c1e2a-5100-4000-8000-000000000003",
    conversation_id: CONVERSATION_IDS.moonshot,
    role: "assistant",
    content: "Dataset prep is 45% complete; LoRA training is queued behind it.",
    status: "streaming",
    operation_id: "lora-train",
    created_at: isoMinutesAgo(8),
  },
  {
    id: "0b5c1e2a-5100-4000-8000-000000000004",
    conversation_id: CONVERSATION_IDS.character,
    role: "user",
    content: "Show me the multi-angle frames before training.",
    status: "complete",
    created_at: isoMinutesAgo(260),
  },
  {
    id: "0b5c1e2a-5100-4000-8000-000000000005",
    conversation_id: CONVERSATION_IDS.character,
    role: "assistant",
    content: "Here are 48 angles across three backgrounds; the spec is stored on the dataset asset.",
    status: "complete",
    created_at: isoMinutesAgo(240),
  },
];

// --- Orchestration, collaboration and storage (P2.3 / P6.1) ------------------

export const CURRENT_USER: User = {
  id: CREATOR_ID,
  email: "director@studio.local",
  display_name: "Avery Director",
  avatar_url: null,
  created_at: isoMinutesAgo(30_000),
};

export const ORGANIZATIONS: readonly Organization[] = [
  {
    id: ORG_ID,
    name: "Studio Northlight",
    slug: "studio-northlight",
    created_at: isoMinutesAgo(31_000),
  },
];

export const ORCHESTRATION_RUNS: readonly OrchestrationRun[] = [
  {
    run_id: "0b5c1e2a-6000-4000-8000-000000000001",
    plan_id: "0b5c1e2a-6100-4000-8000-000000000001",
    stage: "await",
    job_ids: [
      "0b5c1e2a-3000-4000-8000-000000000011",
      "0b5c1e2a-3000-4000-8000-000000000012",
    ],
    created_at: isoMinutesAgo(12),
  },
  {
    run_id: "0b5c1e2a-6000-4000-8000-000000000002",
    plan_id: "0b5c1e2a-6100-4000-8000-000000000002",
    stage: "done",
    job_ids: ["0b5c1e2a-3000-4000-8000-000000000017"],
    created_at: isoMinutesAgo(220),
  },
];

export const PRESENCE: readonly Presence[] = [
  {
    user_id: CREATOR_ID,
    project_id: PROJECT_IDS.moonshot,
    state: "online",
    last_seen_at: isoMinutesAgo(1),
  },
  {
    user_id: "0b5c1e2a-0000-4000-8000-0000000000bb",
    project_id: PROJECT_IDS.moonshot,
    state: "away",
    last_seen_at: isoMinutesAgo(14),
  },
  {
    user_id: "0b5c1e2a-0000-4000-8000-0000000000cc",
    project_id: PROJECT_IDS.character,
    state: "offline",
    last_seen_at: isoMinutesAgo(180),
  },
];

export const COMMENTS: readonly Comment[] = [
  {
    id: "0b5c1e2a-6200-4000-8000-000000000001",
    project_id: PROJECT_IDS.moonshot,
    asset_id: "0b5c1e2a-2000-4000-8000-000000000011",
    author_id: CREATOR_ID,
    body: "Lock the character silhouette before we expand the dataset.",
    created_at: isoMinutesAgo(60),
  },
  {
    id: "0b5c1e2a-6200-4000-8000-000000000002",
    project_id: PROJECT_IDS.moonshot,
    asset_id: null,
    author_id: "0b5c1e2a-0000-4000-8000-0000000000bb",
    body: "s01_c01 publish is approved; sidecar written.",
    created_at: isoMinutesAgo(25),
  },
];

export const STORAGE_STATS: readonly StorageStats[] = [
  {
    project_id: PROJECT_IDS.moonshot,
    quota: { used: 842_000_000, limit: 5_000_000_000, unit: "bytes" },
    object_count: 148,
  },
  {
    project_id: PROJECT_IDS.empty,
    quota: { used: 0, limit: 5_000_000_000, unit: "bytes" },
    object_count: 0,
  },
];

// --- Extension registry (P5.1 / P2.5) ---------------------------------------

export const EXTENSIONS: readonly Extension[] = [
  {
    manifest: {
      id: "comfyui-local-adapter",
      name: "Local ComfyUI adapter",
      version: "1.2.0",
      publisher: "Studio Core",
      type: "provider",
      requirements: {
        app_versions: ">=0.1.0",
        permissions: [{ name: "runtime.local", description: "Launch local generation jobs" }],
        capabilities: ["text-to-image", "image-to-image"],
        provider_ids: ["prov_comfy"],
        runtime: null,
      },
    },
    status: "enabled",
    installed_at: isoMinutesAgo(9_000),
    signed: true,
    verified: true,
  },
  {
    manifest: {
      id: "publish-audit-sidecar",
      name: "Publish audit sidecar",
      version: "0.4.1",
      publisher: "Studio Core",
      type: "capability",
      requirements: {
        app_versions: ">=0.1.0",
        permissions: [{ name: "assets.write", description: "Write publish receipts" }],
      },
    },
    status: "installed",
    installed_at: isoMinutesAgo(4_000),
  },
  {
    manifest: {
      id: "legacy-exporter",
      name: "Legacy exporter",
      version: "0.1.0",
      publisher: "Community",
      type: "ui",
      requirements: { app_versions: ">=0.1.0" },
    },
    status: "disabled",
    installed_at: isoMinutesAgo(12_000),
    signed: false,
    verified: false,
  },
];


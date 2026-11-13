/**
 * Mock API data.
 *
 * Values use the same shapes the backend returns (`src/types`, which mirror
 * `backend/app/schemas`), so screens built against mocks need no changes when
 * the live API is enabled.
 */

import type { Asset, Job, Project, Provider } from "../types";

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

function emptyProvenance() {
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
    "image-to-video",
    "upscale",
  ]),
  provider("prov_cloud", "Cloud Rendering", "cloud", "degraded", [
    "image-to-video",
    "3d-reconstruction",
  ]),
];

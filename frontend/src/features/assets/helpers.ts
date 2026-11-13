import type { Asset, AssetType } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";

const ASSET_TYPE_TONE: Readonly<Record<AssetType, BadgeTone>> = {
  image: "info",
  video: "accent",
  audio: "accent",
  model3d: "success",
  splat: "success",
  texture: "neutral",
  dataset: "warning",
  lora: "warning",
  scene: "neutral",
  resource: "neutral",
};

export const ASSET_TYPES: readonly AssetType[] = [
  "image",
  "video",
  "audio",
  "model3d",
  "splat",
  "texture",
  "dataset",
  "lora",
  "scene",
  "resource",
];

export function assetTypeTone(type: AssetType): BadgeTone {
  return ASSET_TYPE_TONE[type];
}

export function assetPreviewUrl(asset: Asset): string | null {
  return asset.preview_url ?? asset.thumbnail_url ?? null;
}

export function assetStorageLabel(asset: Asset): string {
  return asset.storage.key;
}

export function isPublishAsset(asset: Asset): boolean {
  return asset.storage.key.includes("/Publish/");
}

export function formatAssetMeta(asset: Asset): string {
  const parts: string[] = [asset.type];
  const meta = asset.metadata ?? {};
  const seq = typeof meta.sequence === "string" ? meta.sequence : null;
  const shot = typeof meta.shot === "string" ? meta.shot : null;
  if (seq && shot) parts.push(`${seq}/${shot}`);
  else if (shot) parts.push(shot);
  const slot = typeof meta.lora_slot === "string" ? meta.lora_slot : null;
  if (slot) parts.push(`LoRA: ${slot}`);
  if (typeof asset.version === "number") parts.push(`v${asset.version}`);
  return parts.join(" · ");
}

export function matchesAssetSearch(asset: Asset, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return true;
  const hay = [asset.name, asset.type, asset.storage.key, ...(asset.tags ?? [])]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function filterAssets(
  assets: readonly Asset[],
  search: string,
  typeFilter: AssetType | "all",
): readonly Asset[] {
  return assets.filter((asset) => {
    if (typeFilter !== "all" && asset.type !== typeFilter) return false;
    return matchesAssetSearch(asset, search);
  });
}

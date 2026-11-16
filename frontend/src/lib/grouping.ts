import type { Asset } from "./types";

/**
 * Pure grouping helpers for shot/sequence organization.
 *
 * Groups assets by `metadata.sequence` and `metadata.shot` following the
 * `{sequence}_{shot}` token convention in docs/PROJECT_FOLDERS.md (e.g. s01_c01).
 * No UI, no side effects.
 */

export interface ShotGroup {
  readonly sequence: string | null;
  readonly shot: string | null;
  readonly assets: readonly Asset[];
}

export interface SequenceGroup {
  readonly sequence: string | null;
  readonly shots: readonly ShotGroup[];
  readonly assets: readonly Asset[];
}

function readStringMeta(asset: Asset, key: string): string | null {
  const value = asset.metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function assetSequence(asset: Asset): string | null {
  return readStringMeta(asset, "sequence");
}

export function assetShot(asset: Asset): string | null {
  return readStringMeta(asset, "shot");
}

function sortAssets(assets: readonly Asset[]): Asset[] {
  return [...assets].sort((a, b) => {
    const t = a.created_at.localeCompare(b.created_at);
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
}

function keyOrder(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}

/** Group assets by `metadata.shot` (with sequence context preserved per asset). */
export function groupAssetsByShot(assets: readonly Asset[]): readonly ShotGroup[] {
  const groups = new Map<string, { sequence: string | null; shot: string | null; assets: Asset[] }>();
  for (const asset of assets) {
    const shot = assetShot(asset);
    const sequence = assetSequence(asset);
    const key = shot ?? "__none__";
    let group = groups.get(key);
    if (!group) {
      group = { sequence, shot, assets: [] };
      groups.set(key, group);
    } else if (group.sequence === null && sequence !== null) {
      group.sequence = sequence;
    }
    group.assets.push(asset);
  }
  return Array.from(groups.values())
    .map((g) => ({ ...g, assets: sortAssets(g.assets) }))
    .sort((a, b) => keyOrder(a.shot, b.shot));
}

/** Group assets by `metadata.sequence`, each containing shot sub-groups. */
export function groupAssetsBySequence(assets: readonly Asset[]): readonly SequenceGroup[] {
  const seqGroups = new Map<string, { sequence: string | null; assets: Asset[] }>();
  for (const asset of assets) {
    const sequence = assetSequence(asset);
    const key = sequence ?? "__none__";
    let group = seqGroups.get(key);
    if (!group) {
      group = { sequence, assets: [] };
      seqGroups.set(key, group);
    }
    group.assets.push(asset);
  }
  return Array.from(seqGroups.values())
    .map((g) => ({
      sequence: g.sequence,
      shots: groupAssetsByShot(g.assets),
      assets: sortAssets(g.assets),
    }))
    .sort((a, b) => keyOrder(a.sequence, b.sequence));
}

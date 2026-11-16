import type { Asset } from "../../lib/types";

export interface PublishReceipt {
  readonly comment: string;
  readonly publisher: string;
  readonly sidecar: string;
}

export interface VersionEntry {
  readonly asset: Asset;
  readonly versionTag: string | null;
  readonly kind: "output" | "publish";
  readonly receipt: PublishReceipt | null;
}

export interface VersionChain {
  readonly key: string;
  readonly label: string;
  readonly entries: readonly VersionEntry[];
}

function extractVersionTag(asset: Asset): string | null {
  const key = asset.storage.key;
  const match = key.match(/Ver_\d+/);
  return match ? match[0] : null;
}

function chainKeyForAsset(asset: Asset): string {
  // Group by base path without Ver_NNN and Output/Publish segment to form a chain.
  return asset.storage.key
    .replace(/\/Ver_\d+\//, "/Ver/*/")
    .replace(/\/(Output|Publish)\//, "/*/");
}

function chainLabel(key: string): string {
  const parts = key.split("/").filter(Boolean);
  if (parts.length >= 3) {
    return parts.slice(-4).join("/");
  }
  return key;
}

function readPublishReceipt(asset: Asset): PublishReceipt | null {
  const meta = asset.metadata ?? {};
  const raw = meta["publish_receipt"];
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const comment = typeof r.comment === "string" ? r.comment : null;
  const publisher = typeof r.publisher === "string" ? r.publisher : null;
  const sidecar = typeof r.sidecar === "string" ? r.sidecar : null;
  if (!comment || !publisher || !sidecar) return null;
  return { comment, publisher, sidecar };
}

export function versionLabel(asset: Asset): string {
  const tag = extractVersionTag(asset);
  return tag ?? (typeof asset.version === "number" ? `v${asset.version}` : "Unversioned");
}

export function publishReceiptSummary(asset: Asset): string | null {
  const receipt = readPublishReceipt(asset);
  if (!receipt) return null;
  return `Published by ${receipt.publisher}: ${receipt.comment}`;
}

export function buildVersionChains(assets: readonly Asset[]): readonly VersionChain[] {
  const groups = new Map<string, VersionEntry[]>();
  for (const asset of assets) {
    const tag = extractVersionTag(asset);
    const receipt = readPublishReceipt(asset);
    if (!tag && !receipt) continue;
    const key = chainKeyForAsset(asset);
    const entry: VersionEntry = {
      asset,
      versionTag: tag,
      kind: asset.storage.key.includes("/Publish/") ? "publish" : "output",
      receipt,
    };
    const list = groups.get(key);
    if (list) list.push(entry);
    else groups.set(key, [entry]);
  }
  return Array.from(groups.entries())
    .map(([key, entries]) => ({
      key,
      label: chainLabel(key),
      entries: entries.sort((a, b) => {
        const va = a.versionTag ?? "";
        const vb = b.versionTag ?? "";
        if (va !== vb) return va.localeCompare(vb);
        return a.asset.name.localeCompare(b.asset.name);
      }),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Display models for the authoritative extension installation feed (C173/C175/
 * C176 follow-up). The backend derives the newest-first, workspace-wide feed
 * fresh from the authoritative `EXTENSIONS` collection — the same store
 * `/extensions` lists and `/extensions/stats` aggregates — and the mocks
 * transport mirrors that derivation. This module only turns the canonical
 * `ExtensionFeed` payload into render-ready rows so the panel JSX stays free of
 * inline mapping and both transports render identically. Every helper tolerates
 * `undefined` (query not settled or failed) and returns render-safe values.
 */

import type { ExtensionFeedOptions } from "../../lib/extensionFeed";
import type {
  ExtensionFeed,
  ExtensionFeedItem,
  ExtensionStatus,
  ExtensionType,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { humanizeExtensionId } from "./extensionStatsHelpers";
import { extensionStatusTone } from "./helpers";

/** Render-ready row for one installed extension in the feed. */
export interface ExtensionFeedRow {
  readonly id: string;
  readonly extensionId: string;
  readonly manifestId: string;
  readonly name: string;
  readonly versionLabel: string;
  readonly publisher: string;
  readonly type: ExtensionType;
  readonly typeLabel: string;
  readonly typeTone: BadgeTone;
  readonly status: ExtensionStatus;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly trustLabel: string;
  readonly trustTone: BadgeTone;
  readonly timestamp: string;
  readonly relativeTime: string;
}

/** Page-size chips offered above the feed. */
export const EXTENSION_FEED_LIMITS: readonly number[] = [10, 25, 50];

/** Extension-type chips; `undefined` is the unfiltered "All" chip. */
export const EXTENSION_FEED_TYPE_FILTERS: readonly (ExtensionType | undefined)[] = [
  undefined,
  "capability",
  "ui",
  "provider",
  "runtime",
  "bundle",
];

/** Installation-status chips; `undefined` is the unfiltered "All" chip. */
export const EXTENSION_FEED_STATUS_FILTERS: readonly (ExtensionStatus | undefined)[] = [
  undefined,
  "installed",
  "enabled",
  "disabled",
  "update_available",
];

const TYPE_LABEL: Readonly<Record<ExtensionType, string>> = {
  capability: "Capability",
  ui: "UI",
  provider: "Provider",
  runtime: "Runtime",
  bundle: "Bundle",
};

const TYPE_TONE: Readonly<Record<ExtensionType, BadgeTone>> = {
  capability: "accent",
  ui: "info",
  provider: "accent",
  runtime: "info",
  bundle: "neutral",
};

/** Hook query options from the active type/status scope and page size. */
export function buildExtensionFeedOptions(
  type: ExtensionType | undefined,
  status: ExtensionStatus | undefined,
  limit: number,
): ExtensionFeedOptions {
  return {
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    limit,
  };
}

/** Human label for a type chip (`undefined` is the unfiltered "All" chip). */
export function extensionFeedTypeChipLabel(type: ExtensionType | undefined): string {
  return type ? (TYPE_LABEL[type] ?? humanizeExtensionId(type)) : "All";
}

/** Human label for a status chip (`undefined` is the unfiltered "All" chip). */
export function extensionFeedStatusChipLabel(status: ExtensionStatus | undefined): string {
  return status ? humanizeExtensionId(status) : "All";
}

/** Badge tone for a canonical extension type. */
export function extensionFeedTypeTone(type: ExtensionType): BadgeTone {
  return TYPE_TONE[type] ?? "neutral";
}

/** Badge tone for a canonical installation status (shared with the registry). */
export function extensionFeedStatusTone(status: ExtensionStatus): BadgeTone {
  return extensionStatusTone(status) ?? "neutral";
}

/** Compact, stable fallback for an extension with no usable display name. */
export function shortExtensionFeedId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

/** Display name preferring the friendly name, then the manifest id, then a short extension id. */
export function extensionFeedDisplayName(item: ExtensionFeedItem): string {
  if (typeof item.name === "string" && item.name.trim() !== "") return item.name;
  if (typeof item.manifest_id === "string" && item.manifest_id.trim() !== "") return item.manifest_id;
  return shortExtensionFeedId(item.extension_id);
}

/** Render-safe version label (`v` prefix) for a feed item. */
export function extensionFeedVersionLabel(version: string | undefined): string {
  if (typeof version !== "string" || version.trim() === "") return "—";
  return `v${version}`;
}

/** Trust badge label + tone; signed AND verified is the only trusted state. */
export function extensionFeedTrust(
  item: ExtensionFeedItem,
): { readonly label: string; readonly tone: BadgeTone } {
  if (item.signed === true && item.verified === true) {
    return { label: "signed · verified", tone: "success" };
  }
  return { label: "unverified", tone: "warning" };
}

/**
 * Map a canonical feed payload to render-ready rows, preserving the wire order
 * (the backend already sorts newest-first by `(installed_at, extension_id)`).
 */
export function extensionFeedRows(
  feed: ExtensionFeed | undefined,
  now: number = Date.now(),
): readonly ExtensionFeedRow[] {
  const items: readonly ExtensionFeedItem[] = feed?.items ?? [];
  return items.map((item) => {
    const trust = extensionFeedTrust(item);
    return {
      id: item.extension_id,
      extensionId: item.extension_id,
      manifestId: item.manifest_id,
      name: extensionFeedDisplayName(item),
      versionLabel: extensionFeedVersionLabel(item.version),
      publisher: item.publisher,
      type: item.type,
      typeLabel: extensionFeedTypeChipLabel(item.type),
      typeTone: extensionFeedTypeTone(item.type),
      status: item.status,
      statusLabel: extensionFeedStatusChipLabel(item.status),
      statusTone: extensionFeedStatusTone(item.status),
      trustLabel: trust.label,
      trustTone: trust.tone,
      timestamp: item.installed_at,
      relativeTime: formatRelative(item.installed_at, now),
    };
  });
}

/**
 * Header description derived from the visible rows and the untruncated total.
 * `total` counts all installed extensions in scope before the `limit` page.
 */
export function extensionFeedSummary(rows: readonly ExtensionFeedRow[], total?: number): string {
  if (rows.length === 0) return "No installed extensions";
  const count = total ?? rows.length;
  const latest = rows[0];
  return `${count} extension${count === 1 ? "" : "s"} · latest: ${latest?.name ?? "—"}`;
}

/** Compact "generated at" label for the feed footer. */
export function extensionFeedGeneratedAtLabel(
  feed: ExtensionFeed | undefined,
  now: number = Date.now(),
): string {
  if (!feed?.generated_at) return "";
  return formatRelative(feed.generated_at, now);
}

/** Scope- and filter-aware empty-state copy for the feed. */
export function extensionFeedEmptyDescription(filtered: boolean): string {
  return filtered
    ? "No installed extensions match these filters. Try a different type or status, or clear them."
    : "Installed connectors and capability packages will appear here.";
}

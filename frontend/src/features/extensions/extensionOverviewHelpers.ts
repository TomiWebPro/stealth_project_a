/**
 * Display models for the authoritative single-extension overview (C222/C224/C225
 * follow-up). Every value rendered by `ExtensionOverviewPanel` is derived here
 * from the raw `ExtensionOverview` snapshot so loading/error/missing/empty/
 * populated states stay consistent across mock and live transports and the JSX
 * stays free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error / unknown
 * extension) and return zero-filled, render-safe values. Status/type labels and
 * tones reuse the existing extension feed helpers so this view can never drift
 * from the workspace-wide extension list.
 */

import { extensionId } from "../../lib/extensionFeed";
import type { Extension, ExtensionOverview } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import {
  extensionFeedStatusChipLabel,
  extensionFeedStatusTone,
  extensionFeedTypeChipLabel,
  extensionFeedTypeTone,
} from "./extensionFeedHelpers";

export interface ExtensionOverviewStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface ExtensionOverviewIdentity {
  readonly nameLabel: string;
  readonly publisherVersionLabel: string;
  readonly manifestIdLabel: string;
  readonly shortIdLabel: string;
  readonly typeLabel: string;
  readonly typeTone: BadgeTone;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly trustLabel: string;
  readonly trustTone: BadgeTone;
  readonly runtimeLabel: string;
}

export interface ExtensionOverviewScopeGroup {
  readonly key: string;
  readonly label: string;
  readonly values: readonly string[];
}

function nonNegativeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0;
}

/** Compact relative label for a timestamp, or "" when absent. */
export function extensionOverviewRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function extensionOverviewGeneratedAtLabel(
  overview?: ExtensionOverview | null,
  now: number = Date.now(),
): string {
  return extensionOverviewRelativeLabel(overview?.generated_at, now);
}

/** Relative label for when the extension was installed, or "". */
export function extensionOverviewInstalledLabel(
  overview?: ExtensionOverview | null,
  now: number = Date.now(),
): string {
  return extensionOverviewRelativeLabel(overview?.installed_at, now);
}

/** Short, human-friendly label for a uuid extension id in a compact header. */
export function extensionOverviewShortId(extensionIdValue?: string | null): string {
  if (!extensionIdValue) return "—";
  return extensionIdValue.length > 8 ? `${extensionIdValue.slice(0, 8)}…` : extensionIdValue;
}

/** Pick the display name, preferring a real name then the manifest id. */
export function extensionOverviewName(overview?: ExtensionOverview | null): string {
  if (typeof overview?.name === "string" && overview.name.trim() !== "") {
    return overview.name;
  }
  if (typeof overview?.manifest_id === "string" && overview.manifest_id.trim() !== "") {
    return overview.manifest_id;
  }
  return "Unknown extension";
}

/** Picker option label for one installed extension. */
export function extensionOverviewOptionLabel(extension: Extension): string {
  const manifest = extension.manifest;
  const name =
    typeof manifest?.name === "string" && manifest.name.trim() !== ""
      ? manifest.name
      : "Unnamed extension";
  const id = typeof manifest?.id === "string" && manifest.id.trim() !== "" ? manifest.id : "";
  return id ? `${name} · ${id}` : name;
}

/** Picker option value: the deterministic uuid5 id expected by the overview API. */
export function extensionOverviewOptionValue(extension: Extension): string {
  return extensionId(extension.manifest?.id ?? "");
}

/** Authoritative declaration totals, zero-filled for missing/malformed snapshots. */
export function extensionOverviewCounts(overview?: ExtensionOverview | null) {
  const counts = overview?.counts;
  return {
    permissions: nonNegativeCount(counts?.permissions),
    capabilities: nonNegativeCount(counts?.capabilities),
    providerIds: nonNegativeCount(counts?.provider_ids),
    uiContributions: nonNegativeCount(counts?.ui_contributions),
    dependencies: nonNegativeCount(counts?.dependencies),
  };
}

/** Identity/trust badges for the snapshot header. */
export function extensionOverviewIdentity(
  overview?: ExtensionOverview | null,
): ExtensionOverviewIdentity {
  const signed = overview?.signed === true;
  const verified = overview?.verified === true;
  const trusted = signed && verified;
  const version = typeof overview?.version === "string" && overview.version.trim() !== ""
    ? `v${overview.version}`
    : "—";
  const publisher =
    typeof overview?.publisher === "string" && overview.publisher.trim() !== ""
      ? overview.publisher
      : "Unknown publisher";
  return {
    nameLabel: extensionOverviewName(overview),
    publisherVersionLabel: `${publisher} · ${version}`,
    manifestIdLabel:
      typeof overview?.manifest_id === "string" && overview.manifest_id.trim() !== ""
        ? overview.manifest_id
        : "—",
    shortIdLabel: extensionOverviewShortId(overview?.extension_id),
    typeLabel: overview?.type ? extensionFeedTypeChipLabel(overview.type) : "Unknown",
    typeTone: overview?.type ? extensionFeedTypeTone(overview.type) : "neutral",
    statusLabel: overview?.status ? extensionFeedStatusChipLabel(overview.status) : "Unknown",
    statusTone: overview?.status ? extensionFeedStatusTone(overview.status) : "neutral",
    trustLabel: trusted ? "signed · verified" : "unverified",
    trustTone: trusted ? "success" : "warning",
    runtimeLabel:
      typeof overview?.runtime === "string" && overview.runtime.trim() !== ""
        ? overview.runtime
        : "—",
  };
}

/** The five headline declaration counters, in a stable display order. */
export function extensionOverviewStatRows(
  overview?: ExtensionOverview | null,
): ExtensionOverviewStat[] {
  const counts = extensionOverviewCounts(overview);
  return [
    {
      key: "permissions",
      label: "Permissions",
      value: String(counts.permissions),
      hint: "Declared permission names",
    },
    {
      key: "capabilities",
      label: "Capabilities",
      value: String(counts.capabilities),
      hint: "Declared capabilities",
    },
    {
      key: "providers",
      label: "Providers",
      value: String(counts.providerIds),
      hint: "Bound provider ids",
    },
    {
      key: "ui",
      label: "UI contributions",
      value: String(counts.uiContributions),
      hint: "Contributed UI panels",
    },
    {
      key: "dependencies",
      label: "Dependencies",
      value: String(counts.dependencies),
      hint: "Declared extension dependencies",
    },
  ];
}

function scopeValues(values: readonly (string | null | undefined)[] | undefined): string[] {
  return (values ?? []).filter(
    (value): value is string => typeof value === "string" && value.trim() !== "",
  );
}

/** Declared scope lists projected into render-ready, labeled chip groups. */
export function extensionOverviewScopeGroups(
  overview?: ExtensionOverview | null,
): ExtensionOverviewScopeGroup[] {
  return [
    { key: "permissions", label: "Permissions", values: scopeValues(overview?.permissions) },
    { key: "capabilities", label: "Capabilities", values: scopeValues(overview?.capabilities) },
    { key: "providers", label: "Provider ids", values: scopeValues(overview?.provider_ids) },
    {
      key: "ui",
      label: "UI contributions",
      values: scopeValues(overview?.ui_contributions),
    },
    { key: "dependencies", label: "Dependencies", values: scopeValues(overview?.dependencies) },
  ];
}

/** Total number of emitted scope entries across all declaration groups. */
export function extensionOverviewScopeTotal(overview?: ExtensionOverview | null): number {
  return extensionOverviewScopeGroups(overview).reduce(
    (total, group) => total + group.values.length,
    0,
  );
}

/** False only when the snapshot is missing or declares no scope at all. */
export function hasExtensionOverviewData(overview?: ExtensionOverview | null): boolean {
  if (!overview) return false;
  const counts = extensionOverviewCounts(overview);
  return (
    counts.permissions > 0 ||
    counts.capabilities > 0 ||
    counts.providerIds > 0 ||
    counts.uiContributions > 0 ||
    counts.dependencies > 0 ||
    extensionOverviewScopeTotal(overview) > 0
  );
}

/** One-line summary for the panel header/footer. */
export function extensionOverviewSummaryLabel(
  overview?: ExtensionOverview | null,
): string {
  if (!overview) return "";
  const counts = extensionOverviewCounts(overview);
  return `${counts.permissions} permissions · ${counts.capabilities} capabilities · ${counts.providerIds} providers`;
}

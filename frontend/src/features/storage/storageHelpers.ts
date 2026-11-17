import type { StorageStats } from "../../lib/types";
// StorageQuotaUnit is not yet re-exported from the UI contract surface; import
// the canonical type directly (read-only) until the mocks agent adds it there.
import type { StorageQuotaUnit } from "../../types";
import type { BadgeTone } from "../../ui/Badge";

/**
 * Display model for a project's storage quota. Every value shown by the panel is
 * derived here (never inline in JSX) so empty/populated/over-quota states are
 * consistent across mock and live transports.
 */
export interface StorageUsage {
  /** Human-readable used amount, e.g. "803 MB" or "7". */
  readonly usedLabel: string;
  /** Human-readable quota amount, e.g. "4.7 GB" or "10". */
  readonly limitLabel: string;
  /** Normalized 0..1 fill used by the progress bar. */
  readonly usedFraction: number;
  /** Rounded 0..100 percentage for labels/tests. */
  readonly usedPercent: number;
  /** Human-readable remaining capacity, clamped at zero. */
  readonly remainingLabel: string;
  /** Object count sentence, e.g. "148 objects". */
  readonly objectCountLabel: string;
  /** True when there is anything stored or a meaningful quota. */
  readonly hasObjects: boolean;
  /** True when usage exceeds the (non-zero) quota. */
  readonly isOverQuota: boolean;
  /** Badge tone reflecting how full the quota is. */
  readonly tone: BadgeTone;
  /** Short status label matching the tone. */
  readonly statusLabel: string;
}

/** Formats a byte count with binary (1024-based) units. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"] as const;
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[index]}`;
}

/** Formats a quota value according to its unit (bytes or raw object count). */
export function formatQuotaValue(value: number, unit: StorageQuotaUnit): string {
  return unit === "objects" ? Math.max(0, Math.round(value)).toLocaleString("en-US") : formatBytes(value);
}

function toneFor(percent: number, hasQuota: boolean, isOverQuota: boolean): BadgeTone {
  if (!hasQuota) return "neutral";
  if (isOverQuota || percent >= 90) return "danger";
  if (percent >= 70) return "warning";
  return "success";
}

function labelFor(tone: BadgeTone): string {
  switch (tone) {
    case "danger":
      return "Over quota";
    case "warning":
      return "Nearly full";
    case "success":
      return "Healthy";
    default:
      return "No quota set";
  }
}

/** Derives every value the storage panel renders from a raw StorageStats payload. */
export function storageUsage(stats: StorageStats): StorageUsage {
  const unit: StorageQuotaUnit = stats.quota.unit ?? "bytes";
  const used = Math.max(0, stats.quota.used || 0);
  const limit = Math.max(0, stats.quota.limit || 0);
  const objectCount = Math.max(0, stats.object_count ?? 0);
  const hasQuota = limit > 0;
  const rawFraction = hasQuota ? used / limit : 0;
  const usedFraction = Math.min(1, Math.max(0, Number.isFinite(rawFraction) ? rawFraction : 0));
  const usedPercent = Math.round(usedFraction * 100);
  const isOverQuota = hasQuota && used > limit;
  const tone = toneFor(usedPercent, hasQuota, isOverQuota);

  return {
    usedLabel: formatQuotaValue(used, unit),
    limitLabel: formatQuotaValue(limit, unit),
    usedFraction,
    usedPercent,
    remainingLabel: formatQuotaValue(Math.max(0, limit - used), unit),
    objectCountLabel: `${objectCount.toLocaleString("en-US")} object${objectCount === 1 ? "" : "s"}`,
    hasObjects: objectCount > 0 || used > 0,
    isOverQuota,
    tone,
    statusLabel: labelFor(tone),
  };
}

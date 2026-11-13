import type { AssetType, JobStatus, ProviderStatus } from "../../lib/types";
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

const JOB_STATUS_TONE: Readonly<Record<JobStatus, BadgeTone>> = {
  queued: "neutral",
  running: "info",
  succeeded: "success",
  failed: "danger",
  canceled: "neutral",
};

const PROVIDER_STATUS_TONE: Readonly<Record<ProviderStatus, BadgeTone>> = {
  available: "success",
  unavailable: "danger",
  degraded: "warning",
};

export function assetTypeTone(type: AssetType): BadgeTone {
  return ASSET_TYPE_TONE[type];
}

export function jobStatusTone(status: JobStatus): BadgeTone {
  return JOB_STATUS_TONE[status];
}

export function providerStatusTone(status: ProviderStatus): BadgeTone {
  return PROVIDER_STATUS_TONE[status];
}

interface RelativeUnit {
  readonly limitMs: number;
  readonly divisorMs: number;
  readonly unit: Intl.RelativeTimeFormatUnit;
}

const RELATIVE_UNITS: readonly RelativeUnit[] = [
  { limitMs: 60_000, divisorMs: 1_000, unit: "second" },
  { limitMs: 3_600_000, divisorMs: 60_000, unit: "minute" },
  { limitMs: 86_400_000, divisorMs: 3_600_000, unit: "hour" },
  { limitMs: 604_800_000, divisorMs: 86_400_000, unit: "day" },
];

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const absoluteFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

/** Formats an ISO timestamp as a compact relative time ("3 hours ago"). */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return iso;
  }
  const deltaMs = now - timestamp;

  for (const { limitMs, divisorMs, unit } of RELATIVE_UNITS) {
    if (Math.abs(deltaMs) < limitMs) {
      // `Math.trunc` keeps the sign so past vs future ("5 minutes ago" /
      // "in 5 minutes") matches the value magnitude. Rounding toward zero
      // avoids "-0" flipping "now" into "in 0 seconds".
      return relativeFormatter.format(-Math.trunc(deltaMs / divisorMs), unit);
    }
  }
  return absoluteFormatter.format(new Date(timestamp));
}

import type { Provider, ProviderLocation, ProviderStatus } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";

export interface HealthSummary {
  readonly total: number;
  readonly available: number;
  readonly degraded: number;
  readonly unavailable: number;
  readonly healthPercent: number;
  readonly label: string;
  readonly tone: BadgeTone;
}

export interface RuntimeGroup {
  readonly location: ProviderLocation;
  readonly label: string;
  readonly total: number;
  readonly available: number;
  readonly degraded: number;
}

export const LOCATION_LABEL: Readonly<Record<ProviderLocation, string>> = {
  local: "Local runtimes",
  studio: "Studio runtimes",
  cloud: "Cloud providers",
};

const HEALTH_TONE: Readonly<Record<ProviderStatus, BadgeTone>> = {
  available: "success",
  degraded: "warning",
  unavailable: "danger",
};

export function providerHealthSummary(providers: readonly Provider[]): HealthSummary {
  const available = providers.filter((provider) => provider.status === "available").length;
  const degraded = providers.filter((provider) => provider.status === "degraded").length;
  const unavailable = providers.filter((provider) => provider.status === "unavailable").length;
  const total = providers.length;
  const healthPercent = total === 0 ? 0 : Math.round((available / total) * 100);
  const tone: BadgeTone =
    total === 0 || unavailable > 0 ? "neutral" : degraded > 0 ? "warning" : "success";
  const label =
    total === 0
      ? "No providers registered"
      : unavailable > 0
        ? "Degraded — some providers unavailable"
        : degraded > 0
          ? "Partially degraded"
          : "All providers healthy";
  return { total, available, degraded, unavailable, healthPercent, label, tone };
}

export function runtimeGroups(providers: readonly Provider[]): readonly RuntimeGroup[] {
  const locations: readonly ProviderLocation[] = ["local", "studio", "cloud"];
  return locations
    .map((location) => {
      const members = providers.filter((provider) => provider.location === location);
      return {
        location,
        label: LOCATION_LABEL[location],
        total: members.length,
        available: members.filter((provider) => provider.status === "available").length,
        degraded: members.filter((provider) => provider.status === "degraded").length,
      };
    })
    .filter((group) => group.total > 0);
}

export function filterProviders(
  providers: readonly Provider[],
  location: ProviderLocation | "all",
  status: ProviderStatus | "all",
): readonly Provider[] {
  return providers.filter((provider) => {
    if (location !== "all" && provider.location !== location) return false;
    if (status !== "all" && provider.status !== status) return false;
    return true;
  });
}

export function degradedProviderIds(providers: readonly Provider[]): readonly string[] {
  return providers
    .filter((provider) => provider.status !== "available")
    .map((provider) => provider.id);
}

export function statusTone(status: ProviderStatus): BadgeTone {
  return HEALTH_TONE[status];
}

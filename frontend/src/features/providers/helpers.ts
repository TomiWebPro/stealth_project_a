import type { Provider } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";

export function providerStatusTone(status: Provider["status"]): BadgeTone {
  switch (status) {
    case "available":
      return "success";
    case "degraded":
      return "warning";
    case "unavailable":
      return "danger";
    default:
      return "neutral";
  }
}

export function providerLocationLabel(location: Provider["location"]): string {
  switch (location) {
    case "local":
      return "Local";
    case "studio":
      return "Studio";
    case "cloud":
      return "Cloud";
    default:
      return location;
  }
}

/** Flat operation IDs from provider capabilities (mock-derived). */
export function providerOperationIds(provider: Provider): readonly string[] {
  return (provider.capabilities ?? []).map((capability) => capability.operation_id);
}

export function formatCapabilitiesSummary(provider: Provider): string {
  const ops = providerOperationIds(provider);
  if (ops.length === 0) return "No capabilities reported";
  return `${ops.length} operation${ops.length === 1 ? "" : "s"}`;
}

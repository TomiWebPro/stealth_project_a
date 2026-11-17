import { describe, expect, it } from "vitest";
import type { Provider } from "../../lib/types";
import {
  degradedProviderIds,
  filterProviders,
  providerHealthSummary,
  runtimeGroups,
} from "./healthHelpers";

function provider(id: string, location: Provider["location"], status: Provider["status"]): Provider {
  return { id, name: id, location, status, capabilities: [] };
}

const providers = [
  provider("a", "local", "available"),
  provider("b", "studio", "degraded"),
  provider("c", "cloud", "unavailable"),
];

describe("provider health helpers", () => {
  it("summarizes health and chooses a status tone", () => {
    expect(providerHealthSummary(providers)).toMatchObject({
      total: 3,
      available: 1,
      degraded: 1,
      unavailable: 1,
      healthPercent: 33,
      tone: "neutral",
    });
    expect(providerHealthSummary([]).label).toBe("No providers registered");
  });

  it("groups runtimes by location", () => {
    const groups = runtimeGroups(providers);
    expect(groups.map((group) => group.label)).toEqual([
      "Local runtimes",
      "Studio runtimes",
      "Cloud providers",
    ]);
    expect(groups[1]).toMatchObject({ total: 1, degraded: 1 });
  });

  it("filters by location and status", () => {
    expect(filterProviders(providers, "local", "all").map((item) => item.id)).toEqual(["a"]);
    expect(filterProviders(providers, "all", "degraded").map((item) => item.id)).toEqual(["b"]);
    expect(filterProviders(providers, "local", "degraded")).toEqual([]);
  });

  it("lists non-healthy provider ids", () => {
    expect(degradedProviderIds(providers)).toEqual(["b", "c"]);
  });
});

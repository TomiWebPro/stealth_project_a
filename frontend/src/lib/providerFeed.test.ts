import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import type { Provider } from "./types";
import {
  deriveProviderFeed,
  providerFeedQueryParams,
  validateProviderFeedArgs,
} from "./providerFeed";

const NOW = "2026-11-19T12:00:00Z";

const providers: Provider[] = [
  {
    id: "prov-z",
    name: "Zeta Runtime",
    location: "cloud",
    status: "degraded",
    capabilities: [
      { operation_id: "text-to-video" },
      { operation_id: "image-to-video" },
      { operation_id: "image-to-video" }, // duplicate advertising is visible in the count
    ],
  },
  {
    id: "prov-a",
    name: "Alpha Runtime",
    location: "local",
    status: "available",
    capabilities: [{ operation_id: "text-to-image" }],
  },
  {
    id: "prov-b",
    name: "Alpha Runtime",
    location: "studio",
    status: "available",
    capabilities: [],
  },
];

describe("deriveProviderFeed", () => {
  it("projects providers in ascending (name, provider_id) order with deduped operation ids", () => {
    const feed = deriveProviderFeed(providers, NOW);
    expect(feed.total).toBe(3);
    expect((feed.items ?? []).map((item) => item.provider_id)).toEqual([
      "prov-a",
      "prov-b",
      "prov-z",
    ]);
    expect(feed.items?.[0]).toMatchObject({
      provider_id: "prov-a",
      name: "Alpha Runtime",
      location: "local",
      status: "available",
      operation_ids: ["text-to-image"],
      capability_count: 1,
    });
    expect(feed.items?.find((item) => item.provider_id === "prov-z")).toMatchObject({
      operation_ids: ["image-to-video", "text-to-video"],
      capability_count: 3,
    });
    expect(feed.items?.find((item) => item.provider_id === "prov-b")?.operation_ids).toEqual([]);
    expect(feed.generated_at).toBe(NOW);
  });

  it("filters by location and status independently", () => {
    expect(deriveProviderFeed(providers, NOW, { location: "cloud" }).total).toBe(1);
    expect(deriveProviderFeed(providers, NOW, { status: "available" }).total).toBe(2);
    expect(deriveProviderFeed(providers, NOW, { location: "studio", status: "available" }).items?.[0]?.provider_id).toBe("prov-b");
    expect(deriveProviderFeed(providers, NOW, { location: "cloud", status: "available" })).toEqual({
      items: [],
      total: 0,
      generated_at: NOW,
    });
  });

  it("bounds the page with a whole-scope total counted before paging", () => {
    const feed = deriveProviderFeed(providers, NOW, { limit: 2 });
    expect(feed.total).toBe(3);
    expect(feed.items ?? []).toHaveLength(2);
  });

  it("returns an empty feed for an empty registry", () => {
    expect(deriveProviderFeed([], NOW)).toEqual({ items: [], total: 0, generated_at: NOW });
  });
});

describe("validateProviderFeedArgs", () => {
  it("accepts empty options and well-formed filters and limits", () => {
    expect(() => validateProviderFeedArgs()).not.toThrow();
    expect(() =>
      validateProviderFeedArgs({ location: "cloud", status: "degraded", limit: 200 }),
    ).not.toThrow();
  });

  it("rejects an invalid location or status with a 422", () => {
    expect(() => validateProviderFeedArgs({ location: "moon" as never })).toThrowError(ApiError);
    expect(() => validateProviderFeedArgs({ status: "busy" as never })).toThrowError(ApiError);
    try {
      validateProviderFeedArgs({ location: "moon" as never });
    } catch (cause) {
      expect(cause).toMatchObject({ status: 422, code: "validation_error" });
    }
  });

  it.each([0, 201, -1, 1.5])("rejects an out-of-range limit (%s) with a 422", (limit) => {
    expect(() => validateProviderFeedArgs({ limit })).toThrowError(ApiError);
  });
});

describe("providerFeedQueryParams", () => {
  it("maps options to the wire query string", () => {
    expect(
      providerFeedQueryParams({ location: "cloud", status: "degraded", limit: 5 }),
    ).toEqual({ location: "cloud", status: "degraded", limit: 5 });
    expect(providerFeedQueryParams()).toEqual({
      location: undefined,
      status: undefined,
      limit: undefined,
    });
  });
});

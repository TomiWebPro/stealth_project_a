import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import type { OperationSpec } from "./types";
import {
  deriveOperationFeed,
  operationFeedQueryParams,
  validateOperationFeedArgs,
} from "./operationFeed";

const NOW = "2026-11-19T12:00:00Z";

const operations: OperationSpec[] = [
  {
    id: "zeta-op",
    title: "Zeta operation",
    description: "A streamed, multi-provider operation.",
    schema_version: "v2",
    streaming: true,
    input: { asset_types: ["image"] },
    output: { asset_types: ["video"], required: true },
    settings: [{ key: "steps", label: "Steps", type: "integer" }],
    provider_ids: ["prov-b", "prov-a", "prov-b", "prov-c"],
  },
  {
    id: "alpha-op",
    title: "Alpha operation",
    schema_version: "v1",
    input: { asset_types: ["image"] },
    output: { asset_types: ["image"] },
    settings: [
      { key: "width", label: "Width", type: "integer" },
      { key: "height", label: "Height", type: "integer" },
    ],
  },
  {
    id: "beta-op",
    title: "Alpha operation",
    schema_version: "v1",
    streaming: false,
    provider_ids: ["prov-c"],
  },
];

describe("deriveOperationFeed", () => {
  it("projects operations in ascending (title, operation_id) order with deduped provider bindings", () => {
    const feed = deriveOperationFeed(operations, NOW);
    expect(feed.total).toBe(3);
    expect((feed.items ?? []).map((item) => item.operation_id)).toEqual([
      "alpha-op",
      "beta-op",
      "zeta-op",
    ]);
    expect(feed.items?.[2]).toMatchObject({
      operation_id: "zeta-op",
      title: "Zeta operation",
      description: "A streamed, multi-provider operation.",
      schema_version: "v2",
      input_types: ["image"],
      output_types: ["video"],
      settings_count: 1,
      streaming: true,
      provider_ids: ["prov-a", "prov-b", "prov-c"],
      provider_count: 3,
    });
    expect(feed.items?.[1]).toMatchObject({ streaming: false, provider_count: 1 });
    expect(feed.items?.[0]).toMatchObject({
      description: undefined,
      streaming: false,
      provider_ids: [],
      provider_count: 0,
      settings_count: 2,
    });
    expect(feed.generated_at).toBe(NOW);
  });

  it("filters by streaming and provider id independently", () => {
    expect(deriveOperationFeed(operations, NOW, { streaming: true }).total).toBe(1);
    expect(deriveOperationFeed(operations, NOW, { streaming: false }).total).toBe(2);
    expect(
      deriveOperationFeed(operations, NOW, { provider_id: "prov-c" }).items?.map(
        (item) => item.operation_id,
      ),
    ).toEqual(["beta-op", "zeta-op"]);
    expect(deriveOperationFeed(operations, NOW, { provider_id: "prov-a" }).total).toBe(1);
    expect(deriveOperationFeed(operations, NOW, { streaming: false, provider_id: "prov-c" })).toEqual({
      items: [
        {
          operation_id: "beta-op",
          title: "Alpha operation",
          description: undefined,
          schema_version: "v1",
          input_types: [],
          output_types: [],
          settings_count: 0,
          streaming: false,
          provider_ids: ["prov-c"],
          provider_count: 1,
        },
      ],
      total: 1,
      generated_at: NOW,
    });
    expect(deriveOperationFeed(operations, NOW, { provider_id: "missing" })).toEqual({
      items: [],
      total: 0,
      generated_at: NOW,
    });
  });

  it("bounds the page with a whole-scope total counted before paging", () => {
    const feed = deriveOperationFeed(operations, NOW, { limit: 2 });
    expect(feed.total).toBe(3);
    expect(feed.items ?? []).toHaveLength(2);
  });

  it("returns an empty feed for an empty catalog", () => {
    expect(deriveOperationFeed([], NOW)).toEqual({ items: [], total: 0, generated_at: NOW });
  });
});

describe("validateOperationFeedArgs", () => {
  it("accepts empty options and well-formed filters and limits", () => {
    expect(() => validateOperationFeedArgs()).not.toThrow();
    expect(() =>
      validateOperationFeedArgs({ streaming: false, provider_id: "", limit: 200 }),
    ).not.toThrow();
  });

  it("rejects an invalid streaming value or provider id with a 422", () => {
    expect(() => validateOperationFeedArgs({ streaming: "yes" as never })).toThrowError(ApiError);
    expect(() => validateOperationFeedArgs({ provider_id: 42 as never })).toThrowError(ApiError);
    try {
      validateOperationFeedArgs({ streaming: "yes" as never });
    } catch (cause) {
      expect(cause).toMatchObject({ status: 422, code: "validation_error" });
    }
  });

  it.each([0, 201, -1, 1.5])("rejects an out-of-range limit (%s) with a 422", (limit) => {
    expect(() => validateOperationFeedArgs({ limit })).toThrowError(ApiError);
  });
});

describe("operationFeedQueryParams", () => {
  it("maps options to the wire query string, preserving a false streaming filter", () => {
    expect(
      operationFeedQueryParams({ streaming: false, provider_id: "prov-a", limit: 5 }),
    ).toEqual({ streaming: false, provider_id: "prov-a", limit: 5 });
    expect(operationFeedQueryParams()).toEqual({
      streaming: undefined,
      provider_id: undefined,
      limit: undefined,
    });
  });
});

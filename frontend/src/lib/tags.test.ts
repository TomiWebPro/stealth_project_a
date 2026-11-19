import { describe, expect, it } from "vitest";

import type { Asset, AssetStatus } from "./types";
import { deriveTagIndex, tagQueryParams, validateTagArgs } from "./tags";
import { PROJECTS } from "./mock/data";

const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";

function asset(
  id: string,
  tags: string[],
  overrides: Partial<Asset> = {},
): Asset {
  return {
    id,
    project_id: filmId,
    type: "image",
    name: id,
    creator_id: "0b5c1e2a-0000-4000-8000-0000000000aa",
    storage: { key: `Output/${id}`, size_bytes: 1, content_type: "image/png" },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    tags,
    ...overrides,
  };
}

describe("deriveTagIndex", () => {
  it("counts most-used-first with a stable lexical tie-break and a pre-limit total", () => {
    const index = deriveTagIndex([
      asset("a", ["alpha", "shared"]),
      asset("b", ["beta", "shared"]),
      asset("c", ["shared"]),
    ]);
    expect(index.tags?.[0]).toEqual({ name: "shared", count: 3 });
    expect(index.tags?.slice(1)).toEqual([
      { name: "alpha", count: 1 },
      { name: "beta", count: 1 },
    ]);
    expect(index.total).toBe(3);
  });

  it("counts each tag at most once per asset and ignores empty tags", () => {
    const index = deriveTagIndex([asset("a", ["dup", "dup", "", "unique"])]);
    expect(index.tags).toEqual([
      { name: "dup", count: 1 },
      { name: "unique", count: 1 },
    ]);
  });

  it("applies a case-insensitive prefix before counting", () => {
    const index = deriveTagIndex(
      [asset("a", ["Character", "prop", "CHAR-coat"]), asset("b", ["char", "prop"])],
      { prefix: "CHAR" },
    );
    expect(index.tags).toEqual([
      { name: "char", count: 1 },
      { name: "CHAR-coat", count: 1 },
      { name: "Character", count: 1 },
    ]);
    expect(index.total).toBe(3);
  });

  it("excludes deleted assets and scopes by project", () => {
    const index = deriveTagIndex(
      [
        asset("a", ["live"]),
        asset("b", ["gone"], { status: "deleted" as AssetStatus }),
        asset("c", ["other"], { project_id: "00000000-0000-4000-8000-000000000000" }),
      ],
      { projectId: filmId },
    );
    expect(index.tags).toEqual([{ name: "live", count: 1 }]);
  });

  it("returns an empty index for empty inputs or an unmatched filter", () => {
    expect(deriveTagIndex([])).toEqual({ tags: [], total: 0 });
    expect(deriveTagIndex([asset("a", ["alpha"])], { prefix: "zzz" })).toEqual({
      tags: [],
      total: 0,
    });
  });

  it("caps the returned facets without changing total", () => {
    const index = deriveTagIndex([asset("a", ["a", "b", "c"])], { limit: 2 });
    expect(index.tags).toHaveLength(2);
    expect(index.total).toBe(3);
  });
});

describe("validateTagArgs", () => {
  it("rejects a malformed project id, empty prefix and out-of-range limit with 422", () => {
    expect(() => validateTagArgs({ projectId: "not-a-uuid" })).toThrowError(
      expect.objectContaining({
        status: 422,
        code: "validation_error",
        details: [expect.objectContaining({ field: "project_id" })],
      }),
    );
    expect(() => validateTagArgs({ prefix: "" })).toThrowError(
      expect.objectContaining({
        status: 422,
        details: [expect.objectContaining({ field: "prefix" })],
      }),
    );
    for (const limit of [0, 201]) {
      expect(() => validateTagArgs({ limit })).toThrowError(
        expect.objectContaining({
          status: 422,
          details: [expect.objectContaining({ field: "limit" })],
        }),
      );
    }
  });

  it("accepts valid or omitted filters", () => {
    expect(() => validateTagArgs()).not.toThrow();
    expect(() =>
      validateTagArgs({ projectId: filmId, prefix: "char", limit: 10 }),
    ).not.toThrow();
  });
});

describe("tagQueryParams", () => {
  it("maps filter names to the authoritative query strings", () => {
    expect(tagQueryParams()).toEqual({ project_id: undefined, prefix: undefined, limit: undefined });
    expect(tagQueryParams({ projectId: "p", prefix: "char", limit: 5 })).toEqual({
      project_id: "p",
      prefix: "char",
      limit: 5,
    });
  });
});

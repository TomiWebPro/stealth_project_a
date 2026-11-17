import { describe, expect, it } from "vitest";

import type { Asset, Conversation, Project } from "./types";
import { deriveSearchResponse, searchQueryParams, validateSearchArgs } from "./search";

const NOW = "2026-01-01T00:00:00Z";

function project(id: string, name: string, description?: string): Project {
  return {
    id,
    name,
    description: description ?? null,
    org_id: "org",
    created_by: "user",
    created_at: NOW,
    updated_at: NOW,
  };
}

function asset(
  id: string,
  name: string,
  options: { tags?: string[]; status?: Asset["status"]; projectId?: string } = {},
): Asset {
  return {
    id,
    name,
    project_id: options.projectId ?? "p1",
    type: "image",
    creator_id: "user",
    tags: options.tags,
    status: options.status,
    storage: { key: name, size_bytes: 1, content_type: "image/png" },
    created_at: NOW,
    updated_at: NOW,
  };
}

function conversation(id: string, title: string, projectId = "p1"): Conversation {
  return {
    id,
    title,
    project_id: projectId,
    created_by: "user",
    created_at: NOW,
    updated_at: NOW,
  };
}

const projects = [project("p1", "Moonshot film", "A short film"), project("p2", "Other film")];
const assets = [
  asset("a1", "moonshot frame.png", { tags: ["hero"] }),
  asset("a2", "frame.png", { tags: ["moonshot", "hero"] }),
  asset("a3", "deleted moonshot", { status: "deleted" }),
  asset("a4", "the moonshot edit"),
];
const conversations = [conversation("c1", "moonshot plan")];

describe("deriveSearchResponse", () => {
  it("ranks every domain best-first with stable kind/insertion tie-breaks", () => {
    const response = deriveSearchResponse("moonshot", projects, assets, conversations);
    expect(response.query).toBe("moonshot");
    expect(response.results?.map((result) => result.id)).toEqual([
      "p1",
      "a1",
      "c1",
      "a4",
      "a2",
    ]);
    // Ties on 1.0 break on kind order: project, then asset, then conversation.
    expect(response.results?.[0]).toMatchObject({
      kind: "project",
      title: "Moonshot film",
      subtitle: "A short film",
      project_id: "p1",
      score: 1,
    });
    expect(response.results?.[2]).toMatchObject({ kind: "conversation", subtitle: "Moonshot film" });
  });

  it("scores a prefix match above a later substring match", () => {
    const result = deriveSearchResponse("moonshot", projects, assets, conversations, {
      kind: "asset",
    });
    const prefix = result.results?.find((row) => row.id === "a1");
    const later = result.results?.find((row) => row.id === "a4");
    expect(prefix?.score).toBe(1);
    expect(later?.score).toBeCloseTo(0.7778, 4);
    expect(prefix?.score ?? 0).toBeGreaterThan(later?.score ?? 0);
  });

  it("weights an asset tag match at 75% of a name match", () => {
    const result = deriveSearchResponse("moonshot", projects, assets, conversations, {
      kind: "asset",
    });
    expect(result.results?.find((row) => row.id === "a2")?.score).toBe(0.75);
    expect(result.results?.find((row) => row.id === "a1")?.score).toBe(1);
  });

  it("excludes deleted assets even when their name matches", () => {
    const result = deriveSearchResponse("moonshot", projects, assets, conversations);
    expect(result.results?.some((row) => row.id === "a3")).toBe(false);
  });

  it("restricts results to the requested kind", () => {
    const onlyAssets = deriveSearchResponse("moonshot", projects, assets, conversations, {
      kind: "asset",
    });
    expect(onlyAssets.results?.every((row) => row.kind === "asset")).toBe(true);
    expect(onlyAssets.results?.map((row) => row.id)).toEqual(["a1", "a4", "a2"]);
  });

  it("caps results at the requested limit", () => {
    expect(
      deriveSearchResponse("moonshot", projects, assets, conversations, { limit: 2 }).results,
    ).toHaveLength(2);
  });

  it("returns an empty result set for a blank query without error", () => {
    const response = deriveSearchResponse("   ", projects, assets, conversations);
    expect(response).toEqual({ query: "   ", results: [] });
  });

  it("leaves a conversation subtitle null when its owner project is unknown", () => {
    const orphan = conversation("c2", "moonshot orphan", "missing");
    const response = deriveSearchResponse("orphan", projects, assets, [orphan], {
      kind: "conversation",
    });
    expect(response.results?.[0]).toMatchObject({
      kind: "conversation",
      project_id: "missing",
      subtitle: null,
    });
  });

  it("is case-insensitive and deterministic across repeated calls", () => {
    const first = deriveSearchResponse("MOONSHOT", projects, assets, conversations);
    const second = deriveSearchResponse("moonshot", projects, assets, conversations);
    expect(first.results).toEqual(second.results);
  });
});

describe("validateSearchArgs", () => {
  it("rejects blank/over-long queries, unknown kinds and out-of-range limits", () => {
    expect(() => validateSearchArgs("")).toThrow();
    expect(() => validateSearchArgs("x".repeat(201))).toThrow();
    expect(() => validateSearchArgs("ok", { kind: "asset", limit: 0 })).toThrow();
    expect(() => validateSearchArgs("ok", { limit: 101 })).toThrow();
    expect(() => validateSearchArgs("ok", { kind: "bogus" as "asset" })).toThrow();
  });

  it("accepts valid filters and whitespace-only queries (matching FastAPI min_length)", () => {
    expect(() => validateSearchArgs("ok")).not.toThrow();
    expect(() => validateSearchArgs("   ")).not.toThrow();
    expect(() => validateSearchArgs("ok", { kind: "asset", limit: 100 })).not.toThrow();
  });
});

describe("searchQueryParams", () => {
  it("maps the query and optional filters onto wire parameters", () => {
    expect(searchQueryParams("mara")).toEqual({
      q: "mara",
      kind: undefined,
      limit: undefined,
    });
    expect(searchQueryParams("mara", { kind: "asset", limit: 5 })).toEqual({
      q: "mara",
      kind: "asset",
      limit: 5,
    });
  });
});

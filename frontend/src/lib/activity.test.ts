import { describe, expect, it } from "vitest";

import type { Asset, Comment, Job } from "./types";
import {
  activityQueryParams,
  deriveActivityFeed,
  validateActivityArgs,
} from "./activity";
import { ASSETS, COMMENTS, JOBS, PROJECTS } from "./mock/data";

const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";

function asset(id: string, name: string, overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    project_id: filmId,
    type: "image",
    name,
    creator_id: "0b5c1e2a-0000-4000-8000-0000000000aa",
    storage: { key: `Output/${name}`, size_bytes: 1, content_type: "image/png" },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function job(id: string, status: Job["status"], overrides: Partial<Job> = {}): Job {
  return {
    id,
    project_id: filmId,
    operation_id: "dataset-prep",
    schema_version: "v1",
    status,
    attempt: 1,
    created_by: "0b5c1e2a-0000-4000-8000-0000000000aa",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function comment(id: string): Comment {
  return {
    id,
    project_id: filmId,
    author_id: "0b5c1e2a-0000-4000-8000-0000000000bb",
    body: "Looks good",
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("deriveActivityFeed", () => {
  it("derives a populated, newest-first feed with a total before limiting", () => {
    const feed = deriveActivityFeed(ASSETS, JOBS, COMMENTS);
    expect(feed.events?.length).toBeGreaterThan(0);
    expect(feed.total).toBeGreaterThanOrEqual(feed.events?.length ?? 0);
    const timestamps = (feed.events ?? []).map((event) => Date.parse(event.timestamp));
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  it("emits every event family with the authoritative id, actor and tone mapping", () => {
    const feed = deriveActivityFeed(
      [
        asset("a1", "frame.png", {
          provenance: { operation_id: "text-to-image" },
          metadata: {
            publish_receipt: {
              comment: "approved",
              publisher: "0b5c1e2a-0000-4000-8000-0000000000cc",
            },
          },
        }),
      ],
      [job("j1", "failed", { error: { code: "gpu", message: "out of memory" } })],
      [comment("c1")],
    );

    const byId = new Map((feed.events ?? []).map((event) => [event.id, event]));
    expect(byId.get("asset-a1")).toMatchObject({
      kind: "asset",
      label: "Created frame.png",
      detail: "text-to-image",
      tone: "info",
      actor_id: "0b5c1e2a-0000-4000-8000-0000000000aa",
    });
    expect(byId.get("publish-a1")).toMatchObject({
      kind: "publish",
      label: "Published frame.png",
      detail: "approved",
      tone: "success",
      actor_id: "0b5c1e2a-0000-4000-8000-0000000000cc",
    });
    expect(byId.get("job-j1")).toMatchObject({
      kind: "job",
      label: "dataset-prep · failed",
      detail: "out of memory",
      tone: "danger",
    });
    expect(byId.get("comment-c1")).toMatchObject({
      kind: "comment",
      label: "Commented on a project",
      detail: "Looks good",
      tone: "accent",
    });
  });

  it("falls back to asset type / attempt / default comment when details are absent", () => {
    const feed = deriveActivityFeed(
      [asset("a2", "plain.png", { metadata: { publish_receipt: {} } })],
      [job("j2", "queued")],
      [],
    );
    const byId = new Map((feed.events ?? []).map((event) => [event.id, event]));
    expect(byId.get("asset-a2")?.detail).toBe("image");
    expect(byId.get("publish-a2")?.detail).toBe("Publish receipt recorded");
    expect(byId.get("job-j2")?.detail).toBe("Attempt 1");
  });

  it("scopes to one project and yields an empty feed with total 0 for a quiet project", () => {
    const scoped = deriveActivityFeed(ASSETS, JOBS, COMMENTS, { projectId: filmId });
    expect((scoped.events ?? []).length).toBeGreaterThan(0);
    expect((scoped.events ?? []).every((event) => event.project_id === filmId)).toBe(true);

    const empty = deriveActivityFeed(ASSETS, JOBS, COMMENTS, { projectId: emptyId });
    expect(empty).toEqual({ events: [], total: 0 });
  });

  it("filters by kind and reports the total before the limit is applied", () => {
    const all = deriveActivityFeed(ASSETS, JOBS, COMMENTS, { limit: 200 });
    const publishes = deriveActivityFeed(ASSETS, JOBS, COMMENTS, { kind: "publish" });
    expect((publishes.events ?? []).length).toBeGreaterThan(0);
    expect((publishes.events ?? []).every((event) => event.kind === "publish")).toBe(true);
    expect(publishes.total).toBe(
      (all.events ?? []).filter((event) => event.kind === "publish").length,
    );

    const limited = deriveActivityFeed(ASSETS, JOBS, COMMENTS, { kind: "publish", limit: 2 });
    expect(limited.events).toHaveLength(2);
    expect(limited.total).toBe(publishes.total);
  });
});

describe("validateActivityArgs", () => {
  it("accepts valid and omitted filters", () => {
    expect(() => validateActivityArgs()).not.toThrow();
    expect(() =>
      validateActivityArgs({ projectId: filmId, kind: "job", limit: 200 }),
    ).not.toThrow();
  });

  it("mirrors the router's 422 validation for invalid filters", () => {
    expect(() => validateActivityArgs({ projectId: "not-a-uuid" })).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
    expect(() => validateActivityArgs({ kind: "bogus" as never })).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
    expect(() => validateActivityArgs({ limit: 0 })).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
    expect(() => validateActivityArgs({ limit: 201 })).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });
});

describe("activityQueryParams", () => {
  it("maps filters onto the live request query string", () => {
    expect(activityQueryParams()).toEqual({
      project_id: undefined,
      kind: undefined,
      limit: undefined,
    });
    expect(activityQueryParams({ projectId: filmId, kind: "asset", limit: 5 })).toEqual({
      project_id: filmId,
      kind: "asset",
      limit: 5,
    });
  });
});

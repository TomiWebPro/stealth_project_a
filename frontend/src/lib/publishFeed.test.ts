import { describe, expect, it } from "vitest";

import {
  derivePublishFeed,
  publishFeedQueryParams,
  UNKNOWN_PROJECT_NAME,
  validatePublishFeedArgs,
} from "./publishFeed";
import type { Asset, AssetStatus, Metadata, Project } from "./types";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const A1 = "0b5c1e2a-2000-4000-8000-000000000001";
const A2 = "0b5c1e2a-2000-4000-8000-000000000002";
const A3 = "0b5c1e2a-2000-4000-8000-000000000003";

const PROJECTS: readonly Project[] = [
  { id: P1, name: "Moonshot", org_id: "org", created_by: "user", created_at: NOW, updated_at: NOW },
  { id: P2, name: "Brand Film", org_id: "org", created_by: "user", created_at: NOW, updated_at: NOW },
];

function asset(
  id: string,
  projectId: string,
  receipt?: Metadata,
  status: AssetStatus = "ready",
): Asset {
  return {
    id,
    project_id: projectId,
    type: "image",
    name: `asset-${id}`,
    status,
    creator_id: "0b5c1e2a-0000-4000-8000-0000000000aa",
    version: 1,
    tags: [],
    storage: { key: `assets/${id}.png`, size_bytes: 1024, content_type: "image/png" },
    created_at: "2026-03-18T08:00:00.000Z",
    updated_at: "2026-03-18T08:00:00.000Z",
    ...(receipt !== undefined ? { metadata: { publish_receipt: receipt } } : {}),
  };
}

function receipt(version: number, sizeBytes: number, publishedAt: string): Metadata {
  return { version, size_bytes: sizeBytes, published_at: publishedAt };
}

const ASSETS = [
  asset(A1, P1, receipt(1, 100, "2026-03-18T08:00:00.000Z")),
  asset(A2, P2, receipt(2, 200, "2026-03-18T09:00:00.000Z")),
  asset(A3, P2, receipt(1, 300, "2026-03-18T07:00:00.000Z")),
];

describe("derivePublishFeed", () => {
  it("returns an empty feed when nothing is published", () => {
    expect(derivePublishFeed([], PROJECTS, NOW)).toEqual({
      items: [],
      total: 0,
      generated_at: NOW,
    });
  });

  it("orders newest-first with an asset-id tie-break and joins project names", () => {
    const feed = derivePublishFeed([...ASSETS].reverse(), PROJECTS, NOW);

    expect(feed.total).toBe(3);
    expect(feed.generated_at).toBe(NOW);
    expect((feed.items ?? []).map((item) => item.asset_id)).toEqual([A2, A1, A3]);
    expect((feed.items ?? [])[0]).toMatchObject({
      asset_id: A2,
      asset_name: `asset-${A2}`,
      project_id: P2,
      project_name: "Brand Film",
      version: 2,
      size_bytes: 200,
      published_at: "2026-03-18T09:00:00.000Z",
    });
    expect(derivePublishFeed(ASSETS, PROJECTS, NOW)).toEqual(feed);
  });

  it("breaks publish-time ties by descending asset id", () => {
    const tied = [
      asset(A1, P1, receipt(1, 100, "2026-03-18T08:00:00.000Z")),
      asset(A2, P1, receipt(1, 100, "2026-03-18T08:00:00.000Z")),
    ];
    expect(derivePublishFeed(tied, PROJECTS, NOW).items?.map((item) => item.asset_id)).toEqual([
      A2,
      A1,
    ]);
  });

  it("uses the stable fallback name for an asset whose project is missing", () => {
    const orphan = asset(A1, "00000000-0000-4000-8000-000000000000", receipt(1, 10, NOW));
    expect(derivePublishFeed([orphan], PROJECTS, NOW).items?.[0]?.project_name).toBe(
      UNKNOWN_PROJECT_NAME,
    );
  });

  it("excludes soft-deleted assets and malformed receipts", () => {
    const malformed = [
      asset(A1, P1, { version: true, size_bytes: 10, published_at: NOW }),
      asset(A1, P1, { version: 1, size_bytes: -1, published_at: NOW }),
      asset(A1, P1, { version: 1, size_bytes: 10, published_at: "not-a-date" }),
      asset(A1, P1, undefined),
    ];
    expect(derivePublishFeed([...ASSETS, ...malformed], PROJECTS, NOW).total).toBe(3);

    const deleted = ASSETS.map((candidate) =>
      candidate.project_id === P2 ? { ...candidate, status: "deleted" as const } : candidate,
    );
    const feed = derivePublishFeed(deleted, PROJECTS, NOW);
    expect(feed.total).toBe(1);
    expect((feed.items ?? []).map((item) => item.asset_id)).toEqual([A1]);
  });

  it("scopes to one project and counts the whole feed before the limit page", () => {
    const scoped = derivePublishFeed(ASSETS, PROJECTS, NOW, { projectId: P2 });
    expect(scoped.total).toBe(2);
    expect((scoped.items ?? []).map((item) => item.project_id)).toEqual([P2, P2]);

    const empty = derivePublishFeed(ASSETS, PROJECTS, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty).toEqual({ items: [], total: 0, generated_at: NOW });

    const paged = derivePublishFeed(ASSETS, PROJECTS, NOW, { limit: 2 });
    expect(paged.total).toBe(3);
    expect((paged.items ?? []).map((item) => item.asset_id)).toEqual([A2, A1]);
  });
});

describe("publish feed query helpers", () => {
  it("mirrors router validation for a malformed project id or limit", () => {
    expect(() => validatePublishFeedArgs()).not.toThrow();
    expect(() => validatePublishFeedArgs({ projectId: P1, limit: 10 })).not.toThrow();
    for (const bad of [{ projectId: "not-a-uuid" }, { limit: 0 }, { limit: 201 }, { limit: 1.5 }]) {
      try {
        validatePublishFeedArgs(bad);
        throw new Error("expected validation to fail");
      } catch (cause) {
        expect(cause).toMatchObject({ status: 422, code: "validation_error" });
      }
    }
  });

  it("maps the scope and page onto the live query string", () => {
    expect(publishFeedQueryParams()).toEqual({ project_id: undefined, limit: undefined });
    expect(publishFeedQueryParams({ projectId: P1, limit: 5 })).toEqual({
      project_id: P1,
      limit: 5,
    });
  });
});

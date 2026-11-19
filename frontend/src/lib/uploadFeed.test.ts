import { describe, expect, it } from "vitest";

import {
  deriveUploadFeed,
  UNKNOWN_UPLOAD_PROJECT_NAME,
  uploadFeedQueryParams,
  validateUploadFeedArgs,
} from "./uploadFeed";
import type { UploadFeedRecord } from "./uploadFeed";
import type { Project, UploadStatus } from "./types";

const NOW = "2026-03-18T10:30:00.000Z";
const EXPIRES = "2026-03-20T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const U1 = "0b5c1e2a-3000-4000-8000-000000000001";
const U2 = "0b5c1e2a-3000-4000-8000-000000000002";
const U3 = "0b5c1e2a-3000-4000-8000-000000000003";

const PROJECTS: readonly Project[] = [
  { id: P1, name: "Moonshot", org_id: "org", created_by: "user", created_at: NOW, updated_at: NOW },
  { id: P2, name: "Brand Film", org_id: "org", created_by: "user", created_at: NOW, updated_at: NOW },
];

function ticket(
  id: string,
  projectId: string,
  status: UploadStatus,
  bytes: number,
  createdAt: string,
  filename = `shot_${id.slice(-4)}.png`,
): UploadFeedRecord {
  return {
    upload_id: id,
    project_id: projectId,
    status,
    size_bytes: bytes,
    declared_size: bytes,
    filename,
    content_type: "image/png",
    created_at: createdAt,
    expires_at: EXPIRES,
  };
}

const TICKETS = [
  ticket(U1, P1, "complete", 100, "2026-03-18T08:00:00.000Z"),
  ticket(U2, P2, "pending", 200, "2026-03-18T09:00:00.000Z"),
  ticket(U3, P2, "complete", 300, "2026-03-18T07:00:00.000Z"),
];

describe("deriveUploadFeed", () => {
  it("returns an empty feed when there are no tickets", () => {
    expect(deriveUploadFeed([], PROJECTS, NOW)).toEqual({
      items: [],
      total: 0,
      generated_at: NOW,
    });
  });

  it("orders newest-first with an upload-id tie-break and joins project names", () => {
    const feed = deriveUploadFeed([...TICKETS].reverse(), PROJECTS, NOW);

    expect(feed.total).toBe(3);
    expect(feed.generated_at).toBe(NOW);
    expect((feed.items ?? []).map((item) => item.upload_id)).toEqual([U2, U1, U3]);
    expect((feed.items ?? [])[0]).toMatchObject({
      upload_id: U2,
      project_id: P2,
      project_name: "Brand Film",
      status: "pending",
      declared_size: 200,
      size_bytes: 200,
      content_type: "image/png",
      created_at: "2026-03-18T09:00:00.000Z",
      expires_at: EXPIRES,
    });
    expect(deriveUploadFeed(TICKETS, PROJECTS, NOW)).toEqual(feed);
  });

  it("breaks creation-time ties by descending upload id", () => {
    const tied = [
      ticket(U1, P1, "complete", 100, "2026-03-18T08:00:00.000Z"),
      ticket(U2, P1, "complete", 100, "2026-03-18T08:00:00.000Z"),
    ];
    expect(deriveUploadFeed(tied, PROJECTS, NOW).items?.map((item) => item.upload_id)).toEqual([
      U2,
      U1,
    ]);
  });

  it("uses the stable fallback name for a ticket whose project is missing", () => {
    const orphan = ticket(U1, "00000000-0000-4000-8000-000000000000", "complete", 10, NOW);
    expect(deriveUploadFeed([orphan], PROJECTS, NOW).items?.[0]?.project_name).toBe(
      UNKNOWN_UPLOAD_PROJECT_NAME,
    );
  });

  it("scopes to one project and counts the whole feed before the limit page", () => {
    const scoped = deriveUploadFeed(TICKETS, PROJECTS, NOW, { projectId: P2 });
    expect(scoped.total).toBe(2);
    expect((scoped.items ?? []).map((item) => item.project_id)).toEqual([P2, P2]);

    const empty = deriveUploadFeed(TICKETS, PROJECTS, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty).toEqual({ items: [], total: 0, generated_at: NOW });

    const paged = deriveUploadFeed(TICKETS, PROJECTS, NOW, { limit: 2 });
    expect(paged.total).toBe(3);
    expect((paged.items ?? []).map((item) => item.upload_id)).toEqual([U2, U1]);
  });
});

describe("upload feed query helpers", () => {
  it("mirrors router validation for a malformed project id or limit", () => {
    expect(() => validateUploadFeedArgs()).not.toThrow();
    expect(() => validateUploadFeedArgs({ projectId: P1, limit: 10 })).not.toThrow();
    for (const bad of [{ projectId: "not-a-uuid" }, { limit: 0 }, { limit: 201 }, { limit: 1.5 }]) {
      try {
        validateUploadFeedArgs(bad);
        throw new Error("expected validation to fail");
      } catch (cause) {
        expect(cause).toMatchObject({ status: 422, code: "validation_error" });
      }
    }
  });

  it("maps the scope and page onto the live query string", () => {
    expect(uploadFeedQueryParams()).toEqual({ project_id: undefined, limit: undefined });
    expect(uploadFeedQueryParams({ projectId: P1, limit: 5 })).toEqual({
      project_id: P1,
      limit: 5,
    });
  });
});

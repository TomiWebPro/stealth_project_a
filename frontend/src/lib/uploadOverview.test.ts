import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import type { UploadFeedRecord } from "./uploadFeed";
import type { Project } from "./types";
import {
  UNKNOWN_UPLOAD_OVERVIEW_PROJECT_NAME,
  deriveUploadOverview,
  validateUploadOverviewArgs,
} from "./uploadOverview";

const UPLOAD_ID = "0b5c1e2a-7000-4000-8000-000000000001";
const OTHER_UPLOAD_ID = "0b5c1e2a-7000-4000-8000-000000000003";
const PROJECT_ID = "0b5c1e2a-1000-4000-8000-000000000001";
const NOW = "2026-03-18T10:30:00.000Z";

function project(id: string, name: string): Project {
  return {
    id,
    org_id: "0b5c1e2a-0000-4000-8000-00000000000a",
    name,
    created_by: "0b5c1e2a-0000-4000-8000-0000000000aa",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function ticket(overrides: Partial<UploadFeedRecord> = {}): UploadFeedRecord {
  return {
    upload_id: UPLOAD_ID,
    project_id: PROJECT_ID,
    status: "complete",
    size_bytes: 1_200_000,
    declared_size: 1_200_000,
    filename: "concept_sheet.png",
    content_type: "image/png",
    created_at: "2026-03-17T10:30:00.000Z",
    expires_at: "2026-03-19T10:30:00.000Z",
    ...overrides,
  };
}

describe("deriveUploadOverview", () => {
  it("derives identity, joined project and whole-project counts for a completed ticket", () => {
    const overview = deriveUploadOverview(
      UPLOAD_ID,
      [
        ticket(),
        ticket({
          upload_id: OTHER_UPLOAD_ID,
          status: "pending",
          size_bytes: 500_000,
          declared_size: 1_000_000,
        }),
      ],
      [project(PROJECT_ID, "Moonshot")],
      NOW,
    );

    expect(overview).toEqual({
      upload_id: UPLOAD_ID,
      project_id: PROJECT_ID,
      project_name: "Moonshot",
      filename: "concept_sheet.png",
      content_type: "image/png",
      status: "complete",
      declared_size: 1_200_000,
      size_bytes: 1_200_000,
      bytes_remaining: 0,
      progress: 1,
      expired: false,
      created_at: "2026-03-17T10:30:00.000Z",
      expires_at: "2026-03-19T10:30:00.000Z",
      counts: {
        project_tickets: 2,
        project_completed: 1,
        project_bytes_uploaded: 1_200_000,
      },
      generated_at: NOW,
    });
  });

  it("derives partial byte progress and remaining bytes for a pending ticket", () => {
    const overview = deriveUploadOverview(
      UPLOAD_ID,
      [
        ticket({ status: "pending", size_bytes: 250, declared_size: 1_000 }),
        ticket({ upload_id: OTHER_UPLOAD_ID, status: "complete", size_bytes: 700, declared_size: 700 }),
      ],
      [project(PROJECT_ID, "Moonshot")],
      NOW,
    );

    expect(overview.status).toBe("pending");
    expect(overview.bytes_remaining).toBe(750);
    expect(overview.progress).toBe(0.25);
    expect(overview.counts).toEqual({
      project_tickets: 2,
      project_completed: 1,
      project_bytes_uploaded: 700,
    });
  });

  it("flags an expired ticket and clamps progress for a zero declared size", () => {
    const overview = deriveUploadOverview(
      UPLOAD_ID,
      [ticket({ declared_size: 0, size_bytes: 0, expires_at: "2026-03-17T10:30:00.000Z" })],
      [],
      NOW,
    );

    expect(overview.expired).toBe(true);
    expect(overview.progress).toBe(0);
    expect(overview.bytes_remaining).toBe(0);
    expect(overview.project_name).toBe(UNKNOWN_UPLOAD_OVERVIEW_PROJECT_NAME);
  });

  it("throws a normalized 404 for an unknown upload", () => {
    expect(() => deriveUploadOverview("missing", [ticket()], [], NOW)).toThrow(
      expect.objectContaining({ name: "ApiError", status: 404, code: "upload_not_found" }),
    );
    expect(() => deriveUploadOverview("missing", [ticket()], [], NOW)).toThrow(ApiError);
  });
});

describe("validateUploadOverviewArgs", () => {
  it("rejects a malformed upload id with the shared 422 envelope", () => {
    expect(() => validateUploadOverviewArgs("not-a-uuid")).toThrow(
      expect.objectContaining({
        name: "ApiError",
        status: 422,
        code: "validation_error",
      }),
    );
  });

  it("accepts a well-formed id", () => {
    expect(() => validateUploadOverviewArgs(UPLOAD_ID)).not.toThrow();
  });
});

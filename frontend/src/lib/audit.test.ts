import { describe, expect, it } from "vitest";

import type { Asset, AuditEvent, Job } from "./types";
import {
  buildAuditTrail,
  deriveAuditEvents,
  filterAuditEvents,
  filterAuditTrail,
} from "./audit";

const PROJECT = "0b5c1e2a-1000-4000-8000-000000000001";

function asset(id: string, overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    project_id: PROJECT,
    type: "image",
    name: `Asset ${id}`,
    creator_id: "creator",
    storage: { key: `Output/${id}`, size_bytes: 1, content_type: "image/png" },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function job(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    project_id: PROJECT,
    operation_id: "dataset-prep",
    schema_version: "v1",
    status: "running",
    attempt: 1,
    created_by: "creator",
    created_at: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("audit derivation helpers", () => {
  it("derives asset, publish and job events with backend-mirroring labels and tones", () => {
    const events = deriveAuditEvents(
      [
        asset("a1", {
          provenance: { operation_id: "text-to-image" },
          metadata: { publish_receipt: { comment: "Approved" } },
        }),
      ],
      [job("j1", { status: "failed", error: { code: "boom", message: "GPU offline" } })],
    );

    expect(events).toEqual([
      {
        id: "asset-a1",
        kind: "asset",
        label: "Created Asset a1",
        detail: "text-to-image",
        timestamp: "2026-01-01T00:00:00.000Z",
        tone: "info",
      },
      {
        id: "publish-a1",
        kind: "publish",
        label: "Published Asset a1",
        detail: "Approved",
        timestamp: "2026-01-01T00:00:00.000Z",
        tone: "success",
      },
      {
        id: "job-j1",
        kind: "job",
        label: "dataset-prep · failed",
        detail: "GPU offline",
        timestamp: "2026-01-02T00:00:00.000Z",
        tone: "danger",
      },
    ]);
  });

  it("falls back to a generic publish detail when no comment is recorded", () => {
    const events = deriveAuditEvents([asset("a1", { metadata: { publish_receipt: {} } })], []);
    expect(events.find((event) => event.kind === "publish")?.detail).toBe(
      "Publish receipt recorded",
    );
  });

  it("orders newest first with an id tiebreak and caps with limit", () => {
    const events: AuditEvent[] = [
      { id: "a", kind: "asset", label: "A", detail: "", timestamp: "2026-01-01T00:00:00Z", tone: "info" },
      { id: "b", kind: "job", label: "B", detail: "", timestamp: "2026-01-02T00:00:00Z", tone: "info" },
      { id: "c", kind: "publish", label: "C", detail: "", timestamp: "2026-01-02T00:00:00Z", tone: "info" },
    ];
    expect(filterAuditEvents(events).map((event) => event.id)).toEqual(["c", "b", "a"]);
    expect(filterAuditEvents(events, { limit: 2 }).map((event) => event.id)).toEqual(["c", "b"]);
  });

  it("applies inclusive kind and time bounds", () => {
    const events: AuditEvent[] = [
      { id: "a", kind: "asset", label: "A", detail: "", timestamp: "2026-01-01T00:00:00Z", tone: "info" },
      { id: "b", kind: "job", label: "B", detail: "", timestamp: "2026-01-02T00:00:00Z", tone: "info" },
      { id: "c", kind: "job", label: "C", detail: "", timestamp: "2026-01-03T00:00:00Z", tone: "info" },
    ];
    expect(
      filterAuditEvents(events, {
        kind: "job",
        since: "2026-01-02T00:00:00Z",
        until: "2026-01-02T00:00:00Z",
      }).map((event) => event.id),
    ).toEqual(["b"]);
  });

  it("builds a project-scoped trail and re-filters existing trails without mutating them", () => {
    const trail = buildAuditTrail(
      PROJECT,
      [asset("a1"), asset("other", { project_id: "elsewhere" })],
      [job("j1")],
    );
    expect(trail.project_id).toBe(PROJECT);
    expect(trail.events?.map((event) => event.id)).toEqual(["job-j1", "asset-a1"]);

    const filtered = filterAuditTrail(trail, { kind: "asset" });
    expect(filtered?.events?.map((event) => event.id)).toEqual(["asset-a1"]);
    expect(trail.events).toHaveLength(2);
    expect(filterAuditTrail(undefined)).toBeUndefined();
  });
});

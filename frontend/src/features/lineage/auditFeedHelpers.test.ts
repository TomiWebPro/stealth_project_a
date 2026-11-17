import { describe, expect, it } from "vitest";
import type { AuditEvent, AuditTrail } from "../../lib/types";
import { AUDIT_KIND_FILTERS, auditFeedItems, auditFeedSummary } from "./auditFeedHelpers";

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "job-1",
    kind: "job",
    label: "lora-train · succeeded",
    detail: "Attempt 1",
    timestamp: "2026-01-02T00:00:00Z",
    tone: "success",
    ...overrides,
  };
}

function trail(events: readonly AuditEvent[]): AuditTrail {
  return { project_id: "p1", events: [...events] };
}

describe("audit feed helpers (C20b)", () => {
  it("treats a missing or empty trail as no rows", () => {
    expect(auditFeedItems(undefined)).toEqual([]);
    expect(auditFeedItems(trail([]))).toEqual([]);
    expect(auditFeedItems({ project_id: "p1" })).toEqual([]);
  });

  it("maps canonical events to render-ready rows without reordering them", () => {
    const items = auditFeedItems(
      trail([
        event(),
        event({
          id: "publish-1",
          kind: "publish",
          label: "Published Hero",
          detail: "approved",
          timestamp: "2026-01-03T00:00:00Z",
          tone: "info",
        }),
      ]),
    );
    expect(items.map((item) => item.id)).toEqual(["job-1", "publish-1"]);
    expect(items.map((item) => item.tone)).toEqual(["success", "info"]);
    expect(items[0]).toMatchObject({
      kind: "job",
      label: "lora-train · succeeded",
      detail: "Attempt 1",
      timestamp: "2026-01-02T00:00:00Z",
    });
    for (const item of items) expect(item.relativeTime.length).toBeGreaterThan(0);
  });

  it("falls back to a neutral tone for an unrecognized canonical tone", () => {
    const [item] = auditFeedItems(trail([event({ tone: "mystery" as AuditEvent["tone"] })]));
    expect(item?.tone).toBe("neutral");
  });

  it("summarizes empty, single and multiple events", () => {
    expect(auditFeedSummary([])).toBe("No audit events");
    expect(auditFeedSummary(auditFeedItems(trail([event()])))).toContain("1 event · latest: lora-train");
    expect(
      auditFeedSummary(auditFeedItems(trail([event(), event({ id: "job-2" })]))),
    ).toContain("2 events");
  });

  it("exposes an all-filter plus one chip per audit kind", () => {
    expect(AUDIT_KIND_FILTERS.map((filter) => filter.value)).toEqual([
      "all",
      "asset",
      "publish",
      "job",
    ]);
  });
});

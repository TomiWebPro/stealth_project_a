import { describe, expect, it } from "vitest";
import type { ActivityEvent, ActivityFeed } from "../../lib/types";
import {
  ACTIVITY_KIND_FILTERS,
  activityEmptyDescription,
  activityFeedItems,
  activityFeedSummary,
  buildActivityOptions,
} from "./activityHelpers";

const NOW = Date.parse("2026-11-19T12:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

function event(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: "job-1",
    kind: "job",
    project_id: "p1",
    actor_id: "u1",
    label: "lora-train · running",
    detail: "Attempt 1",
    timestamp: ago(5),
    tone: "info",
    ...overrides,
  };
}

function feed(events: readonly ActivityEvent[], total = events.length): ActivityFeed {
  return { events: [...events], total };
}

describe("activity feed display helpers (C35)", () => {
  it("treats a missing or empty feed as no rows", () => {
    expect(activityFeedItems(undefined, NOW)).toEqual([]);
    expect(activityFeedItems(feed([]), NOW)).toEqual([]);
    expect(activityFeedItems({ total: 3 }, NOW)).toEqual([]);
  });

  it("maps canonical events to render-ready rows without reordering them", () => {
    const items = activityFeedItems(
      feed([
        event(),
        event({
          id: "publish-1",
          kind: "publish",
          label: "Published Hero",
          detail: "approved",
          timestamp: ago(2),
          tone: "success",
        }),
      ]),
      NOW,
    );
    expect(items.map((item) => item.id)).toEqual(["job-1", "publish-1"]);
    expect(items.map((item) => item.tone)).toEqual(["info", "success"]);
    expect(items.map((item) => item.kindLabel)).toEqual(["Job", "Publish"]);
    expect(items[0]).toMatchObject({
      kind: "job",
      projectId: "p1",
      label: "lora-train · running",
      detail: "Attempt 1",
      relativeTime: "5 minutes ago",
    });
  });

  it("falls back to a neutral tone and generic label for unrecognized values", () => {
    const [item] = activityFeedItems(
      feed([
        event({ tone: "mystery" as ActivityEvent["tone"], kind: "mystery" as ActivityEvent["kind"] }),
      ]),
      NOW,
    );
    expect(item?.tone).toBe("neutral");
    expect(item?.kindLabel).toBe("Event");
  });

  it("summarizes empty, single and multiple events and honours the untruncated total", () => {
    expect(activityFeedSummary([])).toBe("No workspace activity");
    expect(activityFeedSummary(activityFeedItems(feed([event()]), NOW))).toContain(
      "1 event · latest: lora-train",
    );
    expect(activityFeedSummary(activityFeedItems(feed([event(), event({ id: "job-2" })]), NOW))).toContain(
      "2 events",
    );
    expect(
      activityFeedSummary(activityFeedItems(feed([event()], 17), NOW), 17),
    ).toContain("17 events");
  });

  it("exposes an all-filter plus one chip per activity kind", () => {
    expect(ACTIVITY_KIND_FILTERS.map((filter) => filter.value)).toEqual([
      "all",
      "asset",
      "publish",
      "job",
      "comment",
    ]);
  });

  it("builds hook options from the active filter chips", () => {
    expect(buildActivityOptions("all")).toBeUndefined();
    expect(buildActivityOptions("all", undefined)).toBeUndefined();
    expect(buildActivityOptions("job")).toEqual({ kind: "job" });
    expect(buildActivityOptions("job", 25)).toEqual({ kind: "job", limit: 25 });
    expect(buildActivityOptions("all", 10)).toEqual({ limit: 10 });
  });

  it("derives filter-aware empty-state copy", () => {
    expect(activityEmptyDescription("all")).toContain("Assets, publishes, jobs and comments");
    expect(activityEmptyDescription("comment")).toContain("No comment events");
  });
});

import { describe, expect, it } from "vitest";
import type { JobQueueView } from "../../lib/types";
import {
  hasJobQueueData,
  jobQueueCards,
  jobQueueGeneratedAtLabel,
  jobQueuePageLabel,
  jobQueueRow,
  jobQueueRows,
  queueOperationLabel,
  queuePageSize,
  queuePositionLabel,
  queueProjectLabel,
  queueRelativeLabel,
  queueSharePercent,
  queueStatusLabel,
  queueStatusTone,
} from "./jobQueueHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const populated: JobQueueView = {
  total: 5,
  waiting: 3,
  running: 2,
  entries: [
    {
      position: 1,
      job_id: "11111111-aaaa",
      operation_id: "dataset-prep",
      status: "running",
      project_id: "proj-aaaa-1111",
      created_at: "2026-01-01T00:50:00Z",
    },
    {
      position: 2,
      job_id: "22222222-bbbb",
      operation_id: "lora-train",
      status: "queued",
      project_id: "proj-bbbb-2222",
      created_at: "2026-01-01T00:55:00Z",
    },
  ],
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: JobQueueView = {
  total: 0,
  waiting: 0,
  running: 0,
  entries: [],
  generated_at: "2026-01-01T00:00:00Z",
};

describe("job queue formatters", () => {
  it("maps canonical status labels and badge tones", () => {
    expect(queueStatusLabel("queued")).toBe("Queued");
    expect(queueStatusLabel("running")).toBe("Running");
    expect(queueStatusTone("running")).toBe("info");
    expect(queueStatusTone("queued")).toBe("neutral");
  });

  it("prettifies operation ids and position labels", () => {
    expect(queueOperationLabel("dataset-prep")).toBe("Dataset Prep");
    expect(queueOperationLabel("image_to_video")).toBe("Image To Video");
    expect(queueOperationLabel("")).toBe("Unknown operation");
    expect(queuePositionLabel(1)).toBe("#1");
    expect(queuePositionLabel(0)).toBe("—");
  });

  it("formats relative labels safely for missing and invalid values", () => {
    expect(queueRelativeLabel(null)).toBe("");
    expect(queueRelativeLabel(undefined)).toBe("");
    expect(queueRelativeLabel("2026-01-01T00:30:00Z", NOW)).toBe("30 minutes ago");
    expect(queueRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
    expect(jobQueueGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(jobQueueGeneratedAtLabel(undefined, NOW)).toBe("");
  });

  it("computes waiting/running shares against the whole queue", () => {
    expect(queueSharePercent(populated, "waiting")).toBe(60);
    expect(queueSharePercent(populated, "running")).toBe(40);
    expect(queueSharePercent(empty)).toBe(0);
    expect(queueSharePercent(undefined)).toBe(0);
  });

  it("derives zero-filled cards for an unsettled or empty snapshot", () => {
    const cards = jobQueueCards(undefined, NOW);
    expect(cards.map((card) => card.key)).toEqual(["active", "waiting", "running", "generated"]);
    expect(cards.every((card) => card.value === "—" || card.value === "0")).toBe(true);
    expect(cards[1]?.hint).toBe("0% of queue");

    const emptyCards = jobQueueCards(empty, NOW);
    expect(emptyCards[0]?.value).toBe("0");
    expect(emptyCards[3]?.value).toBe("1 hour ago");
  });

  it("derives populated cards from the whole-queue counters", () => {
    const cards = jobQueueCards(populated, NOW);
    expect(cards[0]).toEqual({
      key: "active",
      label: "Active jobs",
      value: "5",
      hint: "Waiting + running",
    });
    expect(cards[1]?.value).toBe("3");
    expect(cards[1]?.hint).toBe("60% of queue");
    expect(cards[2]?.value).toBe("2");
    expect(cards[2]?.hint).toBe("40% of queue");
  });
});

describe("job queue rows", () => {
  it("resolves friendly project names with a short-id fallback", () => {
    expect(queueProjectLabel("proj-aaaa-1111", { "proj-aaaa-1111": "Demo Film" })).toBe("Demo Film");
    expect(queueProjectLabel("proj-aaaa-1111")).toBe("proj-aaa…");
    expect(queueProjectLabel("short")).toBe("short");
    expect(queueProjectLabel("")).toBe("—");
  });

  it("derives one render-ready row from an entry", () => {
    const row = jobQueueRow(populated.entries![0]!, { "proj-aaaa-1111": "Demo Film" }, NOW);
    expect(row).toEqual({
      position: 1,
      positionLabel: "#1",
      jobId: "11111111-aaaa",
      jobLabel: "11111111…",
      operationLabel: "Dataset Prep",
      status: "running",
      statusLabel: "Running",
      statusTone: "info",
      projectId: "proj-aaaa-1111",
      projectLabel: "Demo Film",
      queuedAtLabel: "10 minutes ago",
      isRunning: true,
    });
  });

  it("preserves authoritative FIFO order and skips malformed entries", () => {
    const rows = jobQueueRows(populated, undefined, NOW);
    expect(rows.map((row) => row.position)).toEqual([1, 2]);
    expect(rows.map((row) => row.operationLabel)).toEqual(["Dataset Prep", "Lora Train"]);
    expect(rows[1]?.isRunning).toBe(false);
    expect(rows[1]?.queuedAtLabel).toBe("5 minutes ago");

    const malformed = {
      ...populated,
      entries: [null, { position: 3 }, populated.entries![0]!],
    } as unknown as JobQueueView;
    expect(jobQueueRows(malformed, undefined, NOW)).toHaveLength(1);
    expect(jobQueueRows(empty)).toEqual([]);
    expect(jobQueueRows(undefined)).toEqual([]);
  });

  it("detects data and describes the bounded page", () => {
    expect(hasJobQueueData(populated)).toBe(true);
    expect(hasJobQueueData(empty)).toBe(false);
    expect(hasJobQueueData(undefined)).toBe(false);
    expect(jobQueuePageLabel(populated)).toBe("Showing 2 of 5 active jobs");
    expect(jobQueuePageLabel(populated, 1)).toBe("Showing 1 of 5 active jobs");
    expect(jobQueuePageLabel({ ...empty, total: 1 })).toBe("Showing 0 of 1 active job");
    expect(jobQueuePageLabel(undefined)).toBe("Showing 0 of 0 active jobs");
  });

  it("clamps a requested page size to the router bounds", () => {
    expect(queuePageSize(10)).toBe(10);
    expect(queuePageSize(0)).toBe(1);
    expect(queuePageSize(999)).toBe(200);
    expect(queuePageSize(2.8)).toBe(2);
    expect(queuePageSize(Number.NaN)).toBe(25);
  });
});

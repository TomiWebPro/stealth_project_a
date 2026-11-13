import { describe, expect, it } from "vitest";

import { fetchHomeSummary, fetchProjects, fetchRecentAssets } from "./mockApi";

describe("mock API home summary", () => {
  it("includes only active (non-archived) projects", async () => {
    const summary = await fetchHomeSummary();

    expect(summary.projects.length).toBeGreaterThan(0);
    // "Archive 2025" is the only archived seed project.
    expect(summary.projects.some((project) => project.name.startsWith("Archive"))).toBe(false);
  });

  it("counts assets per project", async () => {
    const summary = await fetchHomeSummary();

    for (const project of summary.projects) {
      expect(project.assetCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns most recent assets first, capped at six", async () => {
    const summary = await fetchHomeSummary();
    const createdTimes = summary.recentAssets.map((asset) => Date.parse(asset.created_at));

    expect(summary.recentAssets.length).toBeLessThanOrEqual(6);
    const sortedDesc = [...createdTimes].sort((a, b) => b - a);
    expect(createdTimes).toEqual(sortedDesc);
  });

  it("surfaces only queued or running jobs as active", async () => {
    const summary = await fetchHomeSummary();

    expect(summary.activeJobs.length).toBeGreaterThan(0);
    expect(
      summary.activeJobs.every((job) => job.status === "queued" || job.status === "running"),
    ).toBe(true);
  });

  it("flattens provider capabilities into operation ids", async () => {
    const summary = await fetchHomeSummary();

    expect(summary.providers.length).toBeGreaterThan(0);
    for (const provider of summary.providers) {
      expect(Array.isArray(provider.operations)).toBe(true);
    }
  });
});

describe("mock API list helpers", () => {
  it("lists all projects including archived ones", async () => {
    const projects = await fetchProjects();
    expect(projects.some((project) => project.archived)).toBe(true);
  });

  it("respects the recent-assets limit", async () => {
    const assets = await fetchRecentAssets(2);
    expect(assets.length).toBeLessThanOrEqual(2);
  });
});

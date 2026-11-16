import { describe, expect, it } from "vitest";

import {
  fetchAsset,
  fetchAssets,
  fetchAssetsByProject,
  fetchHomeSummary,
  fetchJob,
  fetchJobs,
  fetchJobsByProject,
  fetchProject,
  fetchProjectDetail,
  fetchProjects,
  fetchProvider,
  fetchProviders,
  fetchRecentAssets,
} from "./mockApi";

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

  it("fetches a single project by id", async () => {
    const projects = await fetchProjects();
    const target = projects[0];
    expect(target).toBeDefined();
    if (!target) return;
    await expect(fetchProject(target.id)).resolves.toMatchObject({ id: target.id });
    await expect(fetchProject("00000000-0000-4000-8000-000000000000")).resolves.toBeUndefined();
  });

  it("respects the recent-assets limit", async () => {
    const assets = await fetchRecentAssets(2);
    expect(assets.length).toBeLessThanOrEqual(2);
  });

  it("lists only the requested project's assets", async () => {
    const projects = await fetchProjects();
    const target = projects.find((project) => !project.archived);
    expect(target).toBeDefined();
    if (!target) return;
    const assets = await fetchAssetsByProject(target.id);
    expect(assets.every((asset) => asset.project_id === target.id)).toBe(true);
  });

  it("drills an empty project with zero assets and zero jobs", async () => {
    const projects = await fetchProjects();
    const empty = projects.find((project) => project.name.startsWith("Blank Slate"));
    expect(empty).toBeDefined();
    if (!empty) return;
    expect(empty.archived).toBe(false);
    await expect(fetchAssetsByProject(empty.id)).resolves.toEqual([]);
    await expect(fetchJobs(empty.id)).resolves.toEqual([]);
    await expect(fetchJobs(empty.id, "failed")).resolves.toEqual([]);
    const detail = await fetchProjectDetail(empty.id);
    expect(detail?.assets).toEqual([]);
    expect(detail?.jobs).toEqual([]);
  });

  it("covers archived-only filter state with archived projects present", async () => {
    const projects = await fetchProjects();
    const archived = projects.filter((project) => project.archived);
    expect(archived.length).toBeGreaterThan(0);
    expect(archived.every((project) => project.name.startsWith("Archive"))).toBe(true);
  });

  it("lists jobs with full lifecycle coverage", async () => {
    const jobs = await fetchJobs();
    const statuses = new Set(jobs.map((job) => job.status));
    for (const status of ["queued", "running", "succeeded", "failed", "canceled"] as const) {
      expect(statuses.has(status)).toBe(true);
    }
    const failed = jobs.find((job) => job.status === "failed");
    expect(failed?.error?.retryable).toBe(true);
  });

  it("filters jobs by status", async () => {
    const failed = await fetchJobs(undefined, "failed");
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every((job) => job.status === "failed")).toBe(true);
    const projects = await fetchProjects();
    const film = projects.find((project) => project.name.startsWith("Moonshot"));
    expect(film).toBeDefined();
    if (!film) return;
    const filmFailed = await fetchJobs(film.id, "failed");
    expect(filmFailed.every((job) => job.project_id === film.id && job.status === "failed")).toBe(true);
  });

  it("scopes jobs by project", async () => {
    const projects = await fetchProjects();
    const target = projects.find((project) => !project.archived);
    expect(target).toBeDefined();
    if (!target) return;
    const jobs = await fetchJobs(target.id);
    expect(jobs.every((job) => job.project_id === target.id)).toBe(true);
    const byProject = await fetchJobsByProject(target.id);
    expect(byProject).toEqual(jobs);
  });

  it("surfaces failed retryable jobs through detail and by-id queries", async () => {
    const projects = await fetchProjects();
    const film = projects.find((project) => project.name.startsWith("Moonshot"));
    expect(film).toBeDefined();
    if (!film) return;
    const detail = await fetchProjectDetail(film.id);
    const failed = detail?.jobs.find((job) => job.status === "failed");
    expect(failed?.error?.retryable).toBe(true);
    expect(failed?.error?.code).toBe("TRAIN_OOM");
    expect(failed).toBeDefined();
    if (!failed) return;
    await expect(fetchJob(failed.id)).resolves.toMatchObject({
      id: failed.id,
      status: "failed",
      error: { code: "TRAIN_OOM", retryable: true },
    });
    await expect(fetchJob("00000000-0000-4000-8000-000000000000")).resolves.toBeUndefined();
  });

  it("returns project detail with matching assets and jobs", async () => {
    const projects = await fetchProjects();
    const target = projects.find((project) => !project.archived);
    expect(target).toBeDefined();
    if (!target) return;
    const detail = await fetchProjectDetail(target.id);
    expect(detail?.project.id).toBe(target.id);
    expect(detail?.assets.every((asset) => asset.project_id === target.id)).toBe(true);
    expect(detail?.jobs.every((job) => job.project_id === target.id)).toBe(true);
  });

  it("returns undefined detail for unknown projects", async () => {
    await expect(fetchProjectDetail("00000000-0000-4000-8000-000000000000")).resolves.toBeUndefined();
  });

  it("covers the LoRA consistency chain on the film project", async () => {
    const projects = await fetchProjects();
    const film = projects.find((project) => project.name.startsWith("Moonshot"));
    expect(film).toBeDefined();
    if (!film) return;
    const assets = await fetchAssetsByProject(film.id);
    const types = new Set(assets.map((asset) => asset.type));
    for (const type of ["image", "dataset", "lora", "video", "splat", "scene", "resource"] as const) {
      expect(types.has(type)).toBe(true);
    }
    const loraIds = assets.filter((asset) => asset.type === "lora").map((asset) => asset.id);
    expect(loraIds).toHaveLength(3);

    const firstFrames = assets.filter((asset) =>
      (asset.tags ?? []).includes("first-frame"),
    );
    const lastFrames = assets.filter((asset) =>
      (asset.tags ?? []).includes("last-frame"),
    );
    expect(firstFrames.length).toBeGreaterThan(0);
    expect(lastFrames.length).toBeGreaterThan(0);

    const shots = ["s01_c01", "s01_c02", "s02_c01", "s02_c02"] as const;
    for (const shot of shots) {
      const video = assets.find(
        (asset) => asset.type === "video" && asset.metadata?.["shot"] === shot,
      );
      expect(video).toBeDefined();
      expect(String(video?.storage.key)).toContain("/Publish/");
      const receipt = video?.metadata?.["publish_receipt"];
      expect(typeof receipt).toBe("object");
      for (const loraId of loraIds) {
        expect(video?.parent_asset_ids).toContain(loraId);
      }
    }

    const flf2v = assets.find(
      (asset) => asset.type === "video" && asset.provenance?.operation_id === "flf2v",
    );
    expect(flf2v).toBeDefined();
    const flf2vLast = lastFrames.find((asset) =>
      (flf2v?.parent_asset_ids ?? []).includes(asset.id),
    );
    expect(flf2vLast).toBeDefined();

    const sequences = new Set(
      assets
        .filter((asset) => typeof asset.metadata?.["sequence"] === "string")
        .map((asset) => asset.metadata?.["sequence"]),
    );
    expect(sequences.has("s01")).toBe(true);
    expect(sequences.has("s02")).toBe(true);

    const published = assets.filter((asset) =>
      String(asset.storage.key).includes("/Publish/"),
    );
    expect(published.length).toBeGreaterThan(0);
    expect(
      published.every((asset) => {
        const receipt = asset.metadata?.["publish_receipt"] as
          | { comment?: unknown; publisher?: unknown; sidecar?: unknown }
          | undefined;
        return (
          typeof receipt?.comment === "string" &&
          typeof receipt?.publisher === "string" &&
          typeof receipt?.sidecar === "string"
        );
      }),
    ).toBe(true);
  });

  it("fetches assets and single assets by id", async () => {
    const assets = await fetchAssets();
    expect(assets.length).toBeGreaterThan(0);
    const createdTimes = assets.map((asset) => Date.parse(asset.created_at));
    expect(createdTimes).toEqual([...createdTimes].sort((a, b) => b - a));
    const target = assets[0];
    expect(target).toBeDefined();
    if (!target) return;
    await expect(fetchAsset(target.id)).resolves.toMatchObject({ id: target.id });
    await expect(
      fetchAsset("00000000-0000-4000-8000-000000000000"),
    ).resolves.toBeUndefined();
  });

  it("fetches providers and a single provider by id", async () => {
    const providers = await fetchProviders();
    expect(providers.length).toBeGreaterThan(0);
    const local = await fetchProvider("prov_local");
    expect(local?.name).toBe("Local Runtime");
    await expect(
      fetchProvider("00000000-0000-4000-8000-000000000000"),
    ).resolves.toBeUndefined();
  });
});

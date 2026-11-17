import { afterEach, describe, expect, it } from "vitest";

import type { StreamEvent } from "../../types";
import { PROJECTS } from "./data";
import {
  clearMockFailures,
  fetchAsset,
  fetchAssets,
  fetchAssetsByProject,
  fetchCapabilities,
  fetchConversation,
  fetchComments,
  fetchConversations,
  fetchCurrentUser,
  fetchExtension,
  fetchExtensions,
  fetchHomeSummary,
  fetchJob,
  fetchJobs,
  fetchJobsByProject,
  fetchMessages,
  fetchOperations,
  openConversationStream,
  sendMessage,
  setMockFailure,
  fetchOrganizations,
  fetchOrchestrationRun,
  fetchPresence,
  fetchProject,
  fetchProjectAudit,
  fetchProjectDetail,
  fetchProjects,
  fetchProvider,
  fetchProviders,
  fetchRecentAssets,
  fetchSearch,
  fetchStorageStats,
  fetchWorkflowTemplates,
  resetMockAssets,
  updateAsset,
} from "./mockApi";

afterEach(() => {
  resetMockAssets();
  clearMockFailures();
});

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

  it("lists workflow-template resources with filter queries", async () => {
    const templates = await fetchWorkflowTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(3);
    expect(
      templates.every(
        (asset) => asset.type === "resource" && asset.metadata?.["template"] === true,
      ),
    ).toBe(true);
    expect(templates.map((a) => a.name)).toEqual([...templates.map((a) => a.name)].sort());
    const projects = await fetchProjects();
    const film = projects.find((project) => project.name.startsWith("Moonshot"));
    expect(film).toBeDefined();
    if (!film) return;
    const scoped = await fetchWorkflowTemplates(film.id);
    expect(scoped.every((asset) => asset.project_id === film.id)).toBe(true);
    await expect(fetchWorkflowTemplates("00000000-0000-4000-8000-000000000000")).resolves.toEqual([]);
  });

  it("seeds Ver_001/Ver_002 chains with Output/Publish keys and publish receipts", async () => {
    const v2Out = await fetchAsset("0b5c1e2a-2000-4000-8000-000000000028");
    const v2Pub = await fetchAsset("0b5c1e2a-2000-4000-8000-000000000029");
    expect(v2Out?.storage.key).toContain("/Shots/s01_c01/Ver_002/Compose/Output/");
    expect(v2Pub?.storage.key).toContain("/Shots/s01_c01/Ver_002/Compose/Publish/");
    const receipt = v2Pub?.metadata?.["publish_receipt"] as
      | { comment?: string; publisher?: string; sidecar?: string }
      | undefined;
    expect(receipt?.comment).toContain("supersedes");
    expect(typeof receipt?.publisher).toBe("string");
    expect(receipt?.sidecar).toBe("Publish/s01_c01_v002.sidecar.json");
    expect(v2Out?.metadata?.["publish_receipt"]).toBeUndefined();
  });

  it("covers single-item detail for new workflow-template and version seeds", async () => {
    const template = await fetchAsset("0b5c1e2a-2000-4000-8000-000000000030");
    expect(template?.type).toBe("resource");
    expect(template?.metadata?.["template"]).toBe(true);
    const templateMeta = template?.metadata?.["workflow_template"] as
      | { operation_id?: string }
      | undefined;
    expect(templateMeta?.operation_id).toBe("dataset-prep");

    await expect(fetchAsset("0b5c1e2a-2000-4000-8000-000000000031")).resolves.toMatchObject({
      type: "resource",
      name: "lora-train-template.json",
    });
    await expect(fetchAsset("ffffffff-0000-4000-8000-000000000000")).resolves.toBeUndefined();

    await expect(fetchJob("0b5c1e2a-3000-4000-8000-000000000016")).resolves.toMatchObject({
      status: "failed",
    });
    await expect(fetchJob("ffffffff-0000-4000-8000-000000000000")).resolves.toBeUndefined();
    await expect(fetchProvider("prov_train")).resolves.toMatchObject({
      id: "prov_train",
      location: "cloud",
    });
    await expect(fetchProvider("ffffffff-0000-4000-8000-000000000000")).resolves.toBeUndefined();
  });

  it("exposes a pipeline operation catalog with stable ids", async () => {
    const catalog = await fetchOperations();
    const ids = new Set((catalog.operations ?? []).map((operation) => operation.id));
    for (const id of [
      "text-to-image",
      "dataset-prep",
      "lora-train",
      "image-to-video",
      "flf2v",
      "upscale",
      "3d-reconstruction",
      "splat-train",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
    expect(catalog.version).toBe("v1");
  });

  it("flattens provider capabilities and filters by operation", async () => {
    const all = await fetchCapabilities();
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((row) => typeof row.provider_id === "string")).toBe(true);
    const train = await fetchCapabilities("lora-train");
    expect(train.length).toBeGreaterThan(0);
    expect(train.every((row) => row.operation_id === "lora-train")).toBe(true);
    await expect(fetchCapabilities("no-such-operation")).resolves.toEqual([]);
  });

  it("lists conversations by project and their messages in transcript order", async () => {
    const projects = await fetchProjects();
    const film = projects.find((project) => project.name.startsWith("Moonshot"));
    expect(film).toBeDefined();
    if (!film) return;

    const conversations = await fetchConversations(film.id);
    expect(conversations.length).toBeGreaterThan(0);
    expect(conversations.every((c) => c.project_id === film.id)).toBe(true);
    await expect(fetchConversations("00000000-0000-4000-8000-000000000000")).resolves.toEqual([]);

    const target = conversations[0];
    expect(target).toBeDefined();
    if (!target) return;
    await expect(fetchConversation(target.id)).resolves.toMatchObject({ id: target.id });
    await expect(
      fetchConversation("00000000-0000-4000-8000-000000000000"),
    ).resolves.toBeUndefined();

    const messages = await fetchMessages(target.id);
    expect(messages.length).toBeGreaterThan(0);
    const times = messages.map((message) => Date.parse(message.created_at));
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect((await fetchMessages(target.id, 1)).length).toBeLessThanOrEqual(1);
    await expect(fetchMessages("00000000-0000-4000-8000-000000000000")).resolves.toEqual([]);
  });

  it("seeds auth, orchestration, presence, comments, storage and extensions", async () => {
    const user = await fetchCurrentUser();
    expect(user.email).toContain("@");
    expect((await fetchOrganizations()).length).toBeGreaterThan(0);

    const runs = await fetchOrchestrationRun("0b5c1e2a-6000-4000-8000-000000000001");
    expect(runs?.job_ids?.length).toBeGreaterThan(0);
    await expect(fetchOrchestrationRun("missing")).resolves.toBeUndefined();

    const projects = await fetchProjects();
    const film = projects.find((project) => project.name.startsWith("Moonshot"));
    const empty = projects.find((project) => project.name.startsWith("Blank Slate"));
    expect(film).toBeDefined();
    expect(empty).toBeDefined();
    if (!film || !empty) return;

    expect((await fetchPresence(film.id)).length).toBeGreaterThan(0);
    await expect(fetchPresence(empty.id)).resolves.toEqual([]);
    expect((await fetchComments(film.id)).length).toBeGreaterThan(0);
    await expect(fetchComments(film.id, "missing-asset")).resolves.toEqual([]);
    await expect(fetchComments(empty.id)).resolves.toEqual([]);

    const stats = await fetchStorageStats(film.id);
    expect(stats.project_id).toBe(film.id);
    expect(stats.quota.limit).toBeGreaterThan(0);
    const emptyStats = await fetchStorageStats(empty.id);
    expect(emptyStats.object_count).toBe(0);

    const extensions = await fetchExtensions();
    expect(extensions.length).toBeGreaterThanOrEqual(3);
    expect(new Set(extensions.map((e) => e.status)).size).toBeGreaterThan(1);
    await expect(fetchExtension("comfyui-local-adapter")).resolves.toMatchObject({
      status: "enabled",
    });
    await expect(fetchExtension("missing")).resolves.toBeUndefined();
  });
});

describe("mock chat writes and streams", () => {
  const syntheticConversationId = "00000000-0000-4000-8000-000000000099";

  async function waitForEvents(events: readonly StreamEvent[], count: number): Promise<void> {
    const deadline = Date.now() + 5_000;
    while (events.length < count && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  it("sendMessage persists an authoritative message visible on refetch", async () => {
    const message = await sendMessage(syntheticConversationId, {
      content: "Make it so",
      operation_id: "text-to-image",
    });

    expect(message).toMatchObject({
      conversation_id: syntheticConversationId,
      role: "user",
      content: "Make it so",
      status: "complete",
      operation_id: "text-to-image",
    });
    expect(message.id).toMatch(/^0b5c1e2a-7000-4000-8000-\d{12}$/);
    await expect(fetchMessages(syntheticConversationId)).resolves.toEqual([message]);
    await expect(fetchMessages(syntheticConversationId, 1)).resolves.toEqual([message]);
    await expect(fetchMessages("00000000-0000-4000-8000-000000000098")).resolves.toEqual([]);
  });

  it("streams ordered events from the resume cursor and stops on close", async () => {
    const events: StreamEvent[] = [];
    const stream = openConversationStream("c1", 10);
    const unsubscribe = stream.onEvent((event) => events.push(event));
    await waitForEvents(events, 4);

    expect(events.map((event) => event.type)).toEqual([
      "message_start",
      "delta",
      "delta",
      "message_complete",
    ]);
    expect(events.map((event) => event.seq)).toEqual([11, 12, 13, 14]);
    unsubscribe();
    stream.close();

    const afterClose: StreamEvent[] = [];
    const closed = openConversationStream("c1");
    closed.onEvent((event) => afterClose.push(event));
    closed.close();
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(afterClose).toEqual([]);
  });

  it("exposes guardable error states that reset cleanly", async () => {
    try {
      setMockFailure("home");
      await expect(fetchHomeSummary()).rejects.toMatchObject({
        status: 503,
        code: "mock_failure",
      });

      setMockFailure("*");
      await expect(fetchProjects()).rejects.toMatchObject({ code: "mock_failure" });
      await expect(fetchMessages("c1")).rejects.toMatchObject({ code: "mock_failure" });
      await expect(sendMessage("c1", { content: "x" })).rejects.toMatchObject({
        code: "mock_failure",
      });

      setMockFailure("*", false);
      setMockFailure("stream");
      const events: StreamEvent[] = [];
      const stream = openConversationStream("c1");
      stream.onEvent((event) => events.push(event));
      await waitForEvents(events, 1);
      expect(events[0]).toMatchObject({ type: "error", error: "Mock stream failure" });
      stream.close();
    } finally {
      clearMockFailures();
    }

    await expect(fetchHomeSummary()).resolves.toBeDefined();
    await expect(fetchProjects()).resolves.toBeDefined();
  });
});

describe("mock API asset writes", () => {
  const MISSING_ID = "00000000-0000-4000-8000-000000000000";

  it("persists a name/tags/metadata patch and surfaces it on every read", async () => {
    const assets = await fetchAssets();
    const target = assets[0];
    expect(target).toBeDefined();
    if (!target) return;

    const updated = await updateAsset(target.id, {
      name: "Renamed frame",
      tags: ["reviewed", "ready"],
      metadata: { review_note: "looks good" },
    });

    expect(updated).toMatchObject({
      id: target.id,
      name: "Renamed frame",
      tags: ["reviewed", "ready"],
      metadata: { review_note: "looks good" },
    });
    expect(Date.parse(updated.updated_at)).toBeGreaterThan(Date.parse(target.updated_at));
    await expect(fetchAsset(target.id)).resolves.toMatchObject({ name: "Renamed frame" });
    expect((await fetchAssets()).find((asset) => asset.id === target.id)?.name).toBe(
      "Renamed frame",
    );
    expect(
      (await fetchAssetsByProject(target.project_id)).find((asset) => asset.id === target.id)
        ?.name,
    ).toBe("Renamed frame");
    const detail = await fetchProjectDetail(target.project_id);
    expect(detail?.assets.find((asset) => asset.id === target.id)?.name).toBe("Renamed frame");
    expect((await fetchRecentAssets(20)).find((asset) => asset.id === target.id)?.name).toBe(
      "Renamed frame",
    );
    expect((await fetchHomeSummary()).recentAssets.find((asset) => asset.id === target.id)?.name).toBe(
      "Renamed frame",
    );
  });

  it("treats null tags/metadata as no-change, matching the backend repository", async () => {
    const assets = await fetchAssets();
    const target = assets.find((asset) => (asset.tags ?? []).length > 0);
    expect(target).toBeDefined();
    if (!target) return;

    const updated = await updateAsset(target.id, {
      name: target.name,
      tags: null,
      metadata: null,
    });

    expect(updated.tags).toEqual(target.tags);
    expect(updated.metadata).toEqual(target.metadata);
  });

  it("rejects a null name, unknown ids and injected failure states", async () => {
    const assets = await fetchAssets();
    const target = assets[0];
    expect(target).toBeDefined();
    if (!target) return;

    await expect(updateAsset(target.id, { name: null })).rejects.toMatchObject({
      status: 400,
      code: "invalid_request",
      details: [{ field: "name", message: "name is required and cannot be null" }],
    });
    await expect(updateAsset(MISSING_ID, { name: "x" })).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
    expect((await fetchAsset(target.id))?.name).toBe(target.name);

    setMockFailure("assets");
    await expect(updateAsset(target.id, { name: "x" })).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });

  it("keeps seed fixtures pristine after a write is reset", async () => {
    const before = await fetchAssets();
    const target = before[0];
    expect(target).toBeDefined();
    if (!target) return;

    await updateAsset(target.id, { name: "Temporary" });
    expect((await fetchAsset(target.id))?.name).toBe("Temporary");

    resetMockAssets();
    expect((await fetchAsset(target.id))?.name).toBe(target.name);
  });
});

describe("mock API project audit (C20)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";
  const missingId = "00000000-0000-4000-8000-000000000000";

  it("returns a populated, newest-first feed for a production project", async () => {
    const trail = await fetchProjectAudit(filmId);
    expect(trail?.project_id).toBe(filmId);
    expect(trail?.events?.length ?? 0).toBeGreaterThan(0);
    const timestamps = (trail?.events ?? []).map((event) => Date.parse(event.timestamp));
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  it("returns an empty feed for a project with no assets or jobs", async () => {
    expect(await fetchProjectAudit(emptyId)).toEqual({ project_id: emptyId, events: [] });
  });

  it("resolves unknown projects to undefined", async () => {
    expect(await fetchProjectAudit(missingId)).toBeUndefined();
  });

  it("supports kind and limit filters", async () => {
    const full = await fetchProjectAudit(filmId);
    const jobsOnly = await fetchProjectAudit(filmId, { kind: "job", limit: 2 });
    expect(jobsOnly?.events).toHaveLength(2);
    expect(jobsOnly?.events?.every((event) => event.kind === "job")).toBe(true);
    expect(full?.events?.length ?? 0).toBeGreaterThan(jobsOnly?.events?.length ?? 0);
  });

  it("surfaces the injected failure state as a normalized ApiError", async () => {
    setMockFailure("audit");
    await expect(fetchProjectAudit(filmId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API cross-domain search (C22)", () => {
  it("returns ranked matches derived from the seeded stores", async () => {
    const response = await fetchSearch("moon");
    expect(response.query).toBe("moon");
    expect((response.results ?? []).length).toBeGreaterThan(1);
    expect(response.results?.some((result) => result.kind === "project")).toBe(true);
    expect(response.results?.some((result) => result.kind === "asset")).toBe(true);
    // Highest-scoring match is the prefix project name.
    expect(response.results?.[0]).toMatchObject({ kind: "project", score: 1 });
  });

  it("filters by kind and caps results with limit", async () => {
    const assetsOnly = await fetchSearch("moon", { kind: "asset" });
    expect(assetsOnly.results?.length).toBeGreaterThan(0);
    expect(assetsOnly.results?.every((result) => result.kind === "asset")).toBe(true);

    const capped = await fetchSearch("moon", { limit: 2 });
    expect(capped.results).toHaveLength(2);
  });

  it("returns an empty feed for a query with no matches", async () => {
    expect(await fetchSearch("zzzz-no-such-thing")).toEqual({
      query: "zzzz-no-such-thing",
      results: [],
    });
  });

  it("mirrors router validation and the injectable failure state", async () => {
    await expect(fetchSearch("")).rejects.toMatchObject({ status: 422, code: "validation_error" });
    await expect(fetchSearch("ok", { limit: 500 })).rejects.toMatchObject({ status: 422 });

    setMockFailure("search");
    await expect(fetchSearch("moon")).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

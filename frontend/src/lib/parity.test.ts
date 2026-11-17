import { describe, expect, it } from "vitest";

import { API_PREFIX } from "../types/common";
import { mockApiClient } from "./apiClient";
import type { ApiClient } from "./apiClient";
import {
  ASSETS,
  COMMENTS,
  CONVERSATIONS,
  CURRENT_USER,
  EXTENSIONS,
  JOBS,
  MESSAGES,
  OPERATION_CATALOG,
  ORGANIZATIONS,
  ORCHESTRATION_RUNS,
  PRESENCE,
  PROJECTS,
  PROVIDERS,
  STORAGE_STATS,
} from "./mock/data";
import { createHttpApiClient } from "./httpApiClient";

/**
 * C2 parity guard: the live and mock transports must return identical payloads
 * for the same seeded backend. The fake fetch below serves `lib/mock/data`
 * through the real HTTP paths, so any drift in filtering, sorting, view-model
 * assembly or query-string handling fails here.
 */

const NOT_FOUND = Symbol("not-found");

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function resolveSeed(path: string, params: URLSearchParams): unknown {
  const pathParts = path.split("/");
  const id = pathParts[pathParts.length - 1];

  if (path === "/projects") return PROJECTS;
  if (path.startsWith("/projects/")) return PROJECTS.find((p) => p.id === id) ?? NOT_FOUND;

  if (path === "/assets") {
    // The backend lists newest first before applying keyset/pagination limits.
    let assets = [...ASSETS].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const projectId = params.get("project_id");
    const type = params.get("type");
    const tag = params.get("tag");
    const limit = Number(params.get("limit") ?? 200);
    if (projectId) assets = assets.filter((a) => a.project_id === projectId);
    if (type) assets = assets.filter((a) => a.type === type);
    if (tag) assets = assets.filter((a) => (a.tags ?? []).includes(tag));
    return assets.slice(0, limit);
  }
  if (path.startsWith("/assets/")) return ASSETS.find((a) => a.id === id) ?? NOT_FOUND;

  if (path === "/jobs") {
    let jobs = [...JOBS];
    const projectId = params.get("project_id");
    const status = params.get("status");
    if (projectId) jobs = jobs.filter((j) => j.project_id === projectId);
    if (status) jobs = jobs.filter((j) => j.status === status);
    return jobs;
  }
  if (path.startsWith("/jobs/")) return JOBS.find((j) => j.id === id) ?? NOT_FOUND;

  if (path === "/providers") return PROVIDERS;
  if (path.startsWith("/providers/")) return PROVIDERS.find((p) => p.id === id) ?? NOT_FOUND;
  if (path === "/capabilities") {
    const operationId = params.get("operation_id");
    return PROVIDERS.flatMap((provider) =>
      (provider.capabilities ?? [])
        .filter((cap) => !operationId || cap.operation_id === operationId)
        .map((cap) => ({
          provider_id: provider.id,
          provider_name: provider.name,
          location: provider.location,
          status: provider.status,
          operation_id: cap.operation_id,
          schema_versions: cap.schema_versions ?? [],
        })),
    );
  }
  if (path === "/operations") return OPERATION_CATALOG;

  if (path === "/conversations") {
    return CONVERSATIONS.filter((c) => c.project_id === params.get("project_id"));
  }
  if (path.endsWith("/messages")) {
    const conversation = path.split("/")[2];
    const limit = Number(params.get("limit") ?? Number.MAX_SAFE_INTEGER);
    return MESSAGES.filter((m) => m.conversation_id === conversation).slice(-limit);
  }
  if (path.startsWith("/conversations/")) {
    return CONVERSATIONS.find((c) => c.id === id) ?? NOT_FOUND;
  }

  if (path === "/auth/me") return CURRENT_USER;
  if (path === "/orgs") return ORGANIZATIONS;
  if (path.startsWith("/orchestration/runs/")) {
    return ORCHESTRATION_RUNS.find((r) => r.run_id === id) ?? NOT_FOUND;
  }
  if (path === "/collaboration/presence") {
    return PRESENCE.filter((p) => p.project_id === params.get("project_id"));
  }
  if (path === "/collaboration/comments") {
    const assetId = params.get("asset_id");
    return COMMENTS.filter(
      (c) => c.project_id === params.get("project_id") && (!assetId || c.asset_id === assetId),
    );
  }
  if (path === "/storage/stats") {
    return STORAGE_STATS.find((s) => s.project_id === params.get("project_id")) ?? NOT_FOUND;
  }
  if (path === "/extensions") return EXTENSIONS;
  if (path.startsWith("/extensions/")) {
    return EXTENSIONS.find((e) => e.manifest.id === id) ?? NOT_FOUND;
  }

  return NOT_FOUND;
}

function seedFetch(): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(String(input), "http://local");
    const path = url.pathname.replace(API_PREFIX, "");
    const body = resolveSeed(path, url.searchParams);
    if (body === NOT_FOUND) {
      return jsonResponse({ error: { code: "not_found", message: "not found" } }, 404);
    }
    return jsonResponse(body);
  }) as typeof fetch;
}

const filmId = PROJECTS.find((p) => p.name.startsWith("Moonshot"))?.id ?? "";
const emptyId = PROJECTS.find((p) => p.name.startsWith("Blank Slate"))?.id ?? "";
const failedJobId = JOBS.find((j) => j.status === "failed")?.id ?? "";
const conversationId = CONVERSATIONS.find((c) => c.project_id === filmId)?.id ?? "";
const runId = ORCHESTRATION_RUNS[0]?.run_id ?? "";
const extensionId = EXTENSIONS[0]?.manifest.id ?? "";

type Queries = {
  [K in keyof ApiClient]: ApiClient[K] extends (...args: infer A) => unknown
    ? (...args: A) => Promise<unknown>
    : never;
};

describe("live vs mock transport parity", () => {
  const live: ApiClient = createHttpApiClient("http://localhost:8000", {
    fetchImpl: seedFetch(),
  });

  it("returns identical payloads for every populated query", async () => {
    const cases: Array<[string, (api: ApiClient) => Promise<unknown>]> = [
      ["getHomeSummary", (api) => api.getHomeSummary()],
      ["listProjects", (api) => api.listProjects()],
      ["getProject", (api) => api.getProject(filmId)],
      ["listAssets", (api) => api.listAssets()],
      ["getAsset", (api) => api.getAsset(ASSETS[0]?.id ?? "")],
      ["listRecentAssets", (api) => api.listRecentAssets(6)],
      ["listAssetsByProject", (api) => api.listAssetsByProject(filmId)],
      ["listJobs", (api) => api.listJobs()],
      ["listJobsByProject", (api) => api.listJobsByProject(filmId)],
      ["getJob", (api) => api.getJob(failedJobId)],
      ["getProjectDetail", (api) => api.getProjectDetail(filmId)],
      ["listProviders", (api) => api.listProviders()],
      ["getProvider", (api) => api.getProvider("prov_local")],
      ["listWorkflowTemplates", (api) => api.listWorkflowTemplates()],
      ["getOperations", (api) => api.getOperations()],
      ["listCapabilities", (api) => api.listCapabilities()],
      ["listConversations", (api) => api.listConversations(filmId)],
      ["getConversation", (api) => api.getConversation(conversationId)],
      ["listMessages", (api) => api.listMessages(conversationId)],
      ["getCurrentUser", (api) => api.getCurrentUser()],
      ["listOrganizations", (api) => api.listOrganizations()],
      ["getOrchestrationRun", (api) => api.getOrchestrationRun(runId)],
      ["listPresence", (api) => api.listPresence(filmId)],
      ["listComments", (api) => api.listComments(filmId)],
      ["getStorageStats", (api) => api.getStorageStats(filmId)],
      ["listExtensions", (api) => api.listExtensions()],
      ["getExtension", (api) => api.getExtension(extensionId)],
    ];

    for (const [name, run] of cases) {
      const [mockValue, liveValue] = await Promise.all([run(mockApiClient), run(live)]);
      expect(liveValue, `${name} differs between mock and live`).toEqual(mockValue);
    }
  }, 20_000);

  it("returns identical empty/not-found shapes for both transports", async () => {
    expect(await live.listAssetsByProject(emptyId)).toEqual(
      await mockApiClient.listAssetsByProject(emptyId),
    );
    expect(await live.listJobsByProject(emptyId)).toEqual(
      await mockApiClient.listJobsByProject(emptyId),
    );
    expect(await live.listConversations(emptyId)).toEqual(
      await mockApiClient.listConversations(emptyId),
    );
    expect(await live.getProject("00000000-0000-4000-8000-000000000000")).toBeUndefined();
    expect(await mockApiClient.getProject("00000000-0000-4000-8000-000000000000")).toBeUndefined();
  });

  it("still normalizes a backend failure into an ApiError in live mode", async () => {
    const failing: ApiClient = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "internal_error", message: "boom" } }, 500)) as typeof fetch,
    });
    await expect(failing.listProjects()).rejects.toMatchObject({
      status: 500,
      code: "internal_error",
      message: "boom",
    });
  });

  it("keeps the query surface in lockstep", () => {
    const mockKeys = Object.keys(mockApiClient).sort();
    const liveKeys = Object.keys(live).sort();
    expect(liveKeys).toEqual(mockKeys);
    // Compile-time guard that every query method stays callable with its args.
    const typed: Queries = live as unknown as Queries;
    expect(typeof typed.getHomeSummary).toBe("function");
  });
});

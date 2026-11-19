import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import { API_PREFIX } from "../types/common";
import { deriveActivityFeed, validateActivityArgs } from "./activity";
import type { ActivityOptions } from "./activity";
import { filterAuditTrail } from "./audit";
import type { AuditQuery } from "./audit";
import { mockApiClient } from "./apiClient";
import { deriveAssetStats, validateAssetStatsArgs } from "./assetStats";
import { deriveConversationStats, validateConversationStatsArgs } from "./conversationStats";
import type { ApiClient } from "./apiClient";
import { deriveDashboardSummary, validateDashboardArgs } from "./dashboard";
import { deriveAssetImpact, validateImpactArgs } from "./impact";
import { deriveJobStats, validateJobStatsArgs } from "./jobStats";
import type { ImpactOptions } from "./impact";
import {
  ASSETS,
  AUDIT_TRAILS,
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
  REFERENCE_NOW,
  STORAGE_STATS,
} from "./mock/data";
import { createHttpApiClient } from "./httpApiClient";
import { deriveSearchResponse, validateSearchArgs } from "./search";
import type { SearchOptions } from "./search";
import { deriveTagIndex, validateTagArgs } from "./tags";
import type { TagOptions } from "./tags";

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

  // The authoritative audit feed is derived by the backend, not a raw seed;
  // emulate that derivation over the same asset/job-derived trail seeds.
  if (/^\/projects\/[^/]+\/audit$/.test(path)) {
    const projectId = pathParts[2] ?? "";
    const trail = AUDIT_TRAILS.find((entry) => entry.project_id === projectId);
    if (!trail) return NOT_FOUND;
    const kind = params.get("kind");
    const since = params.get("since");
    const until = params.get("until");
    const limitRaw = params.get("limit");
    const query: AuditQuery = {
      ...(kind ? { kind: kind as AuditQuery["kind"] } : {}),
      ...(since ? { since } : {}),
      ...(until ? { until } : {}),
      ...(limitRaw !== null ? { limit: Number(limitRaw) } : {}),
    };
    return filterAuditTrail(trail, query);
  }

  // Authoritative workspace activity is derived from the same asset/job/comment
  // stores on every call; reproduce the router's 422 validation, 404 for an
  // unknown project scope and the repository derivation over the shared seeds.
  if (path === "/activity") {
    const projectId = params.get("project_id") ?? undefined;
    const kindRaw = params.get("kind");
    const limitRaw = params.get("limit");
    const options: ActivityOptions = {
      ...(projectId ? { projectId } : {}),
      ...(kindRaw ? { kind: kindRaw as ActivityOptions["kind"] } : {}),
      ...(limitRaw !== null ? { limit: Number(limitRaw) } : {}),
    };
    try {
      validateActivityArgs(options);
    } catch (cause) {
      if (cause instanceof ApiError) {
        return jsonResponse(
          { error: { code: cause.code, message: cause.message, details: cause.details } },
          422,
        );
      }
      throw cause;
    }
    if (options.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
      return NOT_FOUND;
    }
    return deriveActivityFeed(ASSETS, JOBS, COMMENTS, options);
  }

  // Authoritative cross-domain search is derived from the same document stores
  // on every call; reproduce the router's 422 validation and the repository's
  // ranking over the shared seeds so live and mock agree exactly.
  if (path === "/search") {
    const q = params.get("q") ?? "";
    const kindRaw = params.get("kind");
    const limitRaw = params.get("limit");
    const options: SearchOptions = {
      ...(kindRaw ? { kind: kindRaw as SearchOptions["kind"] } : {}),
      ...(limitRaw !== null ? { limit: Number(limitRaw) } : {}),
    };
    try {
      validateSearchArgs(q, options);
    } catch (cause) {
      if (cause instanceof ApiError) {
        return jsonResponse(
          { error: { code: cause.code, message: cause.message, details: cause.details } },
          422,
        );
      }
      throw cause;
    }
    return deriveSearchResponse(q, PROJECTS, ASSETS, CONVERSATIONS, options);
  }

  // Authoritative dashboard summary is derived from the same stores on every
  // call; reproduce the router's 422 validation and the repository derivation.
  if (path === "/dashboard") {
    const limitRaw = params.get("recent_limit");
    const options = limitRaw !== null ? { recentLimit: Number(limitRaw) } : {};
    try {
      validateDashboardArgs(options.recentLimit);
    } catch (cause) {
      if (cause instanceof ApiError) {
        return jsonResponse(
          { error: { code: cause.code, message: cause.message, details: cause.details } },
          422,
        );
      }
      throw cause;
    }
    return deriveDashboardSummary(
      {
        projects: PROJECTS,
        assets: ASSETS,
        conversations: CONVERSATIONS,
        jobs: JOBS,
        providers: PROVIDERS,
        extensions: EXTENSIONS,
        now: REFERENCE_NOW,
      },
      options,
    );
  }

  // Authoritative tag facets are derived from the asset store on every call;
  // reproduce the router's 422 validation, unknown-project 404 and repository
  // derivation over the shared seeds so live and mock agree exactly.
  if (path === "/tags") {
    const projectId = params.get("project_id") ?? undefined;
    const prefixRaw = params.get("prefix");
    const limitRaw = params.get("limit");
    const options: TagOptions = {
      ...(projectId ? { projectId } : {}),
      ...(prefixRaw !== null ? { prefix: prefixRaw } : {}),
      ...(limitRaw !== null ? { limit: Number(limitRaw) } : {}),
    };
    try {
      validateTagArgs(options);
    } catch (cause) {
      if (cause instanceof ApiError) {
        return jsonResponse(
          { error: { code: cause.code, message: cause.message, details: cause.details } },
          422,
        );
      }
      throw cause;
    }
    if (options.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
      return NOT_FOUND;
    }
    return deriveTagIndex(ASSETS, options);
  }

  // Authoritative downstream impact is derived from lineage relationships;
  // reproduce the router's 422 validation, unknown-root 404 and BFS derivation.
  if (/^\/assets\/[^/]+\/impact$/.test(path)) {
    const assetId = pathParts[2] ?? "";
    const depthRaw = params.get("max_depth");
    const options: ImpactOptions = depthRaw !== null ? { maxDepth: Number(depthRaw) } : {};
    try {
      validateImpactArgs(assetId, options);
    } catch (cause) {
      if (cause instanceof ApiError) {
        return jsonResponse(
          { error: { code: cause.code, message: cause.message, details: cause.details } },
          422,
        );
      }
      throw cause;
    }
    if (!ASSETS.some((asset) => asset.id === assetId)) return NOT_FOUND;
    return deriveAssetImpact(assetId, ASSETS, options);
  }

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
  // Authoritative asset inventory stats are derived from the asset store on
  // every call; reproduce the router's 422 validation, unknown-project 404 and
  // the repository derivation over the shared seeds so live and mock agree.
  if (path === "/assets/stats") {
    const projectId = params.get("project_id") ?? undefined;
    const options = projectId ? { projectId } : {};
    try {
      validateAssetStatsArgs(options);
    } catch (cause) {
      if (cause instanceof ApiError) {
        return jsonResponse(
          { error: { code: cause.code, message: cause.message, details: cause.details } },
          422,
        );
      }
      throw cause;
    }
    if (projectId && !PROJECTS.some((project) => project.id === projectId)) return NOT_FOUND;
    return deriveAssetStats(ASSETS, REFERENCE_NOW, options);
  }

  if (path.startsWith("/assets/")) return ASSETS.find((a) => a.id === id) ?? NOT_FOUND;

  // Authoritative job execution stats are derived from the job store on every
  // call; reproduce the router's 422 validation, unknown-project 404 and the
  // repository derivation over the shared seeds so live and mock agree exactly.
  if (path === "/jobs/stats") {
    const projectId = params.get("project_id") ?? undefined;
    const options = projectId ? { projectId } : {};
    try {
      validateJobStatsArgs(options);
    } catch (cause) {
      if (cause instanceof ApiError) {
        return jsonResponse(
          { error: { code: cause.code, message: cause.message, details: cause.details } },
          422,
        );
      }
      throw cause;
    }
    if (projectId && !PROJECTS.some((project) => project.id === projectId)) return NOT_FOUND;
    return deriveJobStats(JOBS, REFERENCE_NOW, options);
  }

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

  // Authoritative conversation/message stats are derived from the conversation
  // and message stores on every call; reproduce the router's 422 validation,
  // unknown-project 404 and repository derivation over the shared seeds. This
  // must precede the dynamic /conversations/{id} detail branch below.
  if (path === "/conversations/stats") {
    const projectId = params.get("project_id") ?? undefined;
    const options = projectId ? { projectId } : {};
    try {
      validateConversationStatsArgs(options);
    } catch (cause) {
      if (cause instanceof ApiError) {
        return jsonResponse(
          { error: { code: cause.code, message: cause.message, details: cause.details } },
          422,
        );
      }
      throw cause;
    }
    if (projectId && !PROJECTS.some((project) => project.id === projectId)) return NOT_FOUND;
    return deriveConversationStats(CONVERSATIONS, MESSAGES, REFERENCE_NOW, options);
  }

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
  if (path === "/presence") {
    return PRESENCE.filter((p) => p.project_id === params.get("project_id"));
  }
  if (path === "/comments") {
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
    // Derived endpoints may return an already-built error Response (e.g. the
    // dashboard/search 422 envelopes); pass it through rather than re-wrapping.
    if (
      body &&
      typeof body === "object" &&
      "ok" in body &&
      "status" in body &&
      "text" in body
    ) {
      return body as Response;
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
/** Moonshot concept asset whose descendants exercise the full impact chain. */
const impactRootId = "0b5c1e2a-2000-4000-8000-000000000011";

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
      ["getActivity", (api) => api.getActivity()],
      ["getActivity scoped", (api) => api.getActivity({ projectId: filmId })],
      ["getActivity filtered", (api) => api.getActivity({ projectId: filmId, kind: "job", limit: 3 })],
      ["getDashboard", (api) => api.getDashboard()],
      ["getDashboard limited", (api) => api.getDashboard({ recentLimit: 3 })],
      ["getJobStats", (api) => api.getJobStats()],
      ["getJobStats scoped", (api) => api.getJobStats({ projectId: filmId })],
      ["getAssetStats", (api) => api.getAssetStats()],
      ["getAssetStats scoped", (api) => api.getAssetStats({ projectId: filmId })],
      ["getConversationStats", (api) => api.getConversationStats()],
      ["getConversationStats scoped", (api) => api.getConversationStats({ projectId: filmId })],
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
      ["getProjectAudit", (api) => api.getProjectAudit(filmId)],
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
      ["search", (api) => api.search("moon")],
      ["search filtered", (api) => api.search("moon", { kind: "asset", limit: 3 })],
      ["getTags", (api) => api.getTags()],
      ["getTags scoped", (api) => api.getTags({ projectId: filmId })],
      ["getTags filtered", (api) => api.getTags({ projectId: filmId, prefix: "lora", limit: 3 })],
      ["getAssetImpact", (api) => api.getAssetImpact(impactRootId)],
      ["getAssetImpact limited", (api) => api.getAssetImpact(impactRootId, { maxDepth: 2 })],
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
    // An empty (but valid) project scope yields the same zero-filled snapshot.
    expect(await live.getJobStats({ projectId: emptyId })).toEqual(
      await mockApiClient.getJobStats({ projectId: emptyId }),
    );
    expect(await live.getAssetStats({ projectId: emptyId })).toEqual(
      await mockApiClient.getAssetStats({ projectId: emptyId }),
    );
    expect(await live.getConversationStats({ projectId: emptyId })).toEqual(
      await mockApiClient.getConversationStats({ projectId: emptyId }),
    );
    expect(await live.listConversations(emptyId)).toEqual(
      await mockApiClient.listConversations(emptyId),
    );
    expect(await live.getActivity({ projectId: emptyId })).toEqual(
      await mockApiClient.getActivity({ projectId: emptyId }),
    );
    // Both transports 404 identically for an unknown project scope.
    const missingId = "00000000-0000-4000-8000-000000000000";
    const [mock404, live404] = await Promise.all([
      mockApiClient.getActivity({ projectId: missingId }).catch((cause) => cause),
      live.getActivity({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mock404).toMatchObject({ status: 404, code: "not_found" });
    expect(live404).toMatchObject({ status: 404, code: "not_found" });
    expect(await live.getProject("00000000-0000-4000-8000-000000000000")).toBeUndefined();
    expect(await mockApiClient.getProject("00000000-0000-4000-8000-000000000000")).toBeUndefined();
    expect(await live.getProjectAudit(emptyId)).toEqual(await mockApiClient.getProjectAudit(emptyId));
    expect(await live.getProjectAudit("00000000-0000-4000-8000-000000000000")).toBeUndefined();
    expect(
      await mockApiClient.getProjectAudit("00000000-0000-4000-8000-000000000000"),
    ).toBeUndefined();
    expect(await live.search("zzzz-no-such-thing")).toEqual(
      await mockApiClient.search("zzzz-no-such-thing"),
    );
    // Both transports reject the same out-of-range dashboard limit identically.
    const [mockErr, liveErr] = await Promise.all([
      mockApiClient.getDashboard({ recentLimit: 0 }).catch((cause) => cause),
      live.getDashboard({ recentLimit: 0 }).catch((cause) => cause),
    ]);
    expect(mockErr).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveErr).toMatchObject({ status: 422, code: "validation_error" });

    // Both transports reject the same out-of-range activity limit identically.
    const [mockActivityErr, liveActivityErr] = await Promise.all([
      mockApiClient.getActivity({ limit: 0 }).catch((cause) => cause),
      live.getActivity({ limit: 0 }).catch((cause) => cause),
    ]);
    expect(mockActivityErr).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveActivityErr).toMatchObject({ status: 422, code: "validation_error" });

    // Both transports 404 identically for an unknown project tag scope.
    const [mockTags404, liveTags404] = await Promise.all([
      mockApiClient.getTags({ projectId: missingId }).catch((cause) => cause),
      live.getTags({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockTags404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveTags404).toMatchObject({ status: 404, code: "not_found" });

    // Both transports 404 identically for an unknown job-stats project scope
    // and reject a malformed project id with the same 422 envelope.
    const [mockStats404, liveStats404] = await Promise.all([
      mockApiClient.getJobStats({ projectId: missingId }).catch((cause) => cause),
      live.getJobStats({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockStats404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveStats404).toMatchObject({ status: 404, code: "not_found" });
    const [mockStats422, liveStats422] = await Promise.all([
      mockApiClient.getJobStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
      live.getJobStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
    ]);
    expect(mockStats422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveStats422).toMatchObject({ status: 422, code: "validation_error" });

    // Both transports 404 identically for an unknown conversation-stats project
    // scope and reject a malformed project id with the same 422 envelope.
    const [mockConvStats404, liveConvStats404] = await Promise.all([
      mockApiClient.getConversationStats({ projectId: missingId }).catch((cause) => cause),
      live.getConversationStats({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockConvStats404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveConvStats404).toMatchObject({ status: 404, code: "not_found" });
    const [mockConvStats422, liveConvStats422] = await Promise.all([
      mockApiClient.getConversationStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
      live.getConversationStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
    ]);
    expect(mockConvStats422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveConvStats422).toMatchObject({ status: 422, code: "validation_error" });

    // Both transports 404 identically for an unknown asset-stats project scope
    // and reject a malformed project id with the same 422 envelope.
    const [mockAssetStats404, liveAssetStats404] = await Promise.all([
      mockApiClient.getAssetStats({ projectId: missingId }).catch((cause) => cause),
      live.getAssetStats({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockAssetStats404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveAssetStats404).toMatchObject({ status: 404, code: "not_found" });
    const [mockAssetStats422, liveAssetStats422] = await Promise.all([
      mockApiClient.getAssetStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
      live.getAssetStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
    ]);
    expect(mockAssetStats422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveAssetStats422).toMatchObject({ status: 422, code: "validation_error" });

    // Both resolve an unknown impact root to undefined.
    expect(await live.getAssetImpact(missingId)).toEqual(
      await mockApiClient.getAssetImpact(missingId),
    );

    // Both reject an out-of-range tag limit and impact depth identically.
    const [mockTagErr, liveTagErr] = await Promise.all([
      mockApiClient.getTags({ limit: 0 }).catch((cause) => cause),
      live.getTags({ limit: 0 }).catch((cause) => cause),
    ]);
    expect(mockTagErr).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveTagErr).toMatchObject({ status: 422, code: "validation_error" });
    const [mockImpactErr, liveImpactErr] = await Promise.all([
      mockApiClient.getAssetImpact(impactRootId, { maxDepth: 0 }).catch((cause) => cause),
      live.getAssetImpact(impactRootId, { maxDepth: 0 }).catch((cause) => cause),
    ]);
    expect(mockImpactErr).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveImpactErr).toMatchObject({ status: 422, code: "validation_error" });
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
    expect(typeof typed.getActivity).toBe("function");
    expect(typeof typed.getDashboard).toBe("function");
    expect(typeof typed.getJobStats).toBe("function");
    expect(typeof typed.getAssetStats).toBe("function");
    expect(typeof typed.getConversationStats).toBe("function");
    expect(typeof typed.updateAsset).toBe("function");
    expect(typeof typed.search).toBe("function");
    expect(typeof typed.getTags).toBe("function");
    expect(typeof typed.getAssetImpact).toBe("function");
  });
});

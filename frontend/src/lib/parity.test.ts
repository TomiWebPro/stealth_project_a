import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import { API_PREFIX } from "../types/common";
import { deriveEventFeed, validateEventFeedArgs } from "./eventFeed";
import type { EventFeedOptions } from "./eventFeed";
import { deriveActivityFeed, validateActivityArgs } from "./activity";
import type { ActivityOptions } from "./activity";
import { deriveActivityStats, validateActivityStatsArgs } from "./activityStats";
import { filterAuditTrail } from "./audit";
import type { AuditQuery } from "./audit";
import { mockApiClient } from "./apiClient";
import {
  deriveCollaborationStats,
  validateCollaborationStatsArgs,
} from "./collaborationStats";
import { deriveAssetFeed, validateAssetFeedArgs } from "./assetFeed";
import type { AssetFeedOptions } from "./assetFeed";
import { deriveAssetStats, validateAssetStatsArgs } from "./assetStats";
import { deriveConversationFeed, validateConversationFeedArgs } from "./conversationFeed";
import type { ConversationFeedOptions } from "./conversationFeed";
import { deriveConversationStats, validateConversationStatsArgs } from "./conversationStats";
import { deriveCommentFeed, validateCommentFeedArgs } from "./commentFeed";
import type { CommentFeedOptions } from "./commentFeed";
import { deriveCommentStats, validateCommentStatsArgs } from "./commentStats";
import type { ApiClient } from "./apiClient";
import { deriveDashboardSummary, validateDashboardArgs } from "./dashboard";
import { deriveEventStats, validateEventStatsArgs } from "./eventStats";
import { deriveExtensionFeed, validateExtensionFeedArgs } from "./extensionFeed";
import type { ExtensionFeedOptions } from "./extensionFeed";
import { deriveExtensionStats, validateExtensionStatsArgs } from "./extensionStats";
import type { ExtensionStatsOptions } from "./extensionStats";
import { deriveAssetImpact, validateImpactArgs } from "./impact";
import { deriveJobFeed, validateJobFeedArgs } from "./jobFeed";
import type { JobFeedOptions } from "./jobFeed";
import { deriveJobLogs, validateJobLogsArgs } from "./jobLogs";
import type { JobLogsOptions } from "./jobLogs";
import { deriveJobQueue, validateJobQueueArgs } from "./jobQueue";
import type { JobQueueOptions } from "./jobQueue";
import { deriveJobStats, validateJobStatsArgs } from "./jobStats";
import { deriveLineageFeed, validateLineageFeedArgs } from "./lineageFeed";
import type { LineageFeedOptions } from "./lineageFeed";
import { deriveLineageStats, validateLineageStatsArgs } from "./lineageStats";
import { deriveOperationStats } from "./operationStats";
import { deriveOrganizationFeed, validateOrganizationFeedArgs } from "./organizationFeed";
import type { OrganizationFeedOptions } from "./organizationFeed";
import {
  deriveOrganizationStats,
  validateOrganizationStatsArgs,
} from "./organizationStats";
import type { ImpactOptions } from "./impact";
import {
  deriveOrchestrationStats,
  validateOrchestrationStatsArgs,
} from "./orchestrationStats";
import { derivePipelineStats, validatePipelineStatsArgs } from "./pipelineStats";
import { deriveProjectFeed, validateProjectFeedArgs } from "./projectFeed";
import type { ProjectFeedOptions } from "./projectFeed";
import { deriveProjectStats, validateProjectStatsArgs } from "./projectStats";
import { deriveProviderStats, validateProviderStatsArgs } from "./providerStats";
import { derivePublishFeed, validatePublishFeedArgs } from "./publishFeed";
import type { PublishFeedOptions } from "./publishFeed";
import { derivePublishStats, validatePublishStatsArgs } from "./publishStats";
import { deriveRetryStats, validateRetryStatsArgs } from "./retryStats";
import {
  ASSETS,
  ASSET_RELATIONSHIPS,
  ASSET_VERSIONS,
  AUDIT_TRAILS,
  COMMENTS,
  CONVERSATIONS,
  CURRENT_USER,
  EXTENSIONS,
  JOBS,
  JOB_EVENTS,
  JOB_RETRIES,
  MESSAGES,
  OPERATION_CATALOG,
  ORGANIZATIONS,
  ORGANIZATION_MEMBERS,
  ORCHESTRATION_PLANS,
  ORCHESTRATION_RUNS,
  PIPELINE_CHAINS,
  PRESENCE,
  PROJECTS,
  PROVIDERS,
  REFERENCE_NOW,
  STORAGE_STATS,
  UPLOADS,
  USERS,
} from "./mock/data";
import { createHttpApiClient } from "./httpApiClient";
import { deriveSearchResponse, validateSearchArgs } from "./search";
import type { SearchOptions } from "./search";
import { deriveSearchStats, validateSearchStatsArgs } from "./searchStats";
import { deriveTagIndex, validateTagArgs } from "./tags";
import { deriveUploadFeed, validateUploadFeedArgs } from "./uploadFeed";
import type { UploadFeedOptions } from "./uploadFeed";
import { deriveUploadStats, validateUploadStatsArgs } from "./uploadStats";
import { deriveVersionFeed, validateVersionFeedArgs } from "./versionFeed";
import type { VersionFeedOptions } from "./versionFeed";
import { deriveVersionStats, validateVersionStatsArgs } from "./versionStats";
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

  // Authoritative activity statistics reuse the same feed derivation over the
  // asset/job/comment stores, then aggregate it. Mirror the router's 422
  // validation, unknown-project 404 and repository aggregation over the seeds.
  if (path === "/activity/stats") {
    const projectId = params.get("project_id") ?? undefined;
    const options = projectId ? { projectId } : {};
    try {
      validateActivityStatsArgs(options);
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
    return deriveActivityStats(ASSETS, JOBS, COMMENTS, REFERENCE_NOW, options);
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

  // Authoritative search index stats count the same document stores the search
  // reads; reproduce the router's 422 validation, unknown-project 404 and the
  // repository's aggregation over the shared seeds.
  if (path === "/search/stats") {
    const projectId = params.get("project_id") ?? undefined;
    const options = projectId ? { projectId } : {};
    try {
      validateSearchStatsArgs(options);
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
    return deriveSearchStats(PROJECTS, ASSETS, CONVERSATIONS, REFERENCE_NOW, options);
  }

  // Authoritative upload statistics derive the same ticket collection the
  // `/uploads/stats` endpoint reads; mirror its 422 validation, unknown-project
  // 404 and repository aggregation over the shared upload seeds.
  if (path === "/uploads/stats") {
    const projectId = params.get("project_id") ?? undefined;
    const options = projectId ? { projectId } : {};
    try {
      validateUploadStatsArgs(options);
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
    return deriveUploadStats(UPLOADS, REFERENCE_NOW, options);
  }

  // Authoritative upload feed derives the same newest-first ticket view as the
  // `/uploads/feed` endpoint from the shared upload seeds; mirror its 422
  // validation, unknown-project 404, page bound and repository derivation so
  // live and mock agree exactly. This must follow `/uploads/stats` above.
  if (path === "/uploads/feed") {
    const projectId = params.get("project_id") ?? undefined;
    const limitRaw = params.get("limit");
    const options: UploadFeedOptions = {
      ...(projectId ? { projectId } : {}),
      ...(limitRaw !== null ? { limit: Number(limitRaw) } : {}),
    };
    try {
      validateUploadFeedArgs(options);
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
    return deriveUploadFeed(UPLOADS, PROJECTS, REFERENCE_NOW, options);
  }

  // Authoritative job event feed derives the same event collection the
  // `/events/feed` endpoint reads; mirror its 422 validation, unknown-project
  // 404 and newest-first repository derivation (with the job/project join).
  if (path === "/events/feed") {
    const projectId = params.get("project_id") ?? undefined;
    const type = params.get("type") ?? undefined;
    const rawLimit = params.get("limit");
    const options: EventFeedOptions = {
      projectId,
      type: type as EventFeedOptions["type"],
      limit: rawLimit !== null ? Number(rawLimit) : undefined,
    };
    try {
      validateEventFeedArgs(options);
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
    return deriveEventFeed(JOB_EVENTS, JOBS, PROJECTS, REFERENCE_NOW, options);
  }

  // Authoritative job event statistics derive the same event collection the
  // `/events/stats` endpoint reads; mirror its 422 validation, unknown-project
  // 404 and repository aggregation (with the job join) over the shared seeds.
  if (path === "/events/stats") {
    const projectId = params.get("project_id") ?? undefined;
    const options = projectId ? { projectId } : {};
    try {
      validateEventStatsArgs(options);
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
    return deriveEventStats(JOB_EVENTS, JOBS, REFERENCE_NOW, options);
  }

  // Authoritative job retry statistics derive the same ledger the
  // `/retries/stats` endpoint reads, joined to jobs for project attribution;
  // mirror its 422 validation, unknown-project 404 and repository aggregation.
  if (path === "/retries/stats") {
    const projectId = params.get("project_id") ?? undefined;
    const options = projectId ? { projectId } : {};
    try {
      validateRetryStatsArgs(options);
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
    return deriveRetryStats(JOB_RETRIES, JOBS, REFERENCE_NOW, options);
  }

  // Authoritative asset version feed derives the same newest-first view as the
  // `/versions/feed` endpoint from the shared version/asset/project seeds;
  // mirror its 422 validation, unknown-project 404, page bound and repository
  // derivation so live and mock agree exactly. This must precede any dynamic
  // /versions/{...} branch below.
  if (path === "/versions/feed") {
    const projectId = params.get("project_id") ?? undefined;
    const limitRaw = params.get("limit");
    const options: VersionFeedOptions = {
      ...(projectId ? { projectId } : {}),
      ...(limitRaw !== null ? { limit: Number(limitRaw) } : {}),
    };
    try {
      validateVersionFeedArgs(options);
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
    return deriveVersionFeed(ASSET_VERSIONS, ASSETS, PROJECTS, REFERENCE_NOW, options);
  }

  // Authoritative asset version statistics derive the same ASSET_VERSIONS
  // collection the `/versions/stats` endpoint reads, attributed to each live
  // asset's project; mirror its 422 validation, unknown-project 404 and
  // repository aggregation (with soft-deleted-asset exclusion) over the seeds.
  if (path === "/versions/stats") {
    const projectId = params.get("project_id") ?? undefined;
    const options = projectId ? { projectId } : {};
    try {
      validateVersionStatsArgs(options);
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
    return deriveVersionStats(ASSET_VERSIONS, ASSETS, REFERENCE_NOW, options);
  }

  // Authoritative publish statistics derive the same asset publish receipts the
  // `/publishes/stats` endpoint reads; mirror its 422 validation, unknown-project
  // 404 and repository aggregation (with soft-deleted/malformed-receipt
  // exclusion) over the shared seeds so live and mock agree exactly.
  if (path === "/publishes/stats") {
    const projectId = params.get("project_id") ?? undefined;
    const options = projectId ? { projectId } : {};
    try {
      validatePublishStatsArgs(options);
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
    return derivePublishStats(ASSETS, REFERENCE_NOW, options);
  }

  // Authoritative publish feed derives the same newest-first deliverable view as
  // the `/publishes` endpoint from the shared asset receipts; mirror its 422
  // validation, unknown-project 404, page bound and repository derivation so
  // live and mock agree exactly. This must follow `/publishes/stats` above.
  if (path === "/publishes") {
    const projectId = params.get("project_id") ?? undefined;
    const limitRaw = params.get("limit");
    const options: PublishFeedOptions = {
      ...(projectId ? { projectId } : {}),
      ...(limitRaw !== null ? { limit: Number(limitRaw) } : {}),
    };
    try {
      validatePublishFeedArgs(options);
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
    return derivePublishFeed(ASSETS, PROJECTS, REFERENCE_NOW, options);
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

  // Authoritative project portfolio stats are derived from the project/asset/
  // conversation/job stores on every call; reproduce the router's 422 validation
  // and repository derivation over the shared seeds so live and mock agree.
  // This must precede the dynamic /projects/{id} detail branch below.
  if (path === "/projects/stats") {
    const org = params.get("org_id") ?? undefined;
    const options = org ? { orgId: org } : {};
    try {
      validateProjectStatsArgs(options);
    } catch (cause) {
      if (cause instanceof ApiError) {
        return jsonResponse(
          { error: { code: cause.code, message: cause.message, details: cause.details } },
          422,
        );
      }
      throw cause;
    }
    return deriveProjectStats(PROJECTS, ASSETS, CONVERSATIONS, JOBS, REFERENCE_NOW, options);
  }

  // Authoritative project feed derives the same newest-first view as the
  // `/projects/feed` endpoint from the shared project/organization seeds; mirror
  // its 422 validation, org/lifecycle scopes and repository derivation so live
  // and mock agree exactly. This must precede the /projects branches below.
  if (path === "/projects/feed") {
    const org = params.get("org_id") ?? undefined;
    const lifecycleRaw = params.get("lifecycle");
    const limitRaw = params.get("limit");
    const options: ProjectFeedOptions = {
      ...(org ? { orgId: org } : {}),
      ...(lifecycleRaw ? { lifecycle: lifecycleRaw as ProjectFeedOptions["lifecycle"] } : {}),
      ...(limitRaw !== null ? { limit: Number(limitRaw) } : {}),
    };
    try {
      validateProjectFeedArgs(options);
    } catch (cause) {
      if (cause instanceof ApiError) {
        return jsonResponse(
          { error: { code: cause.code, message: cause.message, details: cause.details } },
          422,
        );
      }
      throw cause;
    }
    return deriveProjectFeed(PROJECTS, ORGANIZATIONS, REFERENCE_NOW, options);
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

  // Authoritative asset feed derives the same newest-first view as the
  // `/assets/feed` endpoint from the shared asset/project seeds; mirror its 422
  // validation, unknown-project 404, page bound and repository derivation so
  // live and mock agree exactly. This must precede the dynamic `/assets/{id}`
  // branch below.
  if (path === "/assets/feed") {
    const projectId = params.get("project_id") ?? undefined;
    const limitRaw = params.get("limit");
    const options: AssetFeedOptions = {
      ...(projectId ? { projectId } : {}),
      ...(limitRaw !== null ? { limit: Number(limitRaw) } : {}),
    };
    try {
      validateAssetFeedArgs(options);
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
    return deriveAssetFeed(ASSETS, PROJECTS, REFERENCE_NOW, options);
  }

  if (path.startsWith("/assets/")) return ASSETS.find((a) => a.id === id) ?? NOT_FOUND;

  // Authoritative dispatch queue is derived from the job store on every call;
  // reproduce the router's 422 validation, unknown-project 404 and FIFO
  // derivation over the shared seeds so live and mock agree exactly. This must
  // precede the dynamic `/jobs/...` lookups below.
  if (path === "/jobs/queue") {
    const projectId = params.get("project_id") ?? undefined;
    const limitRaw = params.get("limit");
    const options: JobQueueOptions = {
      ...(projectId ? { projectId } : {}),
      ...(limitRaw !== null ? { limit: Number(limitRaw) } : {}),
    };
    try {
      validateJobQueueArgs(options);
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
    return deriveJobQueue(JOBS, REFERENCE_NOW, options);
  }

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

  // Authoritative job feed derives the same newest-first view as the
  // `/jobs/feed` endpoint from the shared job/project seeds; mirror its 422
  // validation, unknown-project 404, status filter, page bound and repository
  // derivation so live and mock agree exactly. This must precede the dynamic
  // `/jobs/{id}` branch below.
  if (path === "/jobs/feed") {
    const projectId = params.get("project_id") ?? undefined;
    const statusRaw = params.get("status");
    const limitRaw = params.get("limit");
    const options: JobFeedOptions = {
      ...(projectId ? { projectId } : {}),
      ...(statusRaw ? { status: statusRaw as JobFeedOptions["status"] } : {}),
      ...(limitRaw !== null ? { limit: Number(limitRaw) } : {}),
    };
    try {
      validateJobFeedArgs(options);
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
    return deriveJobFeed(JOBS, PROJECTS, REFERENCE_NOW, options);
  }

  // Authoritative per-job execution log is derived from the same JOB_EVENTS
  // stream the endpoint reads; mirror its 422 validation, unknown-job 404 and
  // repository derivation (severity filter + resume cursor + page) over seeds.
  if (/^\/jobs\/[^/]+\/logs$/.test(path)) {
    const jobId = pathParts[2] ?? "";
    const levelRaw = params.get("level");
    const sinceRaw = params.get("since_seq");
    const limitRaw = params.get("limit");
    const options: JobLogsOptions = {
      ...(levelRaw ? { level: levelRaw as JobLogsOptions["level"] } : {}),
      ...(sinceRaw !== null ? { sinceSeq: Number(sinceRaw) } : {}),
      ...(limitRaw !== null ? { limit: Number(limitRaw) } : {}),
    };
    try {
      validateJobLogsArgs(jobId, options);
    } catch (cause) {
      if (cause instanceof ApiError) {
        return jsonResponse(
          { error: { code: cause.code, message: cause.message, details: cause.details } },
          422,
        );
      }
      throw cause;
    }
    if (!JOBS.some((job) => job.id === jobId)) return NOT_FOUND;
    return deriveJobLogs(
      jobId,
      JOB_EVENTS.filter((event) => event.job_id === jobId),
      options,
    );
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

  // Authoritative provider fleet stats are derived from the provider store on
  // every call; reproduce the router's 422 validation and repository derivation
  // over the shared seeds so live and mock agree. This must precede the dynamic
  // /providers/{id} detail branch below.
  if (path === "/providers/stats") {
    const locationRaw = params.get("location");
    const statusRaw = params.get("status");
    const options = {
      ...(locationRaw !== null ? { location: locationRaw as "local" | "studio" | "cloud" } : {}),
      ...(statusRaw !== null ? { status: statusRaw as "available" | "unavailable" | "degraded" } : {}),
    };
    try {
      validateProviderStatsArgs(options);
    } catch (cause) {
      if (cause instanceof ApiError) {
        return jsonResponse(
          { error: { code: cause.code, message: cause.message, details: cause.details } },
          422,
        );
      }
      throw cause;
    }
    return deriveProviderStats(PROVIDERS, REFERENCE_NOW, options);
  }

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

  // Authoritative catalog metrics are derived from the same operation catalog
  // on every call; reproduce the repository derivation over the shared seeds.
  if (path === "/operations/stats") {
    return deriveOperationStats(OPERATION_CATALOG.operations ?? [], REFERENCE_NOW);
  }

  // Authoritative conversation feed derives the same newest-first view as the
  // `/conversations/feed` endpoint from the shared conversation/message seeds;
  // mirror its 422 validation, unknown-project 404, page bound and repository
  // derivation so live and mock agree exactly. This must precede the
  // /conversations/stats and dynamic /conversations/{id} branches below.
  if (path === "/conversations/feed") {
    const projectId = params.get("project_id") ?? undefined;
    const limitRaw = params.get("limit");
    const options: ConversationFeedOptions = {
      ...(projectId ? { projectId } : {}),
      ...(limitRaw !== null ? { limit: Number(limitRaw) } : {}),
    };
    try {
      validateConversationFeedArgs(options);
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
    return deriveConversationFeed(CONVERSATIONS, MESSAGES, PROJECTS, REFERENCE_NOW, options);
  }

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

  // Authoritative organization feed derives the same newest-first organization
  // view as the `/orgs/feed` endpoint from the shared auth/project seeds; mirror
  // its 422 validation, page bound and repository derivation so live and mock
  // agree exactly.
  if (path === "/orgs/feed") {
    const limitRaw = params.get("limit");
    const options: OrganizationFeedOptions =
      limitRaw !== null ? { limit: Number(limitRaw) } : {};
    try {
      validateOrganizationFeedArgs(options);
    } catch (cause) {
      if (cause instanceof ApiError) {
        return jsonResponse(
          { error: { code: cause.code, message: cause.message, details: cause.details } },
          422,
        );
      }
      throw cause;
    }
    return deriveOrganizationFeed(ORGANIZATIONS, ORGANIZATION_MEMBERS, PROJECTS, REFERENCE_NOW, options);
  }

  // Authoritative organization/membership stats are derived from the auth store
  // on every call; reproduce the router's 422 validation and the repository
  // derivation over the shared seeds so live and mock agree exactly. An unknown
  // (well-formed) org yields a zero-filled snapshot, never a 404.
  if (path === "/orgs/stats") {
    const org = params.get("org_id") ?? undefined;
    const options = org ? { orgId: org } : {};
    try {
      validateOrganizationStatsArgs(options);
    } catch (cause) {
      if (cause instanceof ApiError) {
        return jsonResponse(
          { error: { code: cause.code, message: cause.message, details: cause.details } },
          422,
        );
      }
      throw cause;
    }
    return deriveOrganizationStats(
      ORGANIZATIONS,
      ORGANIZATION_MEMBERS,
      USERS,
      REFERENCE_NOW,
      options,
    );
  }

  // Authoritative production-pipeline stats are derived from the three chain
  // stores on every call; reproduce the router's 422 validation, unknown-project
  // 404 and the repository derivation over the shared chain seeds so live and
  // mock agree exactly.
  if (path === "/pipelines/stats") {
    const projectId = params.get("project_id") ?? undefined;
    const options = projectId ? { projectId } : {};
    try {
      validatePipelineStatsArgs(options);
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
    return derivePipelineStats(PIPELINE_CHAINS, REFERENCE_NOW, options);
  }

  // Authoritative asset lineage feed derives the same newest-first typed
  // relationship view as the `/lineage/feed` endpoint from the shared
  // relationship/asset/project seeds; mirror its 422 validation, unknown-project
  // 404, page bound and repository derivation so live and mock agree exactly.
  if (path === "/lineage/feed") {
    const projectId = params.get("project_id") ?? undefined;
    const limitRaw = params.get("limit");
    const options: LineageFeedOptions = {
      ...(projectId ? { projectId } : {}),
      ...(limitRaw !== null ? { limit: Number(limitRaw) } : {}),
    };
    try {
      validateLineageFeedArgs(options);
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
    return deriveLineageFeed(ASSET_RELATIONSHIPS, ASSETS, PROJECTS, REFERENCE_NOW, options);
  }

  // Authoritative asset-lineage stats are derived from the relationship + asset
  // stores on every call; reproduce the router's 422 validation, unknown-project
  // 404 and the repository derivation over the shared seeds so live and mock
  // agree exactly.
  if (path === "/lineage/stats") {
    const projectId = params.get("project_id") ?? undefined;
    const options = projectId ? { projectId } : {};
    try {
      validateLineageStatsArgs(options);
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
    return deriveLineageStats(ASSET_RELATIONSHIPS, ASSETS, REFERENCE_NOW, options);
  }

  // Authoritative collaboration stats are derived from the presence + comment
  // stores on every call; reproduce the router's 422 validation, unknown-project
  // 404 and the repository derivation over the shared seeds so live and mock
  // agree exactly.
  if (path === "/collaboration/stats") {
    const projectId = params.get("project_id") ?? undefined;
    const options = projectId ? { projectId } : {};
    try {
      validateCollaborationStatsArgs(options);
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
    return deriveCollaborationStats(PRESENCE, COMMENTS, REFERENCE_NOW, options);
  }

  // Authoritative orchestration stats are derived from the plan + run stores
  // on every call; runs join back to their plan for project attribution. Mirror
  // the router's 422 validation, unknown-project 404 and repository derivation
  // over the shared seeds so live and mock agree exactly.
  if (path === "/orchestration/stats") {
    const projectId = params.get("project_id") ?? undefined;
    const options = projectId ? { projectId } : {};
    try {
      validateOrchestrationStatsArgs(options);
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
    return deriveOrchestrationStats(
      ORCHESTRATION_PLANS,
      ORCHESTRATION_RUNS,
      REFERENCE_NOW,
      options,
    );
  }

  if (path === "/auth/me") return CURRENT_USER;
  if (path === "/orgs") return ORGANIZATIONS;
  if (path.startsWith("/orchestration/runs/")) {
    return ORCHESTRATION_RUNS.find((r) => r.run_id === id) ?? NOT_FOUND;
  }
  if (path === "/presence") {
    return PRESENCE.filter((p) => p.project_id === params.get("project_id"));
  }
  // Authoritative comment statistics derive the same snapshot as the
  // `/comments/stats` endpoint from the shared comment seeds; mirror its 422
  // validation, unknown-project 404 and repository derivation so live and mock
  // agree exactly. This must precede the `/comments/feed` and `/comments` branches.
  if (path === "/comments/stats") {
    const projectId = params.get("project_id") ?? undefined;
    const options = projectId ? { projectId } : {};
    try {
      validateCommentStatsArgs(options);
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
    return deriveCommentStats(COMMENTS, REFERENCE_NOW, options);
  }

  // Authoritative comment feed derives the same newest-first view as the
  // `/comments/feed` endpoint from the shared comment/project seeds; mirror its
  // 422 validation, unknown-project 404, page bound and repository derivation so
  // live and mock agree exactly. This must precede the `/comments` branch below.
  if (path === "/comments/feed") {
    const projectId = params.get("project_id") ?? undefined;
    const limitRaw = params.get("limit");
    const options: CommentFeedOptions = {
      ...(projectId ? { projectId } : {}),
      ...(limitRaw !== null ? { limit: Number(limitRaw) } : {}),
    };
    try {
      validateCommentFeedArgs(options);
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
    return deriveCommentFeed(COMMENTS, PROJECTS, REFERENCE_NOW, options);
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
  // Authoritative extension registry/installation stats are derived from the
  // extension store on every call; reproduce the router's 422 validation and
  // repository derivation over the shared seeds so live and mock agree. This
  // must precede the dynamic /extensions/{id} detail branch below.
  if (path === "/extensions/stats") {
    const typeRaw = params.get("type");
    const statusRaw = params.get("status");
    const options: ExtensionStatsOptions = {
      ...(typeRaw !== null ? { type: typeRaw as ExtensionStatsOptions["type"] } : {}),
      ...(statusRaw !== null ? { status: statusRaw as ExtensionStatsOptions["status"] } : {}),
    };
    try {
      validateExtensionStatsArgs(options);
    } catch (cause) {
      if (cause instanceof ApiError) {
        return jsonResponse(
          { error: { code: cause.code, message: cause.message, details: cause.details } },
          422,
        );
      }
      throw cause;
    }
    return deriveExtensionStats(EXTENSIONS, REFERENCE_NOW, options);
  }
  if (path === "/extensions/feed") {
    const typeRaw = params.get("type");
    const statusRaw = params.get("status");
    const limitRaw = params.get("limit");
    const options: ExtensionFeedOptions = {
      ...(typeRaw !== null ? { type: typeRaw as ExtensionFeedOptions["type"] } : {}),
      ...(statusRaw !== null ? { status: statusRaw as ExtensionFeedOptions["status"] } : {}),
      ...(limitRaw !== null ? { limit: Number(limitRaw) } : {}),
    };
    try {
      validateExtensionFeedArgs(options);
    } catch (cause) {
      if (cause instanceof ApiError) {
        return jsonResponse(
          { error: { code: cause.code, message: cause.message, details: cause.details } },
          422,
        );
      }
      throw cause;
    }
    return deriveExtensionFeed(EXTENSIONS, REFERENCE_NOW, options);
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
const orgId = PROJECTS[0]?.org_id ?? "";
const emptyId = PROJECTS.find((p) => p.name.startsWith("Blank Slate"))?.id ?? "";
const failedJobId = JOBS.find((j) => j.status === "failed")?.id ?? "";
const conversationId = CONVERSATIONS.find((c) => c.project_id === filmId)?.id ?? "";
/** A project with no seeded conversations, so the feed scope is genuinely empty. */
const noConversationsId = PROJECTS.find((p) => p.name.startsWith("Northlight"))?.id ?? "";
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
      ["getActivityStats", (api) => api.getActivityStats()],
      ["getActivityStats scoped", (api) => api.getActivityStats({ projectId: filmId })],
      ["getActivity scoped", (api) => api.getActivity({ projectId: filmId })],
      ["getActivity filtered", (api) => api.getActivity({ projectId: filmId, kind: "job", limit: 3 })],
      ["getDashboard", (api) => api.getDashboard()],
      ["getDashboard limited", (api) => api.getDashboard({ recentLimit: 3 })],
      ["getJobStats", (api) => api.getJobStats()],
      ["getJobStats scoped", (api) => api.getJobStats({ projectId: filmId })],
      ["getJobQueue", (api) => api.getJobQueue()],
      ["getJobQueue scoped", (api) => api.getJobQueue({ projectId: filmId })],
      ["getJobQueue limited", (api) => api.getJobQueue({ limit: 3 })],
      ["getJobQueue scoped and limited", (api) => api.getJobQueue({ projectId: filmId, limit: 2 })],
      ["getJobFeed", (api) => api.getJobFeed()],
      ["getJobFeed scoped", (api) => api.getJobFeed({ projectId: filmId })],
      ["getJobFeed filtered", (api) => api.getJobFeed({ status: "running" })],
      ["getJobFeed limited", (api) => api.getJobFeed({ limit: 2 })],
      [
        "getJobFeed scoped, filtered and limited",
        (api) => api.getJobFeed({ projectId: filmId, status: "running", limit: 1 }),
      ],
      ["getAssetStats", (api) => api.getAssetStats()],
      ["getAssetStats scoped", (api) => api.getAssetStats({ projectId: filmId })],
      ["getAssetFeed", (api) => api.getAssetFeed()],
      ["getAssetFeed scoped", (api) => api.getAssetFeed({ projectId: filmId })],
      ["getAssetFeed limited", (api) => api.getAssetFeed({ limit: 2 })],
      ["getAssetFeed scoped and limited", (api) => api.getAssetFeed({ projectId: filmId, limit: 1 })],
      ["getConversationStats", (api) => api.getConversationStats()],
      ["getConversationStats scoped", (api) => api.getConversationStats({ projectId: filmId })],
      ["getConversationFeed", (api) => api.getConversationFeed()],
      ["getConversationFeed scoped", (api) => api.getConversationFeed({ projectId: filmId })],
      ["getConversationFeed limited", (api) => api.getConversationFeed({ limit: 2 })],
      [
        "getConversationFeed scoped and limited",
        (api) => api.getConversationFeed({ projectId: filmId, limit: 1 }),
      ],
      ["getCommentFeed", (api) => api.getCommentFeed()],
      ["getCommentFeed scoped", (api) => api.getCommentFeed({ projectId: filmId })],
      ["getCommentFeed limited", (api) => api.getCommentFeed({ limit: 2 })],
      [
        "getCommentFeed scoped and limited",
        (api) => api.getCommentFeed({ projectId: filmId, limit: 1 }),
      ],
      ["getCommentStats", (api) => api.getCommentStats()],
      ["getCommentStats scoped", (api) => api.getCommentStats({ projectId: filmId })],
      ["getProjectStats", (api) => api.getProjectStats()],
      ["getProjectStats scoped", (api) => api.getProjectStats({ orgId })],
      ["getProjectFeed", (api) => api.getProjectFeed()],
      ["getProjectFeed scoped", (api) => api.getProjectFeed({ orgId })],
      ["getProjectFeed filtered", (api) => api.getProjectFeed({ lifecycle: "archived" })],
      ["getProjectFeed limited", (api) => api.getProjectFeed({ limit: 2 })],
      [
        "getProjectFeed scoped, filtered and limited",
        (api) => api.getProjectFeed({ orgId, lifecycle: "active", limit: 1 }),
      ],
      ["getProviderStats", (api) => api.getProviderStats()],
      ["getProviderStats scoped", (api) => api.getProviderStats({ location: "cloud" })],
      ["getProviderStats filtered", (api) => api.getProviderStats({ location: "cloud", status: "degraded" })],
      ["getExtensionStats", (api) => api.getExtensionStats()],
      ["getExtensionStats scoped", (api) => api.getExtensionStats({ type: "ui" })],
      ["getExtensionStats filtered", (api) => api.getExtensionStats({ type: "ui", status: "enabled" })],
      ["getExtensionFeed", (api) => api.getExtensionFeed()],
      ["getExtensionFeed scoped", (api) => api.getExtensionFeed({ type: "provider" })],
      ["getExtensionFeed filtered", (api) => api.getExtensionFeed({ status: "enabled" })],
      ["getExtensionFeed limited", (api) => api.getExtensionFeed({ limit: 2 })],
      [
        "getExtensionFeed filtered and limited",
        (api) => api.getExtensionFeed({ type: "ui", status: "disabled", limit: 1 }),
      ],
      ["getOrganizationFeed", (api) => api.getOrganizationFeed()],
      ["getOrganizationFeed limited", (api) => api.getOrganizationFeed({ limit: 1 })],
      ["getOrganizationStats", (api) => api.getOrganizationStats()],
      ["getOrganizationStats scoped", (api) => api.getOrganizationStats({ orgId })],
      ["getOrganizationStats unknown", (api) => api.getOrganizationStats({ orgId: "00000000-0000-4000-8000-000000000000" })],
      ["getPipelineStats", (api) => api.getPipelineStats()],
      ["getPipelineStats scoped", (api) => api.getPipelineStats({ projectId: filmId })],
      ["getLineageStats", (api) => api.getLineageStats()],
      ["getLineageStats scoped", (api) => api.getLineageStats({ projectId: filmId })],
      ["getLineageFeed", (api) => api.getLineageFeed()],
      ["getLineageFeed scoped", (api) => api.getLineageFeed({ projectId: filmId })],
      ["getLineageFeed limited", (api) => api.getLineageFeed({ limit: 2 })],
      [
        "getLineageFeed scoped and limited",
        (api) => api.getLineageFeed({ projectId: filmId, limit: 1 }),
      ],
      ["getCollaborationStats", (api) => api.getCollaborationStats()],
      ["getCollaborationStats scoped", (api) => api.getCollaborationStats({ projectId: filmId })],
      ["getOrchestrationStats", (api) => api.getOrchestrationStats()],
      ["getOrchestrationStats scoped", (api) => api.getOrchestrationStats({ projectId: filmId })],
      ["listProjects", (api) => api.listProjects()],
      ["getProject", (api) => api.getProject(filmId)],
      ["listAssets", (api) => api.listAssets()],
      ["getAsset", (api) => api.getAsset(ASSETS[0]?.id ?? "")],
      ["listRecentAssets", (api) => api.listRecentAssets(6)],
      ["listAssetsByProject", (api) => api.listAssetsByProject(filmId)],
      ["listJobs", (api) => api.listJobs()],
      ["listJobsByProject", (api) => api.listJobsByProject(filmId)],
      ["getJob", (api) => api.getJob(failedJobId)],
      ["getJobLogs", (api) => api.getJobLogs(failedJobId)],
      ["getJobLogs filtered", (api) => api.getJobLogs(failedJobId, { level: "error" })],
      ["getJobLogs paged", (api) => api.getJobLogs(failedJobId, { sinceSeq: 1, limit: 2 })],
      ["getProjectDetail", (api) => api.getProjectDetail(filmId)],
      ["getProjectAudit", (api) => api.getProjectAudit(filmId)],
      ["listProviders", (api) => api.listProviders()],
      ["getProvider", (api) => api.getProvider("prov_local")],
      ["listWorkflowTemplates", (api) => api.listWorkflowTemplates()],
      ["getOperations", (api) => api.getOperations()],
      ["getOperationStats", (api) => api.getOperationStats()],
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
      ["getSearchStats", (api) => api.getSearchStats()],
      ["getSearchStats scoped", (api) => api.getSearchStats({ projectId: filmId })],
      ["getUploadStats", (api) => api.getUploadStats()],
      ["getUploadStats scoped", (api) => api.getUploadStats({ projectId: filmId })],
      ["getUploadFeed", (api) => api.getUploadFeed()],
      ["getUploadFeed scoped", (api) => api.getUploadFeed({ projectId: filmId })],
      ["getUploadFeed limited", (api) => api.getUploadFeed({ limit: 3 })],
      [
        "getUploadFeed scoped and limited",
        (api) => api.getUploadFeed({ projectId: filmId, limit: 2 }),
      ],
      ["getEventStats", (api) => api.getEventStats()],
      ["getEventStats scoped", (api) => api.getEventStats({ projectId: filmId })],
      ["getEventFeed", (api) => api.getEventFeed()],
      ["getEventFeed scoped", (api) => api.getEventFeed({ projectId: filmId })],
      ["getEventFeed filtered", (api) => api.getEventFeed({ type: "progress" })],
      ["getEventFeed limited", (api) => api.getEventFeed({ limit: 2 })],
      [
        "getEventFeed scoped, filtered and limited",
        (api) => api.getEventFeed({ projectId: filmId, type: "progress", limit: 1 }),
      ],
      ["getRetryStats", (api) => api.getRetryStats()],
      ["getRetryStats scoped", (api) => api.getRetryStats({ projectId: filmId })],
      ["getVersionStats", (api) => api.getVersionStats()],
      ["getVersionStats scoped", (api) => api.getVersionStats({ projectId: filmId })],
      ["getVersionFeed", (api) => api.getVersionFeed()],
      ["getVersionFeed scoped", (api) => api.getVersionFeed({ projectId: filmId })],
      ["getVersionFeed limited", (api) => api.getVersionFeed({ limit: 2 })],
      [
        "getVersionFeed scoped and limited",
        (api) => api.getVersionFeed({ projectId: filmId, limit: 1 }),
      ],
      ["getPublishStats", (api) => api.getPublishStats()],
      ["getPublishStats scoped", (api) => api.getPublishStats({ projectId: filmId })],
      ["getPublishFeed", (api) => api.getPublishFeed()],
      ["getPublishFeed scoped", (api) => api.getPublishFeed({ projectId: filmId })],
      ["getPublishFeed limited", (api) => api.getPublishFeed({ limit: 3 })],
      [
        "getPublishFeed scoped and limited",
        (api) => api.getPublishFeed({ projectId: filmId, limit: 2 }),
      ],
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
  }, 45_000);

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
    expect(await live.getJobQueue({ projectId: emptyId })).toEqual(
      await mockApiClient.getJobQueue({ projectId: emptyId }),
    );
    expect(await live.getAssetStats({ projectId: emptyId })).toEqual(
      await mockApiClient.getAssetStats({ projectId: emptyId }),
    );
    expect(await live.getAssetFeed({ projectId: emptyId })).toEqual(
      await mockApiClient.getAssetFeed({ projectId: emptyId }),
    );
    expect(await live.getConversationStats({ projectId: emptyId })).toEqual(
      await mockApiClient.getConversationStats({ projectId: emptyId }),
    );
    expect(await live.getPipelineStats({ projectId: emptyId })).toEqual(
      await mockApiClient.getPipelineStats({ projectId: emptyId }),
    );
    expect(await live.getLineageStats({ projectId: emptyId })).toEqual(
      await mockApiClient.getLineageStats({ projectId: emptyId }),
    );
    expect(await live.getLineageFeed({ projectId: emptyId })).toEqual(
      await mockApiClient.getLineageFeed({ projectId: emptyId }),
    );
    expect(await live.getCollaborationStats({ projectId: emptyId })).toEqual(
      await mockApiClient.getCollaborationStats({ projectId: emptyId }),
    );
    expect(await live.getOrchestrationStats({ projectId: emptyId })).toEqual(
      await mockApiClient.getOrchestrationStats({ projectId: emptyId }),
    );
    expect(await live.listConversations(emptyId)).toEqual(
      await mockApiClient.listConversations(emptyId),
    );
    expect(await live.getConversationFeed({ projectId: noConversationsId })).toEqual(
      await mockApiClient.getConversationFeed({ projectId: noConversationsId }),
    );
    expect(await live.getCommentFeed({ projectId: emptyId })).toEqual(
      await mockApiClient.getCommentFeed({ projectId: emptyId }),
    );
    expect(await live.getCommentStats({ projectId: emptyId })).toEqual(
      await mockApiClient.getCommentStats({ projectId: emptyId }),
    );
    expect(await live.getActivity({ projectId: emptyId })).toEqual(
      await mockApiClient.getActivity({ projectId: emptyId }),
    );
    expect(await live.getActivityStats({ projectId: emptyId })).toEqual(
      await mockApiClient.getActivityStats({ projectId: emptyId }),
    );
    expect(await live.getSearchStats({ projectId: emptyId })).toEqual(
      await mockApiClient.getSearchStats({ projectId: emptyId }),
    );
    expect(await live.getUploadStats({ projectId: emptyId })).toEqual(
      await mockApiClient.getUploadStats({ projectId: emptyId }),
    );
    expect(await live.getUploadFeed({ projectId: emptyId })).toEqual(
      await mockApiClient.getUploadFeed({ projectId: emptyId }),
    );
    expect(await live.getEventStats({ projectId: emptyId })).toEqual(
      await mockApiClient.getEventStats({ projectId: emptyId }),
    );
    expect(await live.getEventFeed({ projectId: emptyId })).toEqual(
      await mockApiClient.getEventFeed({ projectId: emptyId }),
    );
    expect(await live.getRetryStats({ projectId: emptyId })).toEqual(
      await mockApiClient.getRetryStats({ projectId: emptyId }),
    );
    expect(await live.getVersionStats({ projectId: emptyId })).toEqual(
      await mockApiClient.getVersionStats({ projectId: emptyId }),
    );
    expect(await live.getVersionFeed({ projectId: emptyId })).toEqual(
      await mockApiClient.getVersionFeed({ projectId: emptyId }),
    );
    expect(await live.getPublishStats({ projectId: emptyId })).toEqual(
      await mockApiClient.getPublishStats({ projectId: emptyId }),
    );
    expect(await live.getPublishFeed({ projectId: emptyId })).toEqual(
      await mockApiClient.getPublishFeed({ projectId: emptyId }),
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
    // Both resolve a job log for an unknown job to undefined and reject
    // malformed ids / out-of-range filters with the same 422 envelope.
    expect(await live.getJobLogs(missingId)).toBeUndefined();
    expect(await mockApiClient.getJobLogs(missingId)).toBeUndefined();
    const [mockLogs422, liveLogs422] = await Promise.all([
      mockApiClient.getJobLogs(failedJobId, { limit: 0 }).catch((cause) => cause),
      live.getJobLogs(failedJobId, { limit: 0 }).catch((cause) => cause),
    ]);
    expect(mockLogs422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveLogs422).toMatchObject({ status: 422, code: "validation_error" });
    const [mockLogId422, liveLogId422] = await Promise.all([
      mockApiClient.getJobLogs("not-a-uuid").catch((cause) => cause),
      live.getJobLogs("not-a-uuid").catch((cause) => cause),
    ]);
    expect(mockLogId422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveLogId422).toMatchObject({ status: 422, code: "validation_error" });

    // Both transports 404 identically for an unknown dispatch-queue project
    // scope and reject a malformed id / out-of-range limit with the same 422.
    const [mockQueue404, liveQueue404] = await Promise.all([
      mockApiClient.getJobQueue({ projectId: missingId }).catch((cause) => cause),
      live.getJobQueue({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockQueue404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveQueue404).toMatchObject({ status: 404, code: "not_found" });
    for (const bad of [{ projectId: "not-a-uuid" }, { limit: 0 }, { limit: 201 }]) {
      const [mockQueue422, liveQueue422] = await Promise.all([
        mockApiClient.getJobQueue(bad).catch((cause) => cause),
        live.getJobQueue(bad).catch((cause) => cause),
      ]);
      expect(mockQueue422).toMatchObject({ status: 422, code: "validation_error" });
      expect(liveQueue422).toMatchObject({ status: 422, code: "validation_error" });
    }
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

    // Both transports 404 identically for an unknown activity-stats project
    // scope and reject a malformed project id with the same 422 envelope.
    const [mockActivityStats404, liveActivityStats404] = await Promise.all([
      mockApiClient.getActivityStats({ projectId: missingId }).catch((cause) => cause),
      live.getActivityStats({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockActivityStats404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveActivityStats404).toMatchObject({ status: 404, code: "not_found" });
    const [mockActivityStats422, liveActivityStats422] = await Promise.all([
      mockApiClient.getActivityStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
      live.getActivityStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
    ]);
    expect(mockActivityStats422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveActivityStats422).toMatchObject({ status: 422, code: "validation_error" });

    // Both transports 404 identically for an unknown search-stats project scope
    // and reject a malformed project id with the same 422 envelope.
    const [mockSearchStats404, liveSearchStats404] = await Promise.all([
      mockApiClient.getSearchStats({ projectId: missingId }).catch((cause) => cause),
      live.getSearchStats({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockSearchStats404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveSearchStats404).toMatchObject({ status: 404, code: "not_found" });
    const [mockSearchStats422, liveSearchStats422] = await Promise.all([
      mockApiClient.getSearchStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
      live.getSearchStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
    ]);
    expect(mockSearchStats422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveSearchStats422).toMatchObject({ status: 422, code: "validation_error" });

    // Both transports 404 identically for an unknown upload-stats project scope
    // and reject a malformed project id with the same 422 envelope.
    const [mockUploadStats404, liveUploadStats404] = await Promise.all([
      mockApiClient.getUploadStats({ projectId: missingId }).catch((cause) => cause),
      live.getUploadStats({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockUploadStats404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveUploadStats404).toMatchObject({ status: 404, code: "not_found" });
    const [mockUploadStats422, liveUploadStats422] = await Promise.all([
      mockApiClient.getUploadStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
      live.getUploadStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
    ]);
    expect(mockUploadStats422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveUploadStats422).toMatchObject({ status: 422, code: "validation_error" });

    // Both transports 404 identically for an unknown upload-feed project scope
    // and reject a malformed id / out-of-range limit with the same 422 envelope.
    const [mockUploadFeed404, liveUploadFeed404] = await Promise.all([
      mockApiClient.getUploadFeed({ projectId: missingId }).catch((cause) => cause),
      live.getUploadFeed({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockUploadFeed404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveUploadFeed404).toMatchObject({ status: 404, code: "not_found" });
    for (const bad of [{ projectId: "not-a-uuid" }, { limit: 0 }, { limit: 201 }]) {
      const [mockUploadFeed422, liveUploadFeed422] = await Promise.all([
        mockApiClient.getUploadFeed(bad).catch((cause) => cause),
        live.getUploadFeed(bad).catch((cause) => cause),
      ]);
      expect(mockUploadFeed422).toMatchObject({ status: 422, code: "validation_error" });
      expect(liveUploadFeed422).toMatchObject({ status: 422, code: "validation_error" });
    }

    // Both transports 404 identically for an unknown conversation-feed project
    // scope and reject a malformed id / out-of-range limit with the same 422.
    const [mockConversationFeed404, liveConversationFeed404] = await Promise.all([
      mockApiClient.getConversationFeed({ projectId: missingId }).catch((cause) => cause),
      live.getConversationFeed({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockConversationFeed404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveConversationFeed404).toMatchObject({ status: 404, code: "not_found" });
    for (const bad of [{ projectId: "not-a-uuid" }, { limit: 0 }, { limit: 201 }]) {
      const [mockConversationFeed422, liveConversationFeed422] = await Promise.all([
        mockApiClient.getConversationFeed(bad).catch((cause) => cause),
        live.getConversationFeed(bad).catch((cause) => cause),
      ]);
      expect(mockConversationFeed422).toMatchObject({ status: 422, code: "validation_error" });
      expect(liveConversationFeed422).toMatchObject({ status: 422, code: "validation_error" });
    }

    // Both transports 404 identically for an unknown comment-feed project scope
    // and reject a malformed id / out-of-range limit with the same 422 envelope.
    const [mockCommentFeed404, liveCommentFeed404] = await Promise.all([
      mockApiClient.getCommentFeed({ projectId: missingId }).catch((cause) => cause),
      live.getCommentFeed({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockCommentFeed404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveCommentFeed404).toMatchObject({ status: 404, code: "not_found" });
    for (const bad of [{ projectId: "not-a-uuid" }, { limit: 0 }, { limit: 201 }]) {
      const [mockCommentFeed422, liveCommentFeed422] = await Promise.all([
        mockApiClient.getCommentFeed(bad).catch((cause) => cause),
        live.getCommentFeed(bad).catch((cause) => cause),
      ]);
      expect(mockCommentFeed422).toMatchObject({ status: 422, code: "validation_error" });
      expect(liveCommentFeed422).toMatchObject({ status: 422, code: "validation_error" });
    }

    // Both transports 404 identically for an unknown comment-stats project
    // scope and reject a malformed project id with the same 422 envelope.
    const [mockCommentStats404, liveCommentStats404] = await Promise.all([
      mockApiClient.getCommentStats({ projectId: missingId }).catch((cause) => cause),
      live.getCommentStats({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockCommentStats404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveCommentStats404).toMatchObject({ status: 404, code: "not_found" });
    const [mockCommentStats422, liveCommentStats422] = await Promise.all([
      mockApiClient.getCommentStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
      live.getCommentStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
    ]);
    expect(mockCommentStats422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveCommentStats422).toMatchObject({ status: 422, code: "validation_error" });

    // Both transports 404 identically for an unknown event-stats project scope
    // and reject a malformed project id with the same 422 envelope.
    const [mockEventStats404, liveEventStats404] = await Promise.all([
      mockApiClient.getEventStats({ projectId: missingId }).catch((cause) => cause),
      live.getEventStats({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockEventStats404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveEventStats404).toMatchObject({ status: 404, code: "not_found" });
    const [mockEventStats422, liveEventStats422] = await Promise.all([
      mockApiClient.getEventStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
      live.getEventStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
    ]);
    expect(mockEventStats422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveEventStats422).toMatchObject({ status: 422, code: "validation_error" });

    // Both transports 404 identically for an unknown event-feed project scope
    // and reject a malformed project id / unknown type / invalid limit with the
    // same 422 envelope.
    const [mockEventFeed404, liveEventFeed404] = await Promise.all([
      mockApiClient.getEventFeed({ projectId: missingId }).catch((cause) => cause),
      live.getEventFeed({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockEventFeed404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveEventFeed404).toMatchObject({ status: 404, code: "not_found" });
    const badEventFeedOptions = [
      { projectId: "not-a-uuid" },
      { type: "bogus" as never },
      { limit: 0 },
    ];
    for (const bad of badEventFeedOptions) {
      const [mockErr, liveErr] = await Promise.all([
        mockApiClient.getEventFeed(bad).catch((cause) => cause),
        live.getEventFeed(bad).catch((cause) => cause),
      ]);
      expect(mockErr).toMatchObject({ status: 422, code: "validation_error" });
      expect(liveErr).toMatchObject({ status: 422, code: "validation_error" });
    }

    // Both transports 404 identically for an unknown retry-stats project scope
    // and reject a malformed project id with the same 422 envelope.
    const [mockRetryStats404, liveRetryStats404] = await Promise.all([
      mockApiClient.getRetryStats({ projectId: missingId }).catch((cause) => cause),
      live.getRetryStats({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockRetryStats404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveRetryStats404).toMatchObject({ status: 404, code: "not_found" });
    const [mockRetryStats422, liveRetryStats422] = await Promise.all([
      mockApiClient.getRetryStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
      live.getRetryStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
    ]);
    expect(mockRetryStats422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveRetryStats422).toMatchObject({ status: 422, code: "validation_error" });

    // Both transports 404 identically for an unknown version-stats project scope
    // and reject a malformed project id with the same 422 envelope.
    const [mockVersionStats404, liveVersionStats404] = await Promise.all([
      mockApiClient.getVersionStats({ projectId: missingId }).catch((cause) => cause),
      live.getVersionStats({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockVersionStats404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveVersionStats404).toMatchObject({ status: 404, code: "not_found" });
    const [mockVersionStats422, liveVersionStats422] = await Promise.all([
      mockApiClient.getVersionStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
      live.getVersionStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
    ]);
    expect(mockVersionStats422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveVersionStats422).toMatchObject({ status: 422, code: "validation_error" });

    // Both transports 404 identically for an unknown version-feed project scope
    // and reject a malformed id / out-of-range limit with the same 422 envelope.
    const [mockVersionFeed404, liveVersionFeed404] = await Promise.all([
      mockApiClient.getVersionFeed({ projectId: missingId }).catch((cause) => cause),
      live.getVersionFeed({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockVersionFeed404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveVersionFeed404).toMatchObject({ status: 404, code: "not_found" });
    for (const bad of [{ projectId: "not-a-uuid" }, { limit: 0 }, { limit: 201 }]) {
      const [mockVersionFeed422, liveVersionFeed422] = await Promise.all([
        mockApiClient.getVersionFeed(bad).catch((cause) => cause),
        live.getVersionFeed(bad).catch((cause) => cause),
      ]);
      expect(mockVersionFeed422).toMatchObject({ status: 422, code: "validation_error" });
      expect(liveVersionFeed422).toMatchObject({ status: 422, code: "validation_error" });
    }

    // Both transports 404 identically for an unknown publish-stats project scope
    // and reject a malformed project id with the same 422 envelope.
    const [mockPublishStats404, livePublishStats404] = await Promise.all([
      mockApiClient.getPublishStats({ projectId: missingId }).catch((cause) => cause),
      live.getPublishStats({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockPublishStats404).toMatchObject({ status: 404, code: "not_found" });
    expect(livePublishStats404).toMatchObject({ status: 404, code: "not_found" });
    const [mockPublishStats422, livePublishStats422] = await Promise.all([
      mockApiClient.getPublishStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
      live.getPublishStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
    ]);
    expect(mockPublishStats422).toMatchObject({ status: 422, code: "validation_error" });
    expect(livePublishStats422).toMatchObject({ status: 422, code: "validation_error" });

    // Both transports 404 identically for an unknown publish-feed project scope
    // and reject a malformed id / out-of-range limit with the same 422 envelope.
    const [mockFeed404, liveFeed404] = await Promise.all([
      mockApiClient.getPublishFeed({ projectId: missingId }).catch((cause) => cause),
      live.getPublishFeed({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockFeed404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveFeed404).toMatchObject({ status: 404, code: "not_found" });
    for (const bad of [{ projectId: "not-a-uuid" }, { limit: 0 }, { limit: 201 }]) {
      const [mockFeed422, liveFeed422] = await Promise.all([
        mockApiClient.getPublishFeed(bad).catch((cause) => cause),
        live.getPublishFeed(bad).catch((cause) => cause),
      ]);
      expect(mockFeed422).toMatchObject({ status: 422, code: "validation_error" });
      expect(liveFeed422).toMatchObject({ status: 422, code: "validation_error" });
    }

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

    // Both transports 404 identically for an unknown asset-feed project scope
    // and reject a malformed id / out-of-range limit with the same 422 envelope.
    const [mockAssetFeed404, liveAssetFeed404] = await Promise.all([
      mockApiClient.getAssetFeed({ projectId: missingId }).catch((cause) => cause),
      live.getAssetFeed({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockAssetFeed404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveAssetFeed404).toMatchObject({ status: 404, code: "not_found" });
    for (const bad of [{ projectId: "not-a-uuid" }, { limit: 0 }, { limit: 201 }]) {
      const [mockAssetFeed422, liveAssetFeed422] = await Promise.all([
        mockApiClient.getAssetFeed(bad).catch((cause) => cause),
        live.getAssetFeed(bad).catch((cause) => cause),
      ]);
      expect(mockAssetFeed422).toMatchObject({ status: 422, code: "validation_error" });
      expect(liveAssetFeed422).toMatchObject({ status: 422, code: "validation_error" });
    }

    // Both transports 404 identically for an unknown job-feed project scope and
    // reject a malformed id, unknown status or out-of-range limit with the same
    // 422 envelope.
    const [mockJobFeed404, liveJobFeed404] = await Promise.all([
      mockApiClient.getJobFeed({ projectId: missingId }).catch((cause) => cause),
      live.getJobFeed({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockJobFeed404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveJobFeed404).toMatchObject({ status: 404, code: "not_found" });
    for (const bad of [
      { projectId: "not-a-uuid" },
      { status: "paused" as never },
      { limit: 0 },
      { limit: 201 },
    ]) {
      const [mockJobFeed422, liveJobFeed422] = await Promise.all([
        mockApiClient.getJobFeed(bad).catch((cause) => cause),
        live.getJobFeed(bad).catch((cause) => cause),
      ]);
      expect(mockJobFeed422).toMatchObject({ status: 422, code: "validation_error" });
      expect(liveJobFeed422).toMatchObject({ status: 422, code: "validation_error" });
    }

    // Both transports 404 identically for an unknown pipeline-stats project
    // scope and reject a malformed project id with the same 422 envelope.
    const [mockPipeStats404, livePipeStats404] = await Promise.all([
      mockApiClient.getPipelineStats({ projectId: missingId }).catch((cause) => cause),
      live.getPipelineStats({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockPipeStats404).toMatchObject({ status: 404, code: "not_found" });
    expect(livePipeStats404).toMatchObject({ status: 404, code: "not_found" });
    const [mockPipeStats422, livePipeStats422] = await Promise.all([
      mockApiClient.getPipelineStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
      live.getPipelineStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
    ]);
    expect(mockPipeStats422).toMatchObject({ status: 422, code: "validation_error" });
    expect(livePipeStats422).toMatchObject({ status: 422, code: "validation_error" });

    // Both transports 404 identically for an unknown lineage-stats project
    // scope and reject a malformed project id with the same 422 envelope.
    const [mockLineage404, liveLineage404] = await Promise.all([
      mockApiClient.getLineageStats({ projectId: missingId }).catch((cause) => cause),
      live.getLineageStats({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockLineage404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveLineage404).toMatchObject({ status: 404, code: "not_found" });
    const [mockLineage422, liveLineage422] = await Promise.all([
      mockApiClient.getLineageStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
      live.getLineageStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
    ]);
    expect(mockLineage422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveLineage422).toMatchObject({ status: 422, code: "validation_error" });

    // Both transports 404 identically for an unknown lineage-feed project scope
    // and reject a malformed project id / limit with the same 422 envelope.
    const [mockLineageFeed404, liveLineageFeed404] = await Promise.all([
      mockApiClient.getLineageFeed({ projectId: missingId }).catch((cause) => cause),
      live.getLineageFeed({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockLineageFeed404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveLineageFeed404).toMatchObject({ status: 404, code: "not_found" });
    for (const bad of [{ projectId: "not-a-uuid" }, { limit: 0 }, { limit: 201 }]) {
      const [mockLineageFeed422, liveLineageFeed422] = await Promise.all([
        mockApiClient.getLineageFeed(bad).catch((cause) => cause),
        live.getLineageFeed(bad).catch((cause) => cause),
      ]);
      expect(mockLineageFeed422).toMatchObject({ status: 422, code: "validation_error" });
      expect(liveLineageFeed422).toMatchObject({ status: 422, code: "validation_error" });
    }

    // Both transports 404 identically for an unknown collaboration-stats project
    // scope and reject a malformed project id with the same 422 envelope.
    const [mockCollab404, liveCollab404] = await Promise.all([
      mockApiClient.getCollaborationStats({ projectId: missingId }).catch((cause) => cause),
      live.getCollaborationStats({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockCollab404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveCollab404).toMatchObject({ status: 404, code: "not_found" });
    const [mockCollab422, liveCollab422] = await Promise.all([
      mockApiClient.getCollaborationStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
      live.getCollaborationStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
    ]);
    expect(mockCollab422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveCollab422).toMatchObject({ status: 422, code: "validation_error" });

    // Both transports 404 identically for an unknown orchestration-stats project
    // scope and reject a malformed project id with the same 422 envelope.
    const [mockOrch404, liveOrch404] = await Promise.all([
      mockApiClient.getOrchestrationStats({ projectId: missingId }).catch((cause) => cause),
      live.getOrchestrationStats({ projectId: missingId }).catch((cause) => cause),
    ]);
    expect(mockOrch404).toMatchObject({ status: 404, code: "not_found" });
    expect(liveOrch404).toMatchObject({ status: 404, code: "not_found" });
    const [mockOrch422, liveOrch422] = await Promise.all([
      mockApiClient.getOrchestrationStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
      live.getOrchestrationStats({ projectId: "not-a-uuid" }).catch((cause) => cause),
    ]);
    expect(mockOrch422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveOrch422).toMatchObject({ status: 422, code: "validation_error" });

    // Both transports zero-fill for an unknown (well-formed) org scope and
    // reject a malformed org id with the same 422 envelope.
    expect(await live.getProjectStats({ orgId: missingId })).toEqual(
      await mockApiClient.getProjectStats({ orgId: missingId }),
    );
    const [mockProjectStats422, liveProjectStats422] = await Promise.all([
      mockApiClient.getProjectStats({ orgId: "not-a-uuid" }).catch((cause) => cause),
      live.getProjectStats({ orgId: "not-a-uuid" }).catch((cause) => cause),
    ]);
    expect(mockProjectStats422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveProjectStats422).toMatchObject({ status: 422, code: "validation_error" });

    // Both transports zero-fill an unknown (well-formed) org scope for the
    // project feed and reject a malformed org id, invalid lifecycle or invalid
    // limit with the same 422 envelope.
    expect(await live.getProjectFeed({ orgId: missingId })).toEqual(
      await mockApiClient.getProjectFeed({ orgId: missingId }),
    );
    for (const bad of [
      { orgId: "not-a-uuid" },
      { lifecycle: "paused" as never },
      { limit: 0 },
      { limit: 201 },
    ]) {
      const [mockProjectFeed422, liveProjectFeed422] = await Promise.all([
        mockApiClient.getProjectFeed(bad).catch((cause) => cause),
        live.getProjectFeed(bad).catch((cause) => cause),
      ]);
      expect(mockProjectFeed422).toMatchObject({ status: 422, code: "validation_error" });
      expect(liveProjectFeed422).toMatchObject({ status: 422, code: "validation_error" });
    }

    // Both transports reject an out-of-range organization-feed limit with the
    // same 422 envelope.
    for (const bad of [{ limit: 0 }, { limit: 201 }]) {
      const [mockOrgFeed422, liveOrgFeed422] = await Promise.all([
        mockApiClient.getOrganizationFeed(bad).catch((cause) => cause),
        live.getOrganizationFeed(bad).catch((cause) => cause),
      ]);
      expect(mockOrgFeed422).toMatchObject({ status: 422, code: "validation_error" });
      expect(liveOrgFeed422).toMatchObject({ status: 422, code: "validation_error" });
    }

    // Both transports zero-fill an unknown (well-formed) org scope and reject a
    // malformed org id with the same 422 envelope.
    expect(await live.getOrganizationStats({ orgId: missingId })).toEqual(
      await mockApiClient.getOrganizationStats({ orgId: missingId }),
    );
    const [mockOrgStats422, liveOrgStats422] = await Promise.all([
      mockApiClient.getOrganizationStats({ orgId: "not-a-uuid" }).catch((cause) => cause),
      live.getOrganizationStats({ orgId: "not-a-uuid" }).catch((cause) => cause),
    ]);
    expect(mockOrgStats422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveOrgStats422).toMatchObject({ status: 422, code: "validation_error" });

    // Both zero-fill an empty provider-stats filter and reject invalid filters
    // with the same 422 envelope.
    expect(await live.getProviderStats({ location: "studio" })).toEqual(
      await mockApiClient.getProviderStats({ location: "studio" }),
    );
    const [mockProviderStats422, liveProviderStats422] = await Promise.all([
      mockApiClient.getProviderStats({ status: "busy" as never }).catch((cause) => cause),
      live.getProviderStats({ status: "busy" as never }).catch((cause) => cause),
    ]);
    expect(mockProviderStats422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveProviderStats422).toMatchObject({ status: 422, code: "validation_error" });

    // Both zero-fill an empty extension-stats filter and reject invalid filters
    // with the same 422 envelope.
    expect(await live.getExtensionStats({ type: "bundle" })).toEqual(
      await mockApiClient.getExtensionStats({ type: "bundle" }),
    );
    const [mockExtensionStats422, liveExtensionStats422] = await Promise.all([
      mockApiClient.getExtensionStats({ type: "mystery" as never }).catch((cause) => cause),
      live.getExtensionStats({ type: "mystery" as never }).catch((cause) => cause),
    ]);
    expect(mockExtensionStats422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveExtensionStats422).toMatchObject({ status: 422, code: "validation_error" });

    // Both narrow the extension feed to an empty page and reject invalid filters
    // and page bounds with the same 422 envelope.
    expect(await live.getExtensionFeed({ type: "bundle", status: "enabled" })).toEqual(
      await mockApiClient.getExtensionFeed({ type: "bundle", status: "enabled" }),
    );
    const [mockExtensionFeed422, liveExtensionFeed422] = await Promise.all([
      mockApiClient.getExtensionFeed({ limit: 0 }).catch((cause) => cause),
      live.getExtensionFeed({ limit: 0 }).catch((cause) => cause),
    ]);
    expect(mockExtensionFeed422).toMatchObject({ status: 422, code: "validation_error" });
    expect(liveExtensionFeed422).toMatchObject({ status: 422, code: "validation_error" });

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
  }, 45_000);

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
    expect(typeof typed.getActivityStats).toBe("function");
    expect(typeof typed.getDashboard).toBe("function");
    expect(typeof typed.getJobStats).toBe("function");
    expect(typeof typed.getJobFeed).toBe("function");
    expect(typeof typed.getJobLogs).toBe("function");
    expect(typeof typed.getJobQueue).toBe("function");
    expect(typeof typed.getAssetStats).toBe("function");
    expect(typeof typed.getAssetFeed).toBe("function");
    expect(typeof typed.getConversationStats).toBe("function");
    expect(typeof typed.getConversationFeed).toBe("function");
    expect(typeof typed.getCommentFeed).toBe("function");
    expect(typeof typed.getCommentStats).toBe("function");
    expect(typeof typed.updateAsset).toBe("function");
    expect(typeof typed.search).toBe("function");
    expect(typeof typed.getSearchStats).toBe("function");
    expect(typeof typed.getUploadStats).toBe("function");
    expect(typeof typed.getUploadFeed).toBe("function");
    expect(typeof typed.getEventStats).toBe("function");
    expect(typeof typed.getEventFeed).toBe("function");
    expect(typeof typed.getRetryStats).toBe("function");
    expect(typeof typed.getVersionStats).toBe("function");
    expect(typeof typed.getVersionFeed).toBe("function");
    expect(typeof typed.getPublishStats).toBe("function");
    expect(typeof typed.getPublishFeed).toBe("function");
    expect(typeof typed.getTags).toBe("function");
    expect(typeof typed.getAssetImpact).toBe("function");
    expect(typeof typed.getProjectStats).toBe("function");
    expect(typeof typed.getProjectFeed).toBe("function");
    expect(typeof typed.getProviderStats).toBe("function");
    expect(typeof typed.getExtensionStats).toBe("function");
    expect(typeof typed.getExtensionFeed).toBe("function");
    expect(typeof typed.getOrganizationFeed).toBe("function");
    expect(typeof typed.getOrganizationStats).toBe("function");
    expect(typeof typed.getPipelineStats).toBe("function");
    expect(typeof typed.getLineageStats).toBe("function");
    expect(typeof typed.getLineageFeed).toBe("function");
    expect(typeof typed.getCollaborationStats).toBe("function");
    expect(typeof typed.getOrchestrationStats).toBe("function");
    expect(typeof typed.getOperationStats).toBe("function");
  });
});

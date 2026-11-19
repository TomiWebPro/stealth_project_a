import { ApiError } from "../../api/client";
import { deriveActivityFeed, validateActivityArgs } from "../activity";
import type { ActivityOptions } from "../activity";
import { deriveActivityStats, validateActivityStatsArgs } from "../activityStats";
import type { ActivityStatsOptions } from "../activityStats";
import { deriveAssetFeed, validateAssetFeedArgs } from "../assetFeed";
import type { AssetFeedOptions } from "../assetFeed";
import { deriveAssetStats, validateAssetStatsArgs } from "../assetStats";
import type { AssetStatsOptions } from "../assetStats";
import { filterAuditTrail } from "../audit";
import type { AuditQuery } from "../audit";
import type { CapabilityMatch } from "../catalog";
import {
  deriveCollaborationFeed,
  validateCollaborationFeedArgs,
} from "../collaborationFeed";
import type { CollaborationFeedOptions } from "../collaborationFeed";
import {
  deriveCollaborationStats,
  validateCollaborationStatsArgs,
} from "../collaborationStats";
import type { CollaborationStatsOptions } from "../collaborationStats";
import { deriveCommentFeed, validateCommentFeedArgs } from "../commentFeed";
import type { CommentFeedOptions } from "../commentFeed";
import { deriveCommentStats, validateCommentStatsArgs } from "../commentStats";
import type { CommentStatsOptions } from "../commentStats";
import {
  deriveConversationFeed,
  validateConversationFeedArgs,
} from "../conversationFeed";
import type { ConversationFeedOptions } from "../conversationFeed";
import {
  deriveConversationStats,
  validateConversationStatsArgs,
} from "../conversationStats";
import type { ConversationStatsOptions } from "../conversationStats";
import type { ConversationStream } from "../conversationStream";
import { deriveDashboardSummary, validateDashboardArgs } from "../dashboard";
import type { DashboardOptions } from "../dashboard";
import { env } from "../env";
import { deriveEventFeed, validateEventFeedArgs } from "../eventFeed";
import type { EventFeedOptions } from "../eventFeed";
import { deriveEventStats, validateEventStatsArgs } from "../eventStats";
import type { EventStatsOptions } from "../eventStats";
import { deriveExtensionFeed, validateExtensionFeedArgs } from "../extensionFeed";
import type { ExtensionFeedOptions } from "../extensionFeed";
import {
  deriveExtensionStats,
  validateExtensionStatsArgs,
} from "../extensionStats";
import type { ExtensionStatsOptions } from "../extensionStats";
import type { HomeSummary } from "../homeSummary";
import { deriveLineageFeed, validateLineageFeedArgs } from "../lineageFeed";
import type { LineageFeedOptions } from "../lineageFeed";
import { deriveLineageStats, validateLineageStatsArgs } from "../lineageStats";
import type { LineageStatsOptions } from "../lineageStats";
import type { ImpactOptions } from "../impact";
import { deriveAssetImpact, validateImpactArgs } from "../impact";
import { deriveJobFeed, validateJobFeedArgs } from "../jobFeed";
import type { JobFeedOptions } from "../jobFeed";
import { deriveJobLogs, validateJobLogsArgs } from "../jobLogs";
import type { JobLogsOptions } from "../jobLogs";
import { deriveJobQueue, validateJobQueueArgs } from "../jobQueue";
import type { JobQueueOptions } from "../jobQueue";
import { deriveJobStats, validateJobStatsArgs } from "../jobStats";
import type { JobStatsOptions } from "../jobStats";
import { deriveOperationFeed, validateOperationFeedArgs } from "../operationFeed";
import type { OperationFeedOptions } from "../operationFeed";
import { deriveOperationStats } from "../operationStats";
import { deriveOrganizationFeed, validateOrganizationFeedArgs } from "../organizationFeed";
import type { OrganizationFeedOptions } from "../organizationFeed";
import {
  deriveOrganizationStats,
  validateOrganizationStatsArgs,
} from "../organizationStats";
import type { OrganizationStatsOptions } from "../organizationStats";
import {
  deriveOrchestrationFeed,
  validateOrchestrationFeedArgs,
} from "../orchestrationFeed";
import type { OrchestrationFeedOptions } from "../orchestrationFeed";
import {
  deriveOrchestrationStats,
  validateOrchestrationStatsArgs,
} from "../orchestrationStats";
import type { OrchestrationStatsOptions } from "../orchestrationStats";
import { derivePipelineFeed, validatePipelineFeedArgs } from "../pipelineFeed";
import type { PipelineFeedOptions } from "../pipelineFeed";
import {
  derivePipelineStats,
  validatePipelineStatsArgs,
} from "../pipelineStats";
import type { PipelineStatsOptions } from "../pipelineStats";
import type { ProjectDetail } from "../projectDetail";
import { deriveProjectFeed, validateProjectFeedArgs } from "../projectFeed";
import type { ProjectFeedOptions } from "../projectFeed";
import {
  deriveProjectOverview,
  validateProjectOverviewArgs,
} from "../projectOverview";
import type { ProjectOverviewOptions } from "../projectOverview";
import { deriveProjectStats, validateProjectStatsArgs } from "../projectStats";
import type { ProjectStatsOptions } from "../projectStats";
import { deriveProviderFeed, validateProviderFeedArgs } from "../providerFeed";
import type { ProviderFeedOptions } from "../providerFeed";
import { deriveProviderStats, validateProviderStatsArgs } from "../providerStats";
import type { ProviderStatsOptions } from "../providerStats";
import { derivePublishFeed, validatePublishFeedArgs } from "../publishFeed";
import type { PublishFeedOptions } from "../publishFeed";
import { derivePublishStats, validatePublishStatsArgs } from "../publishStats";
import type { PublishStatsOptions } from "../publishStats";
import { deriveRetryFeed, validateRetryFeedArgs } from "../retryFeed";
import type { RetryFeedOptions } from "../retryFeed";
import { deriveRetryStats, validateRetryStatsArgs } from "../retryStats";
import type { RetryStatsOptions } from "../retryStats";
import { deriveSearchResponse, validateSearchArgs } from "../search";
import type { SearchOptions } from "../search";
import { deriveSearchStats, validateSearchStatsArgs } from "../searchStats";
import type { SearchStatsOptions } from "../searchStats";
import { deriveTagIndex, validateTagArgs } from "../tags";
import type { TagOptions } from "../tags";
import { deriveUploadFeed, validateUploadFeedArgs } from "../uploadFeed";
import type { UploadFeedOptions } from "../uploadFeed";
import { deriveUploadStats, validateUploadStatsArgs } from "../uploadStats";
import type { UploadStatsOptions } from "../uploadStats";
import { deriveVersionFeed, validateVersionFeedArgs } from "../versionFeed";
import type { VersionFeedOptions } from "../versionFeed";
import { deriveVersionStats, validateVersionStatsArgs } from "../versionStats";
import type { VersionStatsOptions } from "../versionStats";
import type {
  Asset,
  AssetFeed,
  AssetImpact,
  AssetStats,
  AssetUpdate,
  ActivityStats,
  AuditTrail,
  CollaborationFeed,
  CollaborationStats,
  Comment,
  CommentFeed,
  CommentStats,
  Conversation,
  ConversationFeed,
  ConversationStats,
  EventFeed,
  EventStats,
  Extension,
  ExtensionFeed,
  ExtensionStats,
  Job,
  JobFeed,
  JobLogFrame,
  JobQueueView,
  JobStats,
  LineageFeed,
  LineageStats,
  Message,
  MessageCreate,
  OperationCatalog,
  OperationFeed,
  OperationStats,
  Organization,
  OrganizationFeed,
  OrganizationStats,
  OrchestrationFeed,
  OrchestrationRun,
  OrchestrationStats,
  PipelineFeed,
  PipelineStats,
  Presence,
  Project,
  ProjectFeed,
  ProjectOverview,
  ProjectStats,
  Provider,
  ProviderFeed,
  ProviderStats,
  PublishFeed,
  PublishStats,
  RetryFeed,
  RetryStats,
  SearchResponse,
  SearchStats,
  StorageStats,
  StreamEvent,
  TagIndex,
  UploadFeed,
  UploadStats,
  User,
  VersionFeed,
  VersionStats,
} from "../types";
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
} from "./data";

/**
 * Mock API transport.
 *
 * Simulates the stable application API so the frontend can be built before the
 * backend exists. Every function mirrors a future real endpoint on `src/api`
 * and returns the same typed payloads from `src/types`. Assembled view models
 * (`HomeSummary`, `ProjectDetail`) are built here so screens never map
 * backend payloads.
 */

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), env.mockLatencyMs);
  });
}

/**
 * Error-state fakes. Tests and screens can switch a domain into a failing
 * state so mock mode exercises the same error paths as live mode; `"*"` fails
 * every guarded query. Guarded domains: `home`, `dashboard`, `activity`,
 * `activityStats`, `jobStats`,
 * `assetStats`, `assetFeed`, `conversationStats`, `projectStats`, `projectFeed`, `providerStats`, `providerFeed`, `extensionStats`, `projects` (incl. detail/recent/by-project), `jobs`, `assets` (incl. detail,
 * templates and writes), `providers`, `audit`, `operations`, `capabilities`,
 * `conversations`, `conversationFeed`, `commentFeed`, `commentStats`, `messages` (incl. sends), `stream`, `auth` (user + orgs),
 * `orchestration`, `presence`, `comments`, `storage`, `extensions`, `search`,
 * `searchStats`, `uploadStats`, `uploadFeed`, `eventStats`, `eventFeed`, `retryStats`, `retryFeed`, `versionStats`, `versionFeed`, `publishStats`, `publishFeed`, `tags`, `impact`, `operationStats`, `operationFeed`, `organizationStats`, `organizationFeed`, `extensionStats`, `extensionFeed`, `pipelineStats`, `pipelineFeed`,
 * `lineageStats`, `lineageFeed`, `collaborationStats`, `collaborationFeed`, `orchestrationStats`, `orchestrationFeed`,
 * `projectOverview`, `jobLogs`, `jobFeed` and `jobQueue`.
 * Always reset with {@link clearMockFailures} afterwards.
 */
const activeFailures = new Set<string>();

export function setMockFailure(domain: string, enabled = true): void {
  if (enabled) activeFailures.add(domain);
  else activeFailures.delete(domain);
}

export function clearMockFailures(): void {
  activeFailures.clear();
}

function failIfEnabled(domain: string): void {
  if (!activeFailures.has(domain) && !activeFailures.has("*")) return;
  throw new ApiError({
    status: 503,
    code: "mock_failure",
    message: `Mock ${domain} query is configured to fail.`,
  });
}

/**
 * Messages written through the mock transport. Kept separate from the seed
 * arrays so the deterministic fixtures used by other queries and parity tests
 * are never mutated by a send.
 */
const sentMessages: Message[] = [];
let nextMessageSeq = 1;

/**
 * Asset patches are kept in an overlay instead of mutating the exported seeds
 * so every read (and the live-vs-mock parity guard) sees a pristine baseline.
 * Reads consult the overlay first; write tests reset it with `resetMockAssets`.
 */
const assetOverrides = new Map<string, Asset>();

function withAssetOverrides(asset: Asset): Asset {
  return assetOverrides.get(asset.id) ?? asset;
}

/** Clear mock asset writes, restoring the deterministic seed fixtures. */
export function resetMockAssets(): void {
  assetOverrides.clear();
}

function toSummary(): HomeSummary {
  const assets = ASSETS.map(withAssetOverrides);
  return {
    projects: PROJECTS.filter((project) => !project.archived).map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description ?? "",
      assetCount: assets.filter((asset) => asset.project_id === project.id).length,
      updatedAt: project.updated_at,
    })),
    recentAssets: [...assets]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 6),
    activeJobs: JOBS.filter(
      (candidate) => candidate.status === "queued" || candidate.status === "running",
    ).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    providers: PROVIDERS.map((provider) => ({
      id: provider.id,
      name: provider.name,
      status: provider.status,
      operations: (provider.capabilities ?? []).map((capability) => capability.operation_id),
    })),
  };
}

export async function fetchHomeSummary(): Promise<HomeSummary> {
  failIfEnabled("home");
  return delay(toSummary());
}

/**
 * Authoritative dashboard snapshot (C25) derived from the same authoritative
 * seeds as the live `/dashboard` endpoint. Router-style 422 validation and the
 * `"dashboard"` failure domain keep error and empty states at parity with live.
 */
export async function fetchDashboard(options?: DashboardOptions) {
  failIfEnabled("dashboard");
  validateDashboardArgs(options?.recentLimit);
  return delay(
    deriveDashboardSummary(
      {
        projects: PROJECTS,
        assets: ASSETS.map(withAssetOverrides),
        conversations: CONVERSATIONS,
        jobs: JOBS,
        providers: PROVIDERS,
        extensions: EXTENSIONS,
        now: REFERENCE_NOW,
      },
      options,
    ),
  );
}

/**
 * Authoritative job execution metrics (C40) derived from the same job seeds as
 * the live `/jobs/stats` endpoint. Router-style 422 validation, a 404 for an
 * unknown project scope and the `"jobStats"` failure domain keep error and empty
 * states at parity with live mode.
 */
export async function fetchJobStats(
  options?: JobStatsOptions,
): Promise<JobStats> {
  failIfEnabled("jobStats");
  validateJobStatsArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveJobStats(JOBS, REFERENCE_NOW, options));
}

/**
 * Authoritative asset inventory metrics (C49) derived from the same asset store
 * as the live `/assets/stats` endpoint. Router-style 422 validation, a 404 for an
 * unknown project scope and the `"assetStats"` failure domain keep error and empty
 * states at parity with live mode.
 */
export async function fetchAssetStats(
  options?: AssetStatsOptions,
): Promise<AssetStats> {
  failIfEnabled("assetStats");
  validateAssetStatsArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveAssetStats(ASSETS.map(withAssetOverrides), REFERENCE_NOW, options));
}

/**
 * Authoritative asset feed (C137) derived from the same asset store as the live
 * `/assets/feed` endpoint. Router-style 422 validation, a normalized 404 for an
 * unknown project scope and the `"assetFeed"` failure domain keep error and
 * empty states at parity.
 */
export async function fetchAssetFeed(options?: AssetFeedOptions): Promise<AssetFeed> {
  failIfEnabled("assetFeed");
  validateAssetFeedArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveAssetFeed(ASSETS, PROJECTS, REFERENCE_NOW, options));
}

/**
 * Authoritative conversation/message metrics (C45) derived from the same
 * conversation/message seeds as the live `/conversations/stats` endpoint.
 * Router-style 422 validation, a 404 for an unknown project scope and the
 * `"conversationStats"` failure domain keep error and empty states at parity
 * with live mode.
 */
export async function fetchConversationStats(
  options?: ConversationStatsOptions,
): Promise<ConversationStats> {
  failIfEnabled("conversationStats");
  validateConversationStatsArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveConversationStats(CONVERSATIONS, MESSAGES, REFERENCE_NOW, options));
}

/**
 * Authoritative conversation feed (C133) derived from the same conversation and
 * message stores as the live `/conversations/feed` endpoint. Router-style 422
 * validation, a normalized 404 for an unknown project scope and the
 * `"conversationFeed"` failure domain keep error and empty states at parity.
 */
export async function fetchConversationFeed(
  options?: ConversationFeedOptions,
): Promise<ConversationFeed> {
  failIfEnabled("conversationFeed");
  validateConversationFeedArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(
    deriveConversationFeed(CONVERSATIONS, MESSAGES, PROJECTS, REFERENCE_NOW, options),
  );
}

/**
 * Authoritative comment feed (C149) derived from the same comment/project seeds
 * as the live `/comments/feed` endpoint. Router-style 422 validation, a
 * normalized 404 for an unknown project scope and the `"commentFeed"` failure
 * domain keep error and empty states at parity.
 */
export async function fetchCommentFeed(options?: CommentFeedOptions): Promise<CommentFeed> {
  failIfEnabled("commentFeed");
  validateCommentFeedArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveCommentFeed(COMMENTS, PROJECTS, REFERENCE_NOW, options));
}

/**
 * Authoritative comment statistics (C165) derived from the same comment seeds
 * as the live `/comments/stats` endpoint. Router-style 422 validation for a
 * malformed project id, a normalized 404 for an unknown project scope and the
 * `"commentStats"` failure domain keep error and empty states at parity.
 */
export async function fetchCommentStats(
  options?: CommentStatsOptions,
): Promise<CommentStats> {
  failIfEnabled("commentStats");
  validateCommentStatsArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveCommentStats(COMMENTS, REFERENCE_NOW, options));
}

/**
 * Authoritative project portfolio metrics (C53) derived from the same
 * project/asset/conversation/job seeds as the live `/projects/stats` endpoint.
 * Router-style 422 validation for a malformed org id, a zero-filled snapshot
 * for an unknown (well-formed) org and the `"projectStats"` failure domain
 * keep error and empty states at parity with live mode.
 */
export async function fetchProjectStats(
  options?: ProjectStatsOptions,
): Promise<ProjectStats> {
  failIfEnabled("projectStats");
  validateProjectStatsArgs(options);
  return delay(
    deriveProjectStats(
      PROJECTS,
      ASSETS.map(withAssetOverrides),
      CONVERSATIONS,
      JOBS,
      REFERENCE_NOW,
      options,
    ),
  );
}

/**
 * Authoritative project feed (C145) derived from the same project/organization
 * stores as the live `/projects/feed` endpoint. Router-style 422 validation for
 * a malformed org id / invalid lifecycle / out-of-range limit, a zero-filled
 * feed for an unknown-but-valid org scope (matching `/projects?org_id=`) and the
 * `"projectFeed"` failure domain keep error and empty states at parity with live.
 */
export async function fetchProjectFeed(options?: ProjectFeedOptions): Promise<ProjectFeed> {
  failIfEnabled("projectFeed");
  validateProjectFeedArgs(options);
  return delay(deriveProjectFeed(PROJECTS, ORGANIZATIONS, REFERENCE_NOW, options));
}

/**
 * Authoritative provider fleet metrics (C57) derived from the same provider
 * seeds as the live `/providers/stats` endpoint. Router-style 422 validation for
 * an invalid location/status filter and the `"providerStats"` failure domain
 * keep error and empty states at parity with live mode.
 */
export async function fetchProviderStats(
  options?: ProviderStatsOptions,
): Promise<ProviderStats> {
  failIfEnabled("providerStats");
  validateProviderStatsArgs(options);
  return delay(deriveProviderStats(PROVIDERS, REFERENCE_NOW, options));
}

/**
 * Deterministic authoritative provider feed (C185) derived from the same
 * provider seeds as the live `/providers/feed` endpoint. Router-style 422
 * validation (location / status / limit) and the `"providerFeed"` failure domain
 * keep error and empty states at parity with live mode.
 */
export async function fetchProviderFeed(options?: ProviderFeedOptions): Promise<ProviderFeed> {
  failIfEnabled("providerFeed");
  validateProviderFeedArgs(options);
  return delay(deriveProviderFeed(PROVIDERS, REFERENCE_NOW, options));
}

/**
 * Authoritative extension registry/installation metrics (C61) derived from the
 * same extension seeds as the live `/extensions/stats` endpoint. Router-style
 * 422 validation for an invalid type/status filter and the `"extensionStats"`
 * failure domain keep error and empty states at parity with live mode.
 */
export async function fetchExtensionStats(
  options?: ExtensionStatsOptions,
): Promise<ExtensionStats> {
  failIfEnabled("extensionStats");
  validateExtensionStatsArgs(options);
  return delay(deriveExtensionStats(EXTENSIONS, REFERENCE_NOW, options));
}

/**
 * Authoritative extension installation feed (C173) derived from the same
 * `EXTENSIONS` store as the live `/extensions/feed` endpoint. Router-style 422
 * validation (type / status / limit) and the `"extensionFeed"` failure domain
 * keep error and empty states at parity with live mode.
 */
export async function fetchExtensionFeed(
  options?: ExtensionFeedOptions,
): Promise<ExtensionFeed> {
  failIfEnabled("extensionFeed");
  validateExtensionFeedArgs(options);
  return delay(deriveExtensionFeed(EXTENSIONS, REFERENCE_NOW, options));
}

/**
 * Authoritative organization/membership metrics (C69) derived from the same
 * user/organization/member seeds as the live `/orgs/stats` endpoint. Router-style
 * 422 validation for a malformed org id, a zero-filled snapshot for an unknown
 * (well-formed) org and the `"organizationStats"` failure domain keep error and
 * empty states at parity with live mode.
 */
export async function fetchOrganizationStats(
  options?: OrganizationStatsOptions,
): Promise<OrganizationStats> {
  failIfEnabled("organizationStats");
  validateOrganizationStatsArgs(options);
  return delay(
    deriveOrganizationStats(ORGANIZATIONS, ORGANIZATION_MEMBERS, USERS, REFERENCE_NOW, options),
  );
}

/**
 * Authoritative organization feed (C161) derived from the same organization/
 * membership/project seeds as the live `/orgs/feed` endpoint. Router-style 422
 * validation for an out-of-range limit and the `"organizationFeed"` failure
 * domain keep error and empty states at parity with live mode.
 */
export async function fetchOrganizationFeed(
  options?: OrganizationFeedOptions,
): Promise<OrganizationFeed> {
  failIfEnabled("organizationFeed");
  validateOrganizationFeedArgs(options);
  return delay(
    deriveOrganizationFeed(ORGANIZATIONS, ORGANIZATION_MEMBERS, PROJECTS, REFERENCE_NOW, options),
  );
}

/**
 * Authoritative production-pipeline metrics (C73) derived from the same three
 * chain seeds as the live `/pipelines/stats` endpoint. Router-style 422 for a
 * malformed project id, a normalized 404 for an unknown project scope and the
 * `"pipelineStats"` failure domain keep error and empty states at parity with
 * live mode.
 */
export async function fetchPipelineStats(
  options?: PipelineStatsOptions,
): Promise<PipelineStats> {
  failIfEnabled("pipelineStats");
  validatePipelineStatsArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(derivePipelineStats(PIPELINE_CHAINS, REFERENCE_NOW, options));
}

/**
 * Authoritative production-pipeline feed (C177) derived from the same three
 * chain/project seeds as the live `/pipelines/feed` endpoint. Router-style 422
 * validation (project id / kind / limit), a normalized 404 for an unknown
 * project scope and the `"pipelineFeed"` failure domain keep error and empty
 * states at parity with live mode.
 */
export async function fetchPipelineFeed(
  options?: PipelineFeedOptions,
): Promise<PipelineFeed> {
  failIfEnabled("pipelineFeed");
  validatePipelineFeedArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(derivePipelineFeed(PIPELINE_CHAINS, PROJECTS, REFERENCE_NOW, options));
}

/**
 * Authoritative asset-lineage metrics (C77) derived from the same relationship
 * and asset seeds as the live `/lineage/stats` endpoint. Router-style 422 for a
 * malformed project id, a normalized 404 for an unknown project scope and the
 * `"lineageStats"` failure domain keep error and empty states at parity with
 * live mode.
 */
export async function fetchLineageStats(
  options?: LineageStatsOptions,
): Promise<LineageStats> {
  failIfEnabled("lineageStats");
  validateLineageStatsArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(
    deriveLineageStats(ASSET_RELATIONSHIPS, ASSETS, REFERENCE_NOW, options),
  );
}

/**
 * Authoritative asset lineage feed (C157) derived from the same relationship/
 * asset/project seeds as the live `/lineage/feed` endpoint. Router-style 422
 * validation, a normalized 404 for an unknown project scope and the
 * `"lineageFeed"` failure domain keep error and empty states at parity.
 */
export async function fetchLineageFeed(
  options?: LineageFeedOptions,
): Promise<LineageFeed> {
  failIfEnabled("lineageFeed");
  validateLineageFeedArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(
    deriveLineageFeed(ASSET_RELATIONSHIPS, ASSETS, PROJECTS, REFERENCE_NOW, options),
  );
}

/**
 * Authoritative collaboration metrics (C81) derived from the same presence and
 * comment seeds as the live `/collaboration/stats` endpoint. Router-style 422
 * validation, a normalized 404 for an unknown project scope and the
 * `"collaborationStats"` failure domain keep error and empty states at parity
 * with live mode.
 */
export async function fetchCollaborationStats(
  options?: CollaborationStatsOptions,
): Promise<CollaborationStats> {
  failIfEnabled("collaborationStats");
  validateCollaborationStatsArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveCollaborationStats(PRESENCE, COMMENTS, REFERENCE_NOW, options));
}

/**
 * Authoritative collaboration feed (C197) derived from the same presence and
 * comment seeds as the live `/collaboration/feed` endpoint. Router-style 422
 * validation (project id / signal / limit), a normalized 404 for an unknown
 * project scope and the `"collaborationFeed"` failure domain keep error and
 * empty states at parity with live mode.
 */
export async function fetchCollaborationFeed(
  options?: CollaborationFeedOptions,
): Promise<CollaborationFeed> {
  failIfEnabled("collaborationFeed");
  validateCollaborationFeedArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveCollaborationFeed(PRESENCE, COMMENTS, PROJECTS, REFERENCE_NOW, options));
}

/**
 * Authoritative orchestration metrics (C85) derived from the same plan/run
 * seeds as the live `/orchestration/stats` endpoint. Router-style 422
 * validation, a normalized 404 for an unknown project scope and the
 * `"orchestrationStats"` failure domain keep error and empty states at parity
 * with live mode.
 */
export async function fetchOrchestrationStats(
  options?: OrchestrationStatsOptions,
): Promise<OrchestrationStats> {
  failIfEnabled("orchestrationStats");
  validateOrchestrationStatsArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(
    deriveOrchestrationStats(ORCHESTRATION_PLANS, ORCHESTRATION_RUNS, REFERENCE_NOW, options),
  );
}

/**
 * Authoritative orchestration feed (C181) derived from the same plan/run/project
 * seeds as the live `/orchestration/feed` endpoint. Router-style 422 validation
 * (project id / kind / limit), a normalized 404 for an unknown project scope and
 * the `"orchestrationFeed"` failure domain keep error and empty states at parity
 * with live mode.
 */
export async function fetchOrchestrationFeed(
  options?: OrchestrationFeedOptions,
): Promise<OrchestrationFeed> {
  failIfEnabled("orchestrationFeed");
  validateOrchestrationFeedArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(
    deriveOrchestrationFeed(ORCHESTRATION_PLANS, ORCHESTRATION_RUNS, PROJECTS, REFERENCE_NOW, options),
  );
}

/**
 * Authoritative workspace activity feed (C29) derived from the same asset/job/
 * comment seeds as the live endpoint. Router-style 422 validation, a 404 for an
 * unknown project scope and the `"activity"` failure domain keep error and empty
 * states at parity with live mode.
 */
export async function fetchActivity(options?: ActivityOptions) {
  failIfEnabled("activity");
  validateActivityArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveActivityFeed(ASSETS.map(withAssetOverrides), JOBS, COMMENTS, options));
}

/**
 * Authoritative activity metrics (C89) derived by reusing the same activity-feed
 * derivation as the live `/activity/stats` endpoint. Router-style 422 validation,
 * a normalized 404 for an unknown project scope and the `"activityStats"` failure
 * domain keep error and empty states at parity with live mode.
 */
export async function fetchActivityStats(
  options?: ActivityStatsOptions,
): Promise<ActivityStats> {
  failIfEnabled("activityStats");
  validateActivityStatsArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(
    deriveActivityStats(
      ASSETS.map(withAssetOverrides),
      JOBS,
      COMMENTS,
      REFERENCE_NOW,
      options,
    ),
  );
}

export async function fetchProjects(): Promise<readonly Project[]> {
  failIfEnabled("projects");
  return delay(PROJECTS);
}

export async function fetchProject(projectId: string): Promise<Project | undefined> {
  failIfEnabled("projects");
  return delay(PROJECTS.find((project) => project.id === projectId));
}

export async function fetchRecentAssets(
  limit = 6,
): Promise<readonly Asset[]> {
  failIfEnabled("assets");
  const assets = ASSETS.map(withAssetOverrides)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
  return delay(assets);
}

export async function fetchAssetsByProject(projectId: string): Promise<readonly Asset[]> {
  failIfEnabled("assets");
  const assets = ASSETS.map(withAssetOverrides)
    .filter((asset) => asset.project_id === projectId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return delay(assets);
}

export async function fetchJobs(
  projectId?: string,
  status?: Job["status"],
): Promise<readonly Job[]> {
  failIfEnabled("jobs");
  const jobs = JOBS.filter((job) => {
    if (projectId && job.project_id !== projectId) return false;
    if (status && job.status !== status) return false;
    return true;
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return delay(jobs);
}

export async function fetchJobsByProject(projectId: string): Promise<readonly Job[]> {
  return fetchJobs(projectId);
}

export async function fetchProjectDetail(projectId: string): Promise<ProjectDetail | undefined> {
  failIfEnabled("projects");
  const project = PROJECTS.find((candidate) => candidate.id === projectId);
  if (!project) {
    return delay(undefined);
  }
  return delay({
    project,
    assets: ASSETS.map(withAssetOverrides)
      .filter((asset) => asset.project_id === projectId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    jobs: JOBS.filter((job) => job.project_id === projectId).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    ),
  });
}

/**
 * Authoritative single-project overview (C201) derived from the same stores as
 * the live `/projects/{id}/overview` endpoint. Router-style 422 validation
 * (project id / recent_limit), a normalized 404-to-`undefined` for an unknown
 * project and the `"projectOverview"` failure domain keep error and empty
 * states at parity with live mode.
 */
export async function fetchProjectOverview(
  projectId: string,
  options?: ProjectOverviewOptions,
): Promise<ProjectOverview | undefined> {
  failIfEnabled("projectOverview");
  validateProjectOverviewArgs(projectId, options);
  if (!PROJECTS.some((project) => project.id === projectId)) {
    return delay(undefined);
  }
  return delay(
    deriveProjectOverview(
      projectId,
      {
        projects: PROJECTS,
        assets: ASSETS,
        assetVersions: ASSET_VERSIONS,
        conversations: CONVERSATIONS,
        jobs: JOBS,
        comments: COMMENTS,
        presence: PRESENCE,
        now: REFERENCE_NOW,
      },
      options,
    ),
  );
}

/**
 * Newest-first authoritative audit feed (C18/C20). Unknown projects resolve to
 * `undefined` (mirroring the live endpoint's 404-to-undefined mapping); the
 * `"audit"` failure domain surfaces the same normalized `ApiError` as live.
 */
export async function fetchProjectAudit(
  projectId: string,
  query?: AuditQuery,
): Promise<AuditTrail | undefined> {
  failIfEnabled("audit");
  const trail = AUDIT_TRAILS.find((entry) => entry.project_id === projectId);
  return delay(filterAuditTrail(trail, query));
}

export async function fetchProviders(): Promise<readonly Provider[]> {
  failIfEnabled("providers");
  return delay(PROVIDERS);
}

export async function fetchAssets(): Promise<readonly Asset[]> {
  failIfEnabled("assets");
  const assets = ASSETS.map(withAssetOverrides).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  return delay(assets);
}

export async function fetchAsset(assetId: string): Promise<Asset | undefined> {
  failIfEnabled("assets");
  const asset = ASSETS.find((candidate) => candidate.id === assetId);
  return delay(asset ? withAssetOverrides(asset) : undefined);
}

/**
 * Persist an asset metadata patch, mirroring `PATCH /assets/{id}` on the live
 * router. `null` tags/metadata mean "leave unchanged" and a null name is
 * rejected exactly as the backend repository does; unknown ids yield a 404 and
 * deleted assets a 400, so screens can exercise both error paths in mock mode.
 */
export async function updateAsset(assetId: string, body: AssetUpdate): Promise<Asset> {
  failIfEnabled("assets");
  const current = assetOverrides.get(assetId) ?? ASSETS.find((asset) => asset.id === assetId);
  if (!current) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Asset '${assetId}' not found.`,
    });
  }
  if (current.status === "deleted") {
    throw new ApiError({
      status: 400,
      code: "asset_deleted",
      message: `Asset '${assetId}' is deleted and cannot be updated.`,
    });
  }
  if (body.name === null) {
    throw new ApiError({
      status: 400,
      code: "invalid_request",
      message: "Asset name cannot be null.",
      details: [{ field: "name", message: "name is required and cannot be null" }],
    });
  }
  const updated: Asset = {
    ...current,
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.tags != null ? { tags: body.tags } : {}),
    ...(body.metadata != null ? { metadata: body.metadata } : {}),
    updated_at: new Date().toISOString(),
  };
  assetOverrides.set(assetId, updated);
  return delay(updated);
}

export async function fetchJob(jobId: string): Promise<Job | undefined> {
  failIfEnabled("jobs");
  return delay(JOBS.find((job) => job.id === jobId));
}

/**
 * Authoritative per-job execution log (C117) derived from the same `JOB_EVENTS`
 * stream as the live `/jobs/{job_id}/logs` endpoint. Router-style 422 validation,
 * a normalized detail 404 for an unknown job and the `"jobLogs"` failure domain
 * keep error and empty states at parity.
 */
export async function fetchJobLogs(
  jobId: string,
  options?: JobLogsOptions,
): Promise<JobLogFrame | undefined> {
  failIfEnabled("jobLogs");
  validateJobLogsArgs(jobId, options);
  if (!JOBS.some((job) => job.id === jobId)) return delay(undefined);
  return delay(deriveJobLogs(jobId, JOB_EVENTS.filter((event) => event.job_id === jobId), options));
}

/**
 * Authoritative dispatch queue (C121) derived from the same job seeds as the
 * live `/jobs/queue` endpoint. Router-style 422 validation, a 404 for an unknown
 * project scope and the `"jobQueue"` failure domain keep error and empty states
 * at parity with live mode.
 */
export async function fetchJobQueue(options?: JobQueueOptions): Promise<JobQueueView> {
  failIfEnabled("jobQueue");
  validateJobQueueArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveJobQueue(JOBS, REFERENCE_NOW, options));
}

/**
 * Authoritative job feed (C141) derived from the same job/project stores as the
 * live `/jobs/feed` endpoint. Router-style 422 validation, a normalized 404 for
 * an unknown project scope and the `"jobFeed"` failure domain keep error and
 * empty states at parity with live mode.
 */
export async function fetchJobFeed(options?: JobFeedOptions): Promise<JobFeed> {
  failIfEnabled("jobFeed");
  validateJobFeedArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveJobFeed(JOBS, PROJECTS, REFERENCE_NOW, options));
}

export async function fetchProvider(providerId: string): Promise<Provider | undefined> {
  failIfEnabled("providers");
  return delay(PROVIDERS.find((provider) => provider.id === providerId));
}


export async function fetchWorkflowTemplates(projectId?: string): Promise<readonly Asset[]> {
  failIfEnabled("assets");
  const templates = ASSETS.map(withAssetOverrides).filter((asset) => {
    if (asset.type !== "resource") return false;
    const meta = asset.metadata ?? {};
    if (meta["template"] !== true) return false;
    if (projectId && asset.project_id !== projectId) return false;
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));
  return delay(templates);
}

/** Static operation catalog (pipeline stages 1-9). */
export async function fetchOperations(): Promise<OperationCatalog> {
  failIfEnabled("operations");
  return delay(OPERATION_CATALOG);
}

/**
 * Deterministic authoritative operation feed (C189) derived from the same
 * catalog seeds as the live `/operations/feed` endpoint. Router-style 422
 * validation (streaming / provider_id / limit) and the `"operationFeed"`
 * failure domain keep error and empty states at parity with live mode.
 */
export async function fetchOperationFeed(options?: OperationFeedOptions): Promise<OperationFeed> {
  failIfEnabled("operationFeed");
  validateOperationFeedArgs(options);
  return delay(deriveOperationFeed(OPERATION_CATALOG.operations ?? [], REFERENCE_NOW, options));
}

/**
 * Authoritative catalog metrics (C65) derived from the same operation catalog
 * as the live `/operations/stats` endpoint. There are no query parameters, so
 * only the `"operationStats"` failure domain can make this query fail.
 */
export async function fetchOperationStats(): Promise<OperationStats> {
  failIfEnabled("operationStats");
  return delay(deriveOperationStats(OPERATION_CATALOG.operations ?? [], REFERENCE_NOW));
}

/** Flattened capability rows, optionally filtered to one operation id. */
export async function fetchCapabilities(operationId?: string): Promise<readonly CapabilityMatch[]> {
  failIfEnabled("capabilities");
  const matches: CapabilityMatch[] = [];
  for (const provider of PROVIDERS) {
    for (const capability of provider.capabilities ?? []) {
      if (operationId && capability.operation_id !== operationId) continue;
      matches.push({
        provider_id: provider.id,
        provider_name: provider.name,
        location: provider.location,
        status: provider.status,
        operation_id: capability.operation_id,
        schema_versions: capability.schema_versions ?? [],
      });
    }
  }
  return delay(matches);
}

/** Conversations for a project, newest activity first. */
export async function fetchConversations(projectId: string): Promise<readonly Conversation[]> {
  failIfEnabled("conversations");
  const conversations = CONVERSATIONS.filter(
    (conversation) => conversation.project_id === projectId,
  ).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return delay(conversations);
}

export async function fetchConversation(
  conversationId: string,
): Promise<Conversation | undefined> {
  failIfEnabled("conversations");
  return delay(CONVERSATIONS.find((conversation) => conversation.id === conversationId));
}

/** Messages in a conversation, oldest first so a chat transcript reads naturally. */
export async function fetchMessages(
  conversationId: string,
  limit?: number,
): Promise<readonly Message[]> {
  failIfEnabled("messages");
  let messages = [...MESSAGES, ...sentMessages]
    .filter((message) => message.conversation_id === conversationId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (limit !== undefined) messages = messages.slice(-limit);
  return delay(messages);
}

/**
 * Persist a message with an authoritative, UUID-shaped id and surface it on
 * subsequent `fetchMessages` calls, mirroring the live conversations POST.
 */
export async function sendMessage(
  conversationId: string,
  body: MessageCreate,
): Promise<Message> {
  failIfEnabled("messages");
  const message: Message = {
    id: `0b5c1e2a-7000-4000-8000-${String(nextMessageSeq++).padStart(12, "0")}`,
    conversation_id: conversationId,
    role: body.role ?? "user",
    content: body.content,
    status: "complete",
    ...(body.attachments ? { attachments: body.attachments } : {}),
    ...(body.operation_id !== undefined ? { operation_id: body.operation_id } : {}),
    created_at: new Date().toISOString(),
  };
  sentMessages.push(message);
  return delay(message);
}

/**
 * Simulated stream: emits `message_start` → `delta` → `message_complete` in
 * sequence order (or a single `error` frame when the `stream` domain fails),
 * with `seq` continuing from the resume cursor. `close` cancels pending timers
 * so no events leak after teardown.
 */
export function openConversationStream(
  _conversationId: string,
  resumeFrom?: number,
): ConversationStream {
  const listeners = new Set<(event: StreamEvent) => void>();
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  let closed = false;
  const start = resumeFrom ?? 0;
  const messageId = "0b5c1e2a-7000-4000-8000-000000000001";
  const failing = activeFailures.has("stream") || activeFailures.has("*");
  const events: StreamEvent[] = failing
    ? [{ type: "error", message_id: messageId, seq: start + 1, error: "Mock stream failure" }]
    : [
        { type: "message_start", message_id: messageId, seq: start + 1 },
        { type: "delta", message_id: messageId, seq: start + 2, delta: "Acknowledged. " },
        { type: "delta", message_id: messageId, seq: start + 3, delta: "Working on it…" },
        { type: "message_complete", message_id: messageId, seq: start + 4 },
      ];

  events.forEach((event, index) => {
    timers.push(
      setTimeout(
        () => {
          if (closed) return;
          for (const handler of listeners) handler(event);
        },
        env.mockLatencyMs * (index + 1),
      ),
    );
  });

  return {
    onEvent(handler) {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },
    close() {
      closed = true;
      for (const timer of timers) clearTimeout(timer);
      listeners.clear();
    },
  };
}

/** Current dev-local session user. */
export async function fetchCurrentUser(): Promise<User> {
  failIfEnabled("auth");
  return delay(CURRENT_USER);
}

export async function fetchOrganizations(): Promise<readonly Organization[]> {
  failIfEnabled("auth");
  return delay(ORGANIZATIONS);
}

/** A run is returned by id; unknown ids resolve to `undefined`. */
export async function fetchOrchestrationRun(
  runId: string,
): Promise<OrchestrationRun | undefined> {
  failIfEnabled("orchestration");
  return delay(ORCHESTRATION_RUNS.find((run) => run.run_id === runId));
}

export async function fetchPresence(projectId: string): Promise<readonly Presence[]> {
  failIfEnabled("presence");
  return delay(PRESENCE.filter((entry) => entry.project_id === projectId));
}

export async function fetchComments(
  projectId: string,
  assetId?: string,
): Promise<readonly Comment[]> {
  failIfEnabled("comments");
  return delay(
    COMMENTS.filter((comment) => {
      if (comment.project_id !== projectId) return false;
      return !assetId || comment.asset_id === assetId;
    }).sort((a, b) => b.created_at.localeCompare(a.created_at)),
  );
}

/** Empty stats for an unknown project mirror the live API's default shape. */
export async function fetchStorageStats(projectId: string): Promise<StorageStats> {
  failIfEnabled("storage");
  const stats = STORAGE_STATS.find((entry) => entry.project_id === projectId);
  return delay(
    stats ?? {
      project_id: projectId,
      quota: { used: 0, limit: 0, unit: "bytes" },
      object_count: 0,
    },
  );
}

export async function fetchExtensions(): Promise<readonly Extension[]> {
  failIfEnabled("extensions");
  return delay(EXTENSIONS);
}

export async function fetchExtension(extensionId: string): Promise<Extension | undefined> {
  failIfEnabled("extensions");
  return delay(EXTENSIONS.find((extension) => extension.manifest.id === extensionId));
}

/**
 * Cross-domain search (C22) derived from the same authoritative seeds as the
 * live endpoint. Router-style 422 validation and the `"search"` failure domain
 * keep error and empty states at parity with live mode.
 */
export async function fetchSearch(
  query: string,
  options?: SearchOptions,
): Promise<SearchResponse> {
  failIfEnabled("search");
  validateSearchArgs(query, options);
  return delay(
    deriveSearchResponse(
      query,
      PROJECTS,
      ASSETS.map(withAssetOverrides),
      CONVERSATIONS,
      options,
    ),
  );
}

/**
 * Authoritative search index metrics (C93) derived from the same project/asset/
 * conversation document seeds as the live `/search/stats` endpoint. Router-style
 * 422 validation, a normalized 404 for an unknown project scope and the
 * `"searchStats"` failure domain keep error and empty states at parity.
 */
export async function fetchSearchStats(options?: SearchStatsOptions): Promise<SearchStats> {
  failIfEnabled("searchStats");
  validateSearchStatsArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(
    deriveSearchStats(
      PROJECTS,
      ASSETS.map(withAssetOverrides),
      CONVERSATIONS,
      REFERENCE_NOW,
      options,
    ),
  );
}

/**
 * Authoritative upload metrics (C97) derived from the same ticket store as the
 * live `/uploads/stats` endpoint. Router-style 422 validation, a normalized 404
 * for an unknown project scope and the `"uploadStats"` failure domain keep error
 * and empty states at parity.
 */
export async function fetchUploadStats(options?: UploadStatsOptions): Promise<UploadStats> {
  failIfEnabled("uploadStats");
  validateUploadStatsArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveUploadStats(UPLOADS, REFERENCE_NOW, options));
}

/**
 * Authoritative upload feed (C129) derived from the same ticket store as the
 * live `/uploads/feed` endpoint. Router-style 422 validation, a normalized 404
 * for an unknown project scope and the `"uploadFeed"` failure domain keep error
 * and empty states at parity.
 */
export async function fetchUploadFeed(options?: UploadFeedOptions): Promise<UploadFeed> {
  failIfEnabled("uploadFeed");
  validateUploadFeedArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveUploadFeed(UPLOADS, PROJECTS, REFERENCE_NOW, options));
}

/**
 * Authoritative job event stream metrics (C101) derived from the same event
 * store as the live `/events/stats` endpoint. Router-style 422 validation, a
 * normalized 404 for an unknown project scope and the `"eventStats"` failure
 * domain keep error and empty states at parity.
 */
export async function fetchEventStats(options?: EventStatsOptions): Promise<EventStats> {
  failIfEnabled("eventStats");
  validateEventStatsArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveEventStats(JOB_EVENTS, JOBS, REFERENCE_NOW, options));
}

/**
 * Authoritative job event feed (C169) derived from the same event store as the
 * live `/events/feed` endpoint, joined to jobs/projects over the shared seeds.
 * Router-style 422 validation (project id / event type / limit), a normalized
 * 404 for an unknown project scope and the `"eventFeed"` failure domain keep
 * error and empty states at parity.
 */
export async function fetchEventFeed(options?: EventFeedOptions): Promise<EventFeed> {
  failIfEnabled("eventFeed");
  validateEventFeedArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveEventFeed(JOB_EVENTS, JOBS, PROJECTS, REFERENCE_NOW, options));
}

/**
 * Authoritative job retry metrics (C105) derived from the same retry ledger as
 * the live `/retries/stats` endpoint. Router-style 422 validation, a normalized
 * 404 for an unknown project scope and the `"retryStats"` failure domain keep
 * error and empty states at parity.
 */
export async function fetchRetryStats(options?: RetryStatsOptions): Promise<RetryStats> {
  failIfEnabled("retryStats");
  validateRetryStatsArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveRetryStats(JOB_RETRIES, JOBS, REFERENCE_NOW, options));
}

/**
 * Authoritative job retry feed (C193) derived from the same retry ledger as the
 * live `/retries/feed` endpoint, joined to jobs/projects over the shared seeds.
 * Router-style 422 validation (project id / limit), a normalized 404 for an
 * unknown project scope and the `"retryFeed"` failure domain keep error and
 * empty states at parity.
 */
export async function fetchRetryFeed(options?: RetryFeedOptions): Promise<RetryFeed> {
  failIfEnabled("retryFeed");
  validateRetryFeedArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveRetryFeed(JOB_RETRIES, JOBS, PROJECTS, REFERENCE_NOW, options));
}

/**
 * Authoritative asset version metrics (C109) derived from the same version
 * collection as the live `/versions/stats` endpoint, attributed to each live
 * asset's project. Router-style 422 validation, a normalized 404 for an unknown
 * project scope and the `"versionStats"` failure domain keep error and empty
 * states at parity.
 */
export async function fetchVersionStats(options?: VersionStatsOptions): Promise<VersionStats> {
  failIfEnabled("versionStats");
  validateVersionStatsArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveVersionStats(ASSET_VERSIONS, ASSETS, REFERENCE_NOW, options));
}

/**
 * Authoritative asset version feed (C153) derived from the same version/asset/
 * project seeds as the live `/versions/feed` endpoint. Router-style 422
 * validation, a normalized 404 for an unknown project scope and the
 * `"versionFeed"` failure domain keep error and empty states at parity.
 */
export async function fetchVersionFeed(options?: VersionFeedOptions): Promise<VersionFeed> {
  failIfEnabled("versionFeed");
  validateVersionFeedArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveVersionFeed(ASSET_VERSIONS, ASSETS, PROJECTS, REFERENCE_NOW, options));
}

/**
 * Authoritative publish metrics (C113) derived from the same asset publish
 * receipts as the live `/publishes/stats` endpoint. Router-style 422 validation,
 * a normalized 404 for an unknown project scope and the `"publishStats"`
 * failure domain keep error and empty states at parity.
 */
export async function fetchPublishStats(options?: PublishStatsOptions): Promise<PublishStats> {
  failIfEnabled("publishStats");
  validatePublishStatsArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(derivePublishStats(ASSETS, REFERENCE_NOW, options));
}

/**
 * Authoritative publish feed (C125) derived from the same asset publish receipts
 * as the live `/publishes` endpoint. Router-style 422 validation, a normalized
 * 404 for an unknown project scope and the `"publishFeed"` failure domain keep
 * error and empty states at parity.
 */
export async function fetchPublishFeed(options?: PublishFeedOptions): Promise<PublishFeed> {
  failIfEnabled("publishFeed");
  validatePublishFeedArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(derivePublishFeed(ASSETS, PROJECTS, REFERENCE_NOW, options));
}

/**
 * Authoritative tag facets (C33) derived from the same asset store as the live
 * `/tags` endpoint. Router-style 422 validation, a 404 for an unknown project
 * scope and the `"tags"` failure domain keep empty/error states at parity.
 */
export async function fetchTags(options?: TagOptions): Promise<TagIndex> {
  failIfEnabled("tags");
  validateTagArgs(options);
  if (options?.projectId && !PROJECTS.some((project) => project.id === options.projectId)) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: `Project '${options.projectId}' not found.`,
    });
  }
  return delay(deriveTagIndex(ASSETS.map(withAssetOverrides), options));
}

/**
 * Authoritative downstream impact (C34) derived from the same asset/lineage
 * seeds as the live `/assets/{id}/impact` endpoint. An unknown root resolves to
 * `undefined` (mirroring the live 404-to-undefined mapping); router-style 422
 * validation and the `"impact"` failure domain keep error states at parity.
 */
export async function fetchAssetImpact(
  assetId: string,
  options?: ImpactOptions,
): Promise<AssetImpact | undefined> {
  failIfEnabled("impact");
  validateImpactArgs(assetId, options);
  const asset = ASSETS.find((candidate) => candidate.id === assetId);
  if (!asset) return delay(undefined);
  return delay(deriveAssetImpact(assetId, ASSETS.map(withAssetOverrides), options));
}

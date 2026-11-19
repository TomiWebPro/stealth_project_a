import { ApiError } from "../../api/client";
import { deriveActivityFeed, validateActivityArgs } from "../activity";
import type { ActivityOptions } from "../activity";
import { deriveAssetStats, validateAssetStatsArgs } from "../assetStats";
import type { AssetStatsOptions } from "../assetStats";
import { filterAuditTrail } from "../audit";
import type { AuditQuery } from "../audit";
import type { CapabilityMatch } from "../catalog";
import {
  deriveConversationStats,
  validateConversationStatsArgs,
} from "../conversationStats";
import type { ConversationStatsOptions } from "../conversationStats";
import type { ConversationStream } from "../conversationStream";
import { deriveDashboardSummary, validateDashboardArgs } from "../dashboard";
import type { DashboardOptions } from "../dashboard";
import { env } from "../env";
import type { HomeSummary } from "../homeSummary";
import type { ImpactOptions } from "../impact";
import { deriveAssetImpact, validateImpactArgs } from "../impact";
import { deriveJobStats, validateJobStatsArgs } from "../jobStats";
import type { JobStatsOptions } from "../jobStats";
import type { ProjectDetail } from "../projectDetail";
import { deriveProjectStats, validateProjectStatsArgs } from "../projectStats";
import type { ProjectStatsOptions } from "../projectStats";
import { deriveSearchResponse, validateSearchArgs } from "../search";
import type { SearchOptions } from "../search";
import { deriveTagIndex, validateTagArgs } from "../tags";
import type { TagOptions } from "../tags";
import type {
  Asset,
  AssetImpact,
  AssetStats,
  AssetUpdate,
  AuditTrail,
  Comment,
  Conversation,
  ConversationStats,
  Extension,
  Job,
  JobStats,
  Message,
  MessageCreate,
  OperationCatalog,
  Organization,
  OrchestrationRun,
  Presence,
  Project,
  ProjectStats,
  Provider,
  SearchResponse,
  StorageStats,
  StreamEvent,
  TagIndex,
  User,
} from "../types";
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
 * every guarded query. Guarded domains: `home`, `dashboard`, `activity`, `jobStats`,
 * `assetStats`, `conversationStats`, `projectStats`, `projects` (incl. detail/recent/by-project), `jobs`, `assets` (incl. detail,
 * templates and writes), `providers`, `audit`, `operations`, `capabilities`,
 * `conversations`, `messages` (incl. sends), `stream`, `auth` (user + orgs),
 * `orchestration`, `presence`, `comments`, `storage`, `extensions`, `search`,
 * `tags` and `impact`. Always reset with {@link clearMockFailures} afterwards.
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

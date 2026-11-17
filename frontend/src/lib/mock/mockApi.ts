import type { CapabilityMatch } from "../catalog";
import { env } from "../env";
import type { HomeSummary } from "../homeSummary";
import type { ProjectDetail } from "../projectDetail";
import type {
  Asset,
  Comment,
  Conversation,
  Extension,
  Job,
  Message,
  OperationCatalog,
  Organization,
  OrchestrationRun,
  Presence,
  Project,
  Provider,
  StorageStats,
  User,
} from "../types";
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

function toSummary(): HomeSummary {
  return {
    projects: PROJECTS.filter((project) => !project.archived).map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description ?? "",
      assetCount: ASSETS.filter((asset) => asset.project_id === project.id).length,
      updatedAt: project.updated_at,
    })),
    recentAssets: [...ASSETS]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 6),
    activeJobs: JOBS.filter(
      (candidate) => candidate.status === "queued" || candidate.status === "running",
    ),
    providers: PROVIDERS.map((provider) => ({
      id: provider.id,
      name: provider.name,
      status: provider.status,
      operations: (provider.capabilities ?? []).map((capability) => capability.operation_id),
    })),
  };
}

export async function fetchHomeSummary(): Promise<HomeSummary> {
  return delay(toSummary());
}

export async function fetchProjects(): Promise<readonly Project[]> {
  return delay(PROJECTS);
}

export async function fetchProject(projectId: string): Promise<Project | undefined> {
  return delay(PROJECTS.find((project) => project.id === projectId));
}

export async function fetchRecentAssets(
  limit = 6,
): Promise<readonly Asset[]> {
  const assets = [...ASSETS]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
  return delay(assets);
}

export async function fetchAssetsByProject(projectId: string): Promise<readonly Asset[]> {
  const assets = ASSETS.filter((asset) => asset.project_id === projectId).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  return delay(assets);
}

export async function fetchJobs(
  projectId?: string,
  status?: Job["status"],
): Promise<readonly Job[]> {
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
  const project = PROJECTS.find((candidate) => candidate.id === projectId);
  if (!project) {
    return delay(undefined);
  }
  return delay({
    project,
    assets: ASSETS.filter((asset) => asset.project_id === projectId).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    ),
    jobs: JOBS.filter((job) => job.project_id === projectId).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    ),
  });
}

export async function fetchProviders(): Promise<readonly Provider[]> {
  return delay(PROVIDERS);
}

export async function fetchAssets(): Promise<readonly Asset[]> {
  const assets = [...ASSETS].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return delay(assets);
}

export async function fetchAsset(assetId: string): Promise<Asset | undefined> {
  return delay(ASSETS.find((asset) => asset.id === assetId));
}

export async function fetchJob(jobId: string): Promise<Job | undefined> {
  return delay(JOBS.find((job) => job.id === jobId));
}

export async function fetchProvider(providerId: string): Promise<Provider | undefined> {
  return delay(PROVIDERS.find((provider) => provider.id === providerId));
}


export async function fetchWorkflowTemplates(projectId?: string): Promise<readonly Asset[]> {
  const templates = ASSETS.filter((asset) => {
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
  return delay(OPERATION_CATALOG);
}

/** Flattened capability rows, optionally filtered to one operation id. */
export async function fetchCapabilities(operationId?: string): Promise<readonly CapabilityMatch[]> {
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
  const conversations = CONVERSATIONS.filter(
    (conversation) => conversation.project_id === projectId,
  ).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return delay(conversations);
}

export async function fetchConversation(
  conversationId: string,
): Promise<Conversation | undefined> {
  return delay(CONVERSATIONS.find((conversation) => conversation.id === conversationId));
}

/** Messages in a conversation, oldest first so a chat transcript reads naturally. */
export async function fetchMessages(
  conversationId: string,
  limit?: number,
): Promise<readonly Message[]> {
  let messages = MESSAGES.filter((message) => message.conversation_id === conversationId).sort(
    (a, b) => a.created_at.localeCompare(b.created_at),
  );
  if (limit !== undefined) messages = messages.slice(-limit);
  return delay(messages);
}

/** Current dev-local session user. */
export async function fetchCurrentUser(): Promise<User> {
  return delay(CURRENT_USER);
}

export async function fetchOrganizations(): Promise<readonly Organization[]> {
  return delay(ORGANIZATIONS);
}

/** A run is returned by id; unknown ids resolve to `undefined`. */
export async function fetchOrchestrationRun(
  runId: string,
): Promise<OrchestrationRun | undefined> {
  return delay(ORCHESTRATION_RUNS.find((run) => run.run_id === runId));
}

export async function fetchPresence(projectId: string): Promise<readonly Presence[]> {
  return delay(PRESENCE.filter((entry) => entry.project_id === projectId));
}

export async function fetchComments(
  projectId: string,
  assetId?: string,
): Promise<readonly Comment[]> {
  return delay(
    COMMENTS.filter((comment) => {
      if (comment.project_id !== projectId) return false;
      return !assetId || comment.asset_id === assetId;
    }).sort((a, b) => b.created_at.localeCompare(a.created_at)),
  );
}

/** Empty stats for an unknown project mirror the live API's default shape. */
export async function fetchStorageStats(projectId: string): Promise<StorageStats> {
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
  return delay(EXTENSIONS);
}

export async function fetchExtension(extensionId: string): Promise<Extension | undefined> {
  return delay(EXTENSIONS.find((extension) => extension.manifest.id === extensionId));
}

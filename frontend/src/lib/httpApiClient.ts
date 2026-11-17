import { ApiError } from "../api/client";
import { parseStreamEvent } from "../api/conversations";
import { API_PREFIX } from "../types/common";
import type { ApiClient } from "./apiClient";
import type { CapabilityMatch } from "./catalog";
import type { ConversationStream } from "./conversationStream";
import type { HomeSummary } from "./homeSummary";
import type { ProjectDetail } from "./projectDetail";
import type {
  Asset,
  AssetUpdate,
  Comment,
  Conversation,
  Extension,
  Job,
  Message,
  MessageCreate,
  OperationCatalog,
  Organization,
  OrchestrationRun,
  Presence,
  Project,
  Provider,
  StorageStats,
  User,
} from "./types";

/**
 * Live HTTP transport for the real application API.
 *
 * Implements the same stable `ApiClient` shape as the mock so no screen or hook
 * changes between `VITE_API_MODE=mock|live`. Two responsibilities live here:
 *
 *  1. Talk to the mounted backend routers under `API_PREFIX`, normalizing every
 *     failure to `ApiError` (the same envelope the typed `src/api` layer uses).
 *  2. Assemble the presentation view models (`HomeSummary`, `ProjectDetail`)
 *     from those routers. The backend owns jobs/assets; it deliberately has no
 *     "home summary" or "project detail" endpoint, so joining is a client-side
 *     presentation concern — exactly as it is in `lib/mock/mockApi`.
 *
 * The base URL may be an origin (`http://host:8000`) or already API-prefixed
 * (`http://host:8000/api/v1`, the `env.apiBaseUrl` default); both resolve to
 * the same mounted root without ever doubling the prefix.
 */
/** Minimal surface of a WebSocket needed to carry a conversation stream. */
export interface StreamSocket {
  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void;
  removeEventListener(type: string, listener: (event: { data?: unknown }) => void): void;
  close(): void;
}

export interface HttpApiClientOptions {
  /** Injectable fetch (tests / custom runtimes). Defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Supplies the bearer token appended to every request. */
  getAccessToken?: () => string | null | undefined;
  /** Injectable WebSocket factory (tests / custom runtimes). */
  webSocketImpl?: (url: string) => StreamSocket;
}

type QueryValue = string | number | boolean | undefined;

function resolveRoot(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith(API_PREFIX) ? trimmed : `${trimmed}${API_PREFIX}`;
}

function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function newestFirst<T extends { created_at: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function parseBody(response: Response): Promise<unknown> {
  if (typeof response.text !== "function") return undefined;
  const raw = await response.text();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    details?: ApiError["details"];
    request_id?: string | null;
  };
}

function normalizedError(
  status: number,
  statusText: string,
  body: unknown,
  headerRequestId: string | null,
): ApiError {
  const envelope = (body as ErrorEnvelope | null)?.error;
  return new ApiError({
    status,
    code: envelope?.code ?? `http_${status}`,
    message: envelope?.message ?? statusText ?? `Request failed (${status})`,
    details: envelope?.details ?? [],
    requestId: envelope?.request_id ?? headerRequestId ?? null,
  });
}

/** Supplementary domains (jobs/providers) may not be mounted by every backend
 * build yet. Assembled view models degrade to empty values for them so core
 * screens still render; direct list queries still surface errors so dedicated
 * screens can show their error state. This is reversible once all routers land. */
async function optional<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch {
    return fallback;
  }
}

export function createHttpApiClient(
  baseUrl: string,
  options: HttpApiClientOptions = {},
): ApiClient {
  const root = resolveRoot(baseUrl);
  const fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
  const getAccessToken = options.getAccessToken ?? (() => null);

  async function request<T>(
    path: string,
    query?: Record<string, QueryValue>,
    options?: { method?: "GET" | "POST" | "PATCH"; body?: unknown },
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let body: string | undefined;
    if (options?.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await fetchImpl(`${root}${path}${buildQuery(query)}`, {
        method: options?.method ?? "GET",
        headers,
        body,
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") throw cause;
      throw new ApiError({
        status: 0,
        code: "network_error",
        message: cause instanceof Error ? cause.message : "Network request failed",
      });
    }

    const requestId =
      typeof response.headers?.get === "function"
        ? response.headers.get("X-Request-ID")
        : null;

    if (!response.ok) {
      throw normalizedError(response.status, response.statusText, await parseBody(response), requestId);
    }
    if (response.status === 204) return undefined as T;
    return (await parseBody(response)) as T;
  }

  /** Detail lookups mirror the mock: an unknown id resolves to `undefined`. */
  async function maybe<T>(load: () => Promise<T>): Promise<T | undefined> {
    try {
      return await load();
    } catch {
      return undefined;
    }
  }

  async function listAssets(query?: Record<string, QueryValue>): Promise<readonly Asset[]> {
    return newestFirst(await request<Asset[]>("/assets", { limit: 200, ...query }));
  }

  async function listJobs(query?: Record<string, QueryValue>): Promise<readonly Job[]> {
    return newestFirst(await request<Job[]>("/jobs", query));
  }

  return {
    async getHomeSummary(): Promise<HomeSummary> {
      const [projects, assets, jobs, providers] = await Promise.all([
        request<Project[]>("/projects"),
        listAssets(),
        optional(() => listJobs(), [] as readonly Job[]),
        optional(() => request<Provider[]>("/providers"), [] as readonly Provider[]),
      ]);
      return {
        projects: projects
          .filter((project) => !project.archived)
          .map((project) => ({
            id: project.id,
            name: project.name,
            description: project.description ?? "",
            assetCount: assets.filter((asset) => asset.project_id === project.id).length,
            updatedAt: project.updated_at,
          })),
        recentAssets: newestFirst(assets).slice(0, 6),
        activeJobs: jobs.filter(
          (job) => job.status === "queued" || job.status === "running",
        ),
        providers: providers.map((provider) => ({
          id: provider.id,
          name: provider.name,
          status: provider.status,
          operations: (provider.capabilities ?? []).map((capability) => capability.operation_id),
        })),
      };
    },

    listProjects: () => request<Project[]>("/projects"),

    getProject: (projectId) => maybe(() => request<Project>(`/projects/${projectId}`)),

    listAssets,

    getAsset: (assetId) => maybe(() => request<Asset>(`/assets/${assetId}`)),

    updateAsset(assetId: string, body: AssetUpdate): Promise<Asset> {
      return request<Asset>(`/assets/${encodeURIComponent(assetId)}`, undefined, {
        method: "PATCH",
        body,
      });
    },

    async listRecentAssets(limit = 6): Promise<readonly Asset[]> {
      return newestFirst(await request<Asset[]>("/assets", { limit })).slice(0, limit);
    },

    listAssetsByProject: (projectId) => listAssets({ project_id: projectId }),

    listJobs: (projectId, status) =>
      listJobs({ project_id: projectId, status }),

    listJobsByProject: (projectId) => listJobs({ project_id: projectId }),

    getJob: (jobId) => maybe(() => request<Job>(`/jobs/${jobId}`)),

    async getProjectDetail(projectId: string): Promise<ProjectDetail | undefined> {
      const project = await maybe(() => request<Project>(`/projects/${projectId}`));
      if (!project) return undefined;
      const [assets, jobs] = await Promise.all([
        listAssets({ project_id: projectId }),
        optional(() => listJobs({ project_id: projectId }), [] as readonly Job[]),
      ]);
      return { project, assets, jobs };
    },

    listProviders: () => request<Provider[]>("/providers"),

    getProvider: (providerId) => maybe(() => request<Provider>(`/providers/${providerId}`)),

    async listWorkflowTemplates(projectId?: string): Promise<readonly Asset[]> {
      const templates = await request<Asset[]>("/assets", {
        type: "resource",
        tag: "template",
        project_id: projectId,
        limit: 200,
      });
      return [...templates].sort((a, b) => a.name.localeCompare(b.name));
    },

    getOperations: () => request<OperationCatalog>("/operations"),

    async listCapabilities(operationId?: string): Promise<readonly CapabilityMatch[]> {
      // `/capabilities` may return flat rows or full providers depending on the
      // backend build; accept both so the picker never breaks during rollout.
      const raw = await request<unknown>("/capabilities", { operation_id: operationId });
      const rows = Array.isArray(raw) ? raw : [];
      const matches: CapabilityMatch[] = [];
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const item = row as Record<string, unknown>;
        if (typeof item["operation_id"] === "string") {
          if (operationId && item["operation_id"] !== operationId) continue;
          matches.push({
            provider_id: String(item["provider_id"] ?? ""),
            provider_name: String(item["provider_name"] ?? ""),
            location: (item["location"] as CapabilityMatch["location"]) ?? "local",
            status: (item["status"] as CapabilityMatch["status"]) ?? "available",
            operation_id: item["operation_id"],
            schema_versions: Array.isArray(item["schema_versions"])
              ? (item["schema_versions"] as string[])
              : [],
          });
          continue;
        }
        if (Array.isArray(item["capabilities"])) {
          const provider = row as Provider;
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
      }
      return matches;
    },

    async listConversations(projectId: string): Promise<readonly Conversation[]> {
      const conversations = await request<Conversation[]>("/conversations", {
        project_id: projectId,
      });
      return [...conversations].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },

    getConversation: (conversationId) =>
      maybe(() => request<Conversation>(`/conversations/${conversationId}`)),

    async listMessages(conversationId: string, limit?: number): Promise<readonly Message[]> {
      const messages = await request<Message[]>(`/conversations/${conversationId}/messages`, {
        limit,
      });
      const ordered = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
      return limit === undefined ? ordered : ordered.slice(-limit);
    },

    sendMessage(conversationId: string, body: MessageCreate): Promise<Message> {
      return request<Message>(
        `/conversations/${encodeURIComponent(conversationId)}/messages`,
        undefined,
        { method: "POST", body },
      );
    },

    openConversationStream(conversationId: string, resumeFrom?: number): ConversationStream {
      const suffix = resumeFrom === undefined ? "" : `?since=${resumeFrom}`;
      const url = `${root.replace(/^http/, "ws")}/conversations/${encodeURIComponent(conversationId)}/stream${suffix}`;
      const factory =
        options.webSocketImpl ??
        ((target: string) => new WebSocket(target) as unknown as StreamSocket);
      const socket = factory(url);
      return {
        onEvent(handler) {
          const listener = (event: { data?: unknown }) => {
            if (typeof event?.data !== "string") return;
            try {
              handler(parseStreamEvent(event.data));
            } catch {
              // Ignore malformed frames from older backend builds.
            }
          };
          socket.addEventListener("message", listener);
          return () => socket.removeEventListener("message", listener);
        },
        close() {
          socket.close();
        },
      };
    },

    getCurrentUser: () => request<User>("/auth/me"),

    listOrganizations: () => request<Organization[]>("/orgs"),

    getOrchestrationRun: (runId) =>
      maybe(() => request<OrchestrationRun>(`/orchestration/runs/${runId}`)),

    listPresence: (projectId) =>
      request<Presence[]>("/presence", { project_id: projectId }),

    async listComments(projectId, assetId): Promise<readonly Comment[]> {
      const comments = await request<Comment[]>("/comments", {
        project_id: projectId,
        asset_id: assetId,
      });
      return newestFirst(comments);
    },

    getStorageStats: (projectId) =>
      request<StorageStats>("/storage/stats", { project_id: projectId }),

    listExtensions: () => request<Extension[]>("/extensions"),

    getExtension: (extensionId) =>
      maybe(() => request<Extension>(`/extensions/${extensionId}`)),
  };
}

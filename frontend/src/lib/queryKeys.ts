/**
 * Centralised TanStack Query keys.
 *
 * Query keys are part of the module contract (used for caching and
 * invalidation), so they live in one place and are built by helpers rather
 * than inlined at call sites.
 */
export const queryKeys = {
  home: {
    summary: () => ["home", "summary"] as const,
  },
  projects: {
    all: () => ["projects"] as const,
    byId: (id: string) => ["projects", "by-id", id] as const,
    detail: (id: string) => ["projects", "detail", id] as const,
  },
  assets: {
    all: () => ["assets"] as const,
    byId: (id: string) => ["assets", "by-id", id] as const,
    recent: (limit: number) => ["assets", "recent", limit] as const,
    byProject: (projectId: string) => ["assets", "by-project", projectId] as const,
    workflowTemplates: (projectId?: string) =>
      ["assets", "workflow-templates", projectId ?? "all"] as const,
  },
  jobs: {
    all: () => ["jobs"] as const,
    byId: (id: string) => ["jobs", "by-id", id] as const,
    byProject: (projectId: string) => ["jobs", "by-project", projectId] as const,
    list: (params: { projectId?: string; status?: string } = {}) =>
      ["jobs", "list", params] as const,
  },
  providers: {
    all: () => ["providers"] as const,
    byId: (id: string) => ["providers", "by-id", id] as const,
  },
  operations: {
    catalog: () => ["operations", "catalog"] as const,
  },
  capabilities: {
    list: (operationId?: string) =>
      ["capabilities", "list", operationId ?? "all"] as const,
  },
  conversations: {
    byProject: (projectId: string) => ["conversations", "by-project", projectId] as const,
    byId: (id: string) => ["conversations", "by-id", id] as const,
  },
  messages: {
    byConversation: (conversationId: string, limit?: number) =>
      ["messages", "by-conversation", conversationId, limit ?? "all"] as const,
  },
  auth: {
    me: () => ["auth", "me"] as const,
    organizations: () => ["auth", "organizations"] as const,
  },
  orchestration: {
    run: (runId: string) => ["orchestration", "run", runId] as const,
  },
  collaboration: {
    presence: (projectId: string) => ["collaboration", "presence", projectId] as const,
    comments: (projectId: string, assetId?: string) =>
      ["collaboration", "comments", projectId, assetId ?? "all"] as const,
  },
  storage: {
    stats: (projectId: string) => ["storage", "stats", projectId] as const,
  },
  extensions: {
    all: () => ["extensions"] as const,
    byId: (extensionId: string) => ["extensions", "by-id", extensionId] as const,
  },
} as const;

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
} as const;

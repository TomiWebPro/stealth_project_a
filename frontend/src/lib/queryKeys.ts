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
    detail: (id: string) => ["projects", "detail", id] as const,
  },
  assets: {
    recent: (limit: number) => ["assets", "recent", limit] as const,
  },
  providers: {
    all: () => ["providers"] as const,
  },
} as const;

/**
 * Authoritative search index statistics derivation + query helpers (C93 follow-up).
 *
 * The backend (`SearchStatsRepository`) keeps no second index: it counts the same
 * project/asset/conversation documents the cross-domain search reads on every
 * call, zero-fills `by_kind` over the canonical result kinds and takes the newest
 * document's `updated_at` as the recency marker. `lib/searchStats` reproduces that
 * derivation over the same seeds so mock mode stays at feature parity with live
 * mode and the parity guard can drive both transports over identical data.
 */

import { ApiError } from "../api/client";
import type { Asset, Conversation, Project, SearchResultKind, SearchStats } from "./types";

/** Optional scope mirrored from the authoritative `/search/stats` endpoint. */
export interface SearchStatsOptions {
  readonly projectId?: string;
}

/** Canonical search kinds in their documented order, matching `get_args(SearchResultKind)`. */
export const SEARCH_STAT_KINDS: readonly SearchResultKind[] = [
  "project",
  "asset",
  "conversation",
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's optional-UUID `project_id` validation so mock and live fail
 * identically with the shared normalized error envelope. An unknown (but
 * well-formed) project is checked against the project seeds by the mock fetch
 * and raises a normalized 404, matching `projects.get_or_raise` on the backend.
 */
export function validateSearchStatsArgs(options: SearchStatsOptions = {}): void {
  if (options.projectId !== undefined && !UUID_PATTERN.test(options.projectId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project id.",
      details: [{ field: "project_id", message: "project_id must be a valid UUID" }],
    });
  }
}

/**
 * Derive searchable-document metrics exactly as the backend repository does:
 * a scoped project is itself the only project document, assets exclude soft
 * deletions and conversations are narrowed to the same scope, `by_kind` is
 * zero-filled over the canonical kinds and recency is the newest `updated_at`
 * across all counted documents. An empty scope yields zero counts, zero-filled
 * kind buckets and `newest_document_at: null` (never an error).
 */
export function deriveSearchStats(
  projects: readonly Project[],
  assets: readonly Asset[],
  conversations: readonly Conversation[],
  now: string,
  options: SearchStatsOptions = {},
): SearchStats {
  const projectDocuments = options.projectId
    ? projects.filter((project) => project.id === options.projectId)
    : projects;
  const assetDocuments = assets.filter(
    (asset) =>
      asset.status !== "deleted" &&
      (!options.projectId || asset.project_id === options.projectId),
  );
  const conversationDocuments = conversations.filter(
    (conversation) => !options.projectId || conversation.project_id === options.projectId,
  );

  const counts: Record<SearchResultKind, number> = {
    project: projectDocuments.length,
    asset: assetDocuments.length,
    conversation: conversationDocuments.length,
  };

  let newest: string | null = null;
  for (const document of [...projectDocuments, ...assetDocuments, ...conversationDocuments]) {
    if (document.updated_at && (newest === null || document.updated_at > newest)) {
      newest = document.updated_at;
    }
  }

  return {
    total_documents: projectDocuments.length + assetDocuments.length + conversationDocuments.length,
    by_kind: SEARCH_STAT_KINDS.map((kind) => ({ kind, count: counts[kind] })),
    newest_document_at: newest,
    generated_at: now,
  };
}

/** Query-string values for the live `/search/stats` request. */
export function searchStatsQueryParams(
  options: SearchStatsOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId };
}

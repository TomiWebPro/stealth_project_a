/**
 * Cross-domain search derivation + query helpers (C22 follow-up).
 *
 * The backend (`SearchRepository`) derives ranked project / asset / conversation
 * matches from its authoritative stores on every call. `lib/search` reproduces
 * that ranking exactly so mock mode stays at feature parity with live mode and
 * the parity guard can drive both transports over the very same seeds.
 */

import { ApiError } from "../api/client";
import type {
  Asset,
  Conversation,
  Project,
  SearchResponse,
  SearchResult,
  SearchResultKind,
} from "./types";

/** Optional filters mirrored from the authoritative `/search` endpoint. */
export interface SearchOptions {
  readonly kind?: SearchResultKind;
  readonly limit?: number;
}

const KIND_ORDER: Record<SearchResultKind, number> = {
  project: 0,
  asset: 1,
  conversation: 2,
};

const VALID_KINDS: readonly SearchResultKind[] = ["project", "asset", "conversation"];
const DEFAULT_LIMIT = 50;

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Case-insensitive substring score in `(0, 1]`; `0` means no match (prefix ≈ 1). */
function score(text: string | null | undefined, needle: string): number {
  if (!text) return 0;
  const haystack = text.toLowerCase();
  const index = haystack.indexOf(needle);
  if (index < 0) return 0;
  return round4(1 - index / (haystack.length + 1));
}

interface RankedRow {
  readonly negScore: number;
  readonly kindOrder: number;
  readonly sequence: number;
  readonly result: SearchResult;
}

/**
 * Mirror the router's 422 validation so mock and live fail identically: blank
 * or over-long `q`, an unknown `kind`, and an out-of-range `limit` are rejected
 * with the same normalized error. Whitespace-only queries are *not* rejected
 * (they pass FastAPI's `min_length=1`); they simply return no matches.
 */
export function validateSearchArgs(query: string, options: SearchOptions = {}): void {
  if (query.length < 1 || query.length > 200) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Search query must be between 1 and 200 characters.",
    });
  }
  if (options.kind !== undefined && !VALID_KINDS.includes(options.kind)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid search result kind.",
    });
  }
  if (
    options.limit !== undefined &&
    (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Search limit must be between 1 and 100.",
    });
  }
}

/**
 * Derive ranked matches exactly as the backend repository does. A prefix
 * substring scores higher than a later one, an asset tag match counts at 75%
 * of a name match, and ties break on kind order then insertion order.
 */
export function deriveSearchResponse(
  query: string,
  projects: readonly Project[],
  assets: readonly Asset[],
  conversations: readonly Conversation[],
  options: SearchOptions = {},
): SearchResponse {
  const needle = query.trim().toLowerCase();
  const kind = options.kind;
  const limit = options.limit ?? DEFAULT_LIMIT;
  if (!needle) return { query, results: [] };

  const ranked: RankedRow[] = [];
  let sequence = 0;

  if (kind === undefined || kind === "project") {
    for (const project of projects) {
      const value = score(project.name, needle);
      if (value) {
        ranked.push({
          negScore: -value,
          kindOrder: KIND_ORDER.project,
          sequence,
          result: {
            kind: "project",
            id: project.id,
            title: project.name,
            subtitle: project.description ?? null,
            project_id: project.id,
            score: value,
          },
        });
      }
      sequence += 1;
    }
  }

  if (kind === undefined || kind === "asset") {
    for (const asset of assets) {
      // Deleted assets are skipped *before* the sequence counter advances,
      // exactly like the backend repository, so tie-breaks stay identical.
      if (asset.status === "deleted") continue;
      const nameScore = score(asset.name, needle);
      const tagScore = score((asset.tags ?? []).join(" "), needle) * 0.75;
      const value = round4(Math.max(nameScore, tagScore));
      if (value) {
        ranked.push({
          negScore: -value,
          kindOrder: KIND_ORDER.asset,
          sequence,
          result: {
            kind: "asset",
            id: asset.id,
            title: asset.name,
            subtitle: asset.type,
            project_id: asset.project_id,
            score: value,
          },
        });
      }
      sequence += 1;
    }
  }

  if (kind === undefined || kind === "conversation") {
    const owners = new Map(projects.map((project) => [project.id, project]));
    for (const conversation of conversations) {
      const value = score(conversation.title, needle);
      if (value) {
        ranked.push({
          negScore: -value,
          kindOrder: KIND_ORDER.conversation,
          sequence,
          result: {
            kind: "conversation",
            id: conversation.id,
            title: conversation.title,
            subtitle: owners.get(conversation.project_id)?.name ?? null,
            project_id: conversation.project_id,
            score: value,
          },
        });
      }
      sequence += 1;
    }
  }

  ranked.sort(
    (a, b) => a.negScore - b.negScore || a.kindOrder - b.kindOrder || a.sequence - b.sequence,
  );
  return { query, results: ranked.slice(0, limit).map((row) => row.result) };
}

/** Query-string values for the live `/search` request. */
export function searchQueryParams(
  query: string,
  options: SearchOptions = {},
): Record<string, string | number | undefined> {
  return { q: query, kind: options.kind, limit: options.limit };
}

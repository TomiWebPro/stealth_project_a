/**
 * Authoritative cross-domain search contracts.
 * Mirrors backend/app/schemas/search.py — do not change one side without the other.
 */

import type { Uuid } from "./common";

export type SearchResultKind = "project" | "asset" | "conversation";

/** One ranked match; `id` is the entity id and is stable across refetches. */
export interface SearchResult {
  kind: SearchResultKind;
  id: Uuid;
  title: string;
  subtitle?: string | null;
  project_id?: Uuid | null;
  score?: number;
}

/** Ranked, best-first matches for one query. */
export interface SearchResponse {
  query: string;
  results?: SearchResult[];
}

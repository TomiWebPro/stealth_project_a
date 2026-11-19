/**
 * Authoritative search index statistics contracts.
 * Mirrors backend/app/schemas/search_stats.py — do not change one side without the other.
 */

import type { Timestamp } from "./common";
import type { SearchResultKind } from "./search";

/** Number of searchable documents of one canonical kind. */
export interface SearchKindCount {
  kind: SearchResultKind;
  count: number;
}

/** Searchable-document metrics derived from the authoritative stores. */
export interface SearchStats {
  total_documents: number;
  by_kind?: SearchKindCount[];
  newest_document_at?: Timestamp | null;
  generated_at: Timestamp;
}

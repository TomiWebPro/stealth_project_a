/**
 * Authoritative asset tag facet contracts.
 * Mirrors backend/app/schemas/tags.ts — do not change one side without the other.
 */

/** A single tag and the number of non-deleted assets carrying it. */
export interface TagFacet {
  name: string;
  count: number;
}

/** Most-used-first tag facets plus the total distinct tags before limiting. */
export interface TagIndex {
  tags?: TagFacet[];
  total: number;
}

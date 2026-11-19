/**
 * Authoritative operation catalog feed derivation + query helpers (C189 follow-up).
 *
 * The backend (`OperationFeedRepository`) keeps no second index: it derives a
 * bounded, deterministic feed fresh from the authoritative, versioned
 * `OPERATION_CATALOG` — the same static registry `POST /jobs` validates against
 * and `/operations/stats` aggregates — so the three views can never drift. The
 * catalog has no registration timestamp, so items are ordered ascending by
 * `(title, operation_id)` for a stable cross-backend sequence. Provider bindings
 * are sorted and deduplicated so the wire shape is deterministic regardless of
 * how a future registry adapter orders them. Optional `streaming`/`provider_id`
 * filters narrow the derivation before `total` is counted.
 *
 * `lib/operationFeed` reproduces that derivation over the same catalog seeds so
 * mock mode stays at feature parity with live mode and the parity guard can
 * drive both transports over identical data. Invalid filter values and page
 * bounds use the shared 422 envelope, matching the router's query validation.
 */

import { ApiError } from "../api/client";
import type { OperationFeed, OperationFeedItem, OperationSpec } from "./types";

/** Optional filters/page bound mirrored from the authoritative `/operations/feed` endpoint. */
export interface OperationFeedOptions {
  readonly streaming?: boolean;
  readonly provider_id?: string;
  readonly limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Mirror the router's optional boolean `streaming`, string `provider_id` and
 * bounded `limit` validation so mock and live fail identically with the shared
 * error envelope.
 */
export function validateOperationFeedArgs(options: OperationFeedOptions = {}): void {
  if (options.streaming !== undefined && typeof options.streaming !== "boolean") {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid streaming filter.",
      details: [{ field: "streaming", message: "streaming must be a boolean" }],
    });
  }
  if (options.provider_id !== undefined && typeof options.provider_id !== "string") {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid provider id.",
      details: [{ field: "provider_id", message: "provider_id must be a string" }],
    });
  }
  if (
    options.limit !== undefined &&
    (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > MAX_LIMIT)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Feed limit must be between 1 and 200.",
      details: [{ field: "limit", message: "limit must be between 1 and 200" }],
    });
  }
}

/** Python-compatible ascending `(title, operation_id)` comparison. */
function compareByTitle(a: OperationFeedItem, b: OperationFeedItem): number {
  if (a.title !== b.title) return a.title < b.title ? -1 : 1;
  if (a.operation_id !== b.operation_id) return a.operation_id < b.operation_id ? -1 : 1;
  return 0;
}

/**
 * Derive the feed exactly as the backend repository does: project each operation
 * with sorted/deduplicated provider bindings, filter by the declared streaming
 * flag / provider bindings, sort by ascending `(title, operation_id)` and apply
 * the `limit` page. `total` counts the whole filtered feed before paging; an
 * empty scope yields an empty feed (never an error).
 */
export function deriveOperationFeed(
  operations: readonly OperationSpec[],
  now: string,
  options: OperationFeedOptions = {},
): OperationFeed {
  const { limit = DEFAULT_LIMIT } = options;
  const items: OperationFeedItem[] = operations
    .filter((spec) => {
      if (options.streaming !== undefined && (spec.streaming ?? false) !== options.streaming) {
        return false;
      }
      const providers = [...new Set(spec.provider_ids ?? [])].sort();
      return options.provider_id === undefined || providers.includes(options.provider_id);
    })
    .map((spec) => {
      const provider_ids = [...new Set(spec.provider_ids ?? [])].sort();
      return {
        operation_id: spec.id,
        title: spec.title,
        description: spec.description,
        schema_version: spec.schema_version,
        input_types: spec.input?.asset_types ?? [],
        output_types: spec.output?.asset_types ?? [],
        settings_count: spec.settings?.length ?? 0,
        streaming: spec.streaming ?? false,
        provider_ids,
        provider_count: provider_ids.length,
      };
    });
  items.sort(compareByTitle);
  return { items: items.slice(0, limit), total: items.length, generated_at: now };
}

/** Query-string values for the live `/operations/feed` request. */
export function operationFeedQueryParams(
  options: OperationFeedOptions = {},
): Record<string, string | number | boolean | undefined> {
  return { streaming: options.streaming, provider_id: options.provider_id, limit: options.limit };
}

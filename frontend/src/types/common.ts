/**
 * Shared primitives used across API domains.
 *
 * Mirrors backend/app/schemas/common.py — keep both sides in sync. Parity is
 * enforced by backend/tests/test_contract_parity.py.
 */

/** Bumped whenever a shared contract changes in a backwards-incompatible way. */
export const API_VERSION = "v1";

/** Prefix every REST path is mounted under, e.g. "/api/v1/health". */
export const API_PREFIX = "/api/v1";

/** ISO-8601 UTC timestamp, e.g. "2026-01-01T00:00:00Z". */
export type Timestamp = string;

/** UUID v4-style string identifier. */
export type Uuid = string;

/** Free-form JSON-compatible metadata bag. */
export type Metadata = Record<string, unknown>;

/** Same rule the backend applies to `Email` fields. */
export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type Email = string;

/** Explicit empty payload (never `null`) for responses with no body. */
export interface Empty {
  // intentionally empty — presence of the type signals "no body"
}

export interface ErrorDetail {
  field?: string | null;
  message: string;
}

/** Machine-readable error envelope returned for every non-2xx response. */
export interface ErrorBody {
  code: string;
  message: string;
  details?: ErrorDetail[];
  request_id?: string | null;
}

export interface ErrorResponse {
  error: ErrorBody;
}

/** Cursor pagination envelope info. */
export interface PageInfo {
  limit: number;
  next_cursor?: string | null;
  has_more?: boolean;
}

export type HealthStatus = "ok" | "degraded" | "down";

export interface HealthResponse {
  status: HealthStatus;
  version: string;
}

export interface VersionResponse {
  api_version: string;
  build: string;
}

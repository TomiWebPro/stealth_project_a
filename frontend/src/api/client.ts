/**
 * Transport layer for the Studio Platform API.
 *
 * Everything in `src/api` goes through this module. It owns:
 *  - base URL / prefix handling
 *  - auth token injection
 *  - error normalization into `ApiError` (using the shared `ErrorResponse`)
 *  - request cancellation and idempotency headers
 *
 * No resource module talks to `fetch` directly.
 */

import { API_PREFIX } from "../types/common";
import type { ErrorDetail, ErrorResponse } from "../types/common";

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Query string parameters. `null`/`undefined` values are dropped. */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** JSON body. Mutually exclusive with `signal`-style raw bodies. */
  body?: unknown;
  /** Extra headers merged after defaults. */
  headers?: Record<string, string>;
  /** Replace the default access-token header (e.g. for refresh calls). */
  auth?: boolean;
  /** Idempotency key for safe retries of mutating requests. */
  idempotencyKey?: string;
  /** Propagate cancellation from callers. */
  signal?: AbortSignal;
}

/** Shape of the fetch-like function the client depends on (injectable for tests). */
export type FetchLike = typeof fetch;

export interface ApiClientConfig {
  /** Origin of the backend, e.g. "http://127.0.0.1:8000". Defaults to same-origin. */
  baseUrl?: string;
  /** API path prefix. Defaults to `API_PREFIX` from the shared contracts. */
  prefix?: string;
  /** Returns the current bearer token, if present. */
  getAccessToken?: () => string | null | undefined;
  /** Injectable fetch implementation (defaults to global fetch). */
  fetchImpl?: FetchLike;
  /** Invoked when the backend rejects the request; useful for token refresh. */
  onUnauthorized?: () => void;
}

/** Normalized error thrown for every non-2xx response or transport failure. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ErrorDetail[];
  readonly requestId: string | null;

  constructor(
    init:
      | {
          status: number;
          code: string;
          message: string;
          details?: ErrorDetail[];
          requestId?: string | null;
        }
      | string,
    options?: { status: number; code: string },
  ) {
    if (typeof init === "string") {
      super(init);
      this.name = "ApiError";
      this.status = options?.status ?? 0;
      this.code = options?.code ?? "unknown";
      this.details = [];
      this.requestId = null;
      return;
    }
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.requestId = init.requestId ?? null;
  }
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }
  const body = (value as { error?: unknown }).error;
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { code?: unknown }).code === "string" &&
    typeof (body as { message?: unknown }).message === "string"
  );
}

function buildQuery(
  query: RequestOptions["query"],
): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue;
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export class ApiClient {
  readonly baseUrl: string;
  readonly prefix: string;
  private readonly getAccessToken: () => string | null | undefined;
  private readonly fetchImpl: FetchLike;
  private readonly onUnauthorized: (() => void) | undefined;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = (config.baseUrl ?? "").replace(/\/+$/, "");
    this.prefix = config.prefix ?? API_PREFIX;
    this.getAccessToken = config.getAccessToken ?? (() => null);
    this.fetchImpl = config.fetchImpl ?? ((...args) => fetch(...args));
    this.onUnauthorized = config.onUnauthorized;
  }

  /**
   * Perform a request and return the parsed JSON body.
   * Pass `void` as `T` for 204 No Content responses.
   */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${this.prefix}${path}${buildQuery(options.query)}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...options.headers,
    };

    const token = this.getAccessToken();
    if (options.auth !== false && token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }

    let body: string | undefined;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: options.method ?? "GET",
        headers,
        body,
        signal: options.signal,
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        throw cause;
      }
      throw new ApiError({
        status: 0,
        code: "network_error",
        message: cause instanceof Error ? cause.message : "Network request failed",
      });
    }

    if (response.status === 401) {
      this.onUnauthorized?.();
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const raw = await response.text();
    const parsed: unknown = raw ? safeJsonParse(raw) : undefined;

    if (!response.ok) {
      if (isErrorResponse(parsed)) {
        throw new ApiError({
          status: response.status,
          code: parsed.error.code,
          message: parsed.error.message,
          details: parsed.error.details,
          requestId: parsed.error.request_id,
        });
      }
      throw new ApiError({
        status: response.status,
        code: `http_${response.status}`,
        message: response.statusText || "Request failed",
      });
    }

    return parsed as T;
  }

  get<T>(path: string, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(path, { ...options, method: "POST", body });
  }

  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(path, { ...options, method: "PATCH", body });
  }

  put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(path, { ...options, method: "PUT", body });
  }

  delete<T>(path: string, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }

  /**
   * Absolute WebSocket URL for an event stream (notifications, chat deltas).
   * The path is passed relative to the API prefix, e.g. "/jobs/{id}/events".
   */
  websocketUrl(path: string): string {
    const base = this.baseUrl || globalThis.location?.origin || "";
    const wsBase = base.replace(/^http/, "ws");
    return `${wsBase}${this.prefix}${path}`;
  }
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

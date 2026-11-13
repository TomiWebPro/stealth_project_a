/**
 * Environment-derived configuration.
 *
 * Kept in one place so the rest of the app never reads `import.meta.env`
 * directly. Values are validated/coerced here and have safe defaults for
 * local development.
 */

export type ApiMode = "mock" | "live";

function readApiMode(value: string | undefined): ApiMode {
  return value === "live" ? "live" : "mock";
}

export const env = {
  /** `VITE_API_MODE=live` switches the client to real HTTP requests. */
  apiMode: readApiMode(import.meta.env.VITE_API_MODE),
  /** Base URL used when `apiMode` is `live`. */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1",
  /** Simulated latency for mock responses, in milliseconds. */
  mockLatencyMs: 300,
} as const;

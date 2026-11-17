import { env, type ApiMode } from "../../lib/env";
import type { Provider } from "../../lib/types";
import { providerLocationLabel } from "../providers/helpers";

/** Editable settings draft (runtime client reconfiguration is not yet wired). */
export interface SettingsDraft {
  readonly apiMode: ApiMode;
  readonly apiBaseUrl: string;
  readonly connectionEnabled: Readonly<Record<string, boolean>>;
}

export interface ConnectionRow {
  readonly id: string;
  readonly name: string;
  readonly locationLabel: string;
  readonly status: Provider["status"];
  readonly enabled: boolean;
}

export type TestResult =
  | { readonly kind: "idle" }
  | { readonly kind: "testing" }
  | { readonly kind: "success"; readonly count: number }
  | { readonly kind: "error"; readonly message: string };

/** Initial draft mirrors build-time environment configuration. */
export function draftFromEnv(): SettingsDraft {
  return {
    apiMode: env.apiMode,
    apiBaseUrl: env.apiBaseUrl,
    connectionEnabled: {},
  };
}

export function validateBaseUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "Base URL is required.";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Base URL must use http or https.";
    }
    return null;
  } catch {
    return "Enter a valid absolute URL (e.g. http://localhost:8000/api/v1).";
  }
}

export function connectionRows(
  providers: readonly Provider[],
  enabled: Readonly<Record<string, boolean>>,
): readonly ConnectionRow[] {
  return providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    locationLabel: providerLocationLabel(provider.location),
    status: provider.status,
    enabled: enabled[provider.id] ?? provider.status === "available",
  }));
}

export function connectionSummary(rows: readonly ConnectionRow[]): string {
  if (rows.length === 0) return "No providers registered";
  const active = rows.filter((row) => row.enabled).length;
  return `${active} of ${rows.length} provider${rows.length === 1 ? "" : "s"} enabled`;
}

export function testResultMessage(result: TestResult): string {
  switch (result.kind) {
    case "idle":
      return "No connection test has been run yet.";
    case "testing":
      return "Testing connection…";
    case "success":
      return `Connection OK — ${result.count} provider${result.count === 1 ? "" : "s"} reachable.`;
    case "error":
      return `Connection failed: ${result.message}`;
  }
}

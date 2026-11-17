import { useState } from "react";
import { useProviders } from "../../hooks/useQueries";
import { env } from "../../lib/env";
import { errorMessage } from "../../lib/errors";
import { PageHeader } from "../../layout/AppLayout";
import { useSettingsStore } from "../../stores/settingsStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { providerStatusTone } from "../providers/helpers";
import {
  connectionRows,
  connectionSummary,
  testResultMessage,
  validateBaseUrl,
  type TestResult,
} from "./settingsHelpers";

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle";

function ConnectionCard() {
  const draft = useSettingsStore((state) => state.draft);
  const saved = useSettingsStore((state) => state.saved);
  const setApiMode = useSettingsStore((state) => state.setApiMode);
  const setBaseUrl = useSettingsStore((state) => state.setBaseUrl);
  const save = useSettingsStore((state) => state.save);
  const reset = useSettingsStore((state) => state.reset);
  const urlError = validateBaseUrl(draft.apiBaseUrl);

  return (
    <Card>
      <div className="p-4">
        <SectionHeader
          title="Backend connection"
          description="Active build-time configuration and an editable session draft."
        />
      </div>
      <div className="grid gap-6 border-t border-line p-4 lg:grid-cols-2">
        <section aria-label="Active configuration" className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-content-muted">Active API mode</span>
            <Badge tone={env.apiMode === "live" ? "success" : "accent"}>{env.apiMode}</Badge>
          </div>
          <div>
            <p className="text-xs text-content-muted">Active backend URL</p>
            <p className="break-all font-mono text-xs text-content">{env.apiBaseUrl}</p>
          </div>
          <p className="text-2xs leading-relaxed text-content-subtle">
            Mode and URL come from build-time env vars. Editing here stores a local draft;
            applying it at runtime needs a client switcher (tracked in the backlog).
          </p>
        </section>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (urlError === null) save();
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-content-muted">
            API mode (draft)
            <select
              className={inputClass}
              value={draft.apiMode}
              onChange={(event) => setApiMode(event.target.value as "mock" | "live")}
            >
              <option value="mock">mock</option>
              <option value="live">live</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-content-muted">
            Backend URL (draft)
            <input
              className={inputClass}
              value={draft.apiBaseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              aria-invalid={urlError !== null}
            />
          </label>
          {urlError ? (
            <p className="text-xs text-danger" role="alert">
              {urlError}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={urlError !== null}>
              Save draft
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              Reset
            </Button>
            {saved && urlError === null ? (
              <span className="text-xs text-success" role="status">
                Draft saved this session
              </span>
            ) : null}
          </div>
        </form>
      </div>
    </Card>
  );
}

function TestConnectionCard() {
  const providersQuery = useProviders();
  const [result, setResult] = useState<TestResult>({ kind: "idle" });

  async function runTest() {
    setResult({ kind: "testing" });
    const response = await providersQuery.refetch();
    if (response.error) {
      setResult({ kind: "error", message: errorMessage(response.error) });
    } else {
      setResult({ kind: "success", count: response.data?.length ?? 0 });
    }
  }

  const tone =
    result.kind === "success"
      ? "text-success"
      : result.kind === "error"
        ? "text-danger"
        : "text-content-muted";

  return (
    <Card className="p-4">
      <SectionHeader
        title="Connection test"
        description="Re-fetches the provider registry through the active ApiClient."
        action={
          <Button
            variant="secondary"
            size="sm"
            disabled={result.kind === "testing"}
            onClick={() => void runTest()}
          >
            {result.kind === "testing" ? "Testing…" : "Test connection"}
          </Button>
        }
      />
      <p className={`mt-3 text-xs ${tone}`} role="status" aria-live="polite">
        {testResultMessage(result)}
      </p>
    </Card>
  );
}

function ProviderConnectionsCard() {
  const { data, isPending, isError, error, refetch } = useProviders();
  const enabled = useSettingsStore((state) => state.draft.connectionEnabled);
  const toggleConnection = useSettingsStore((state) => state.toggleConnection);
  const rows = connectionRows(data ?? [], enabled);

  return (
    <Card>
      <div className="p-4">
        <SectionHeader
          title="Provider connections"
          description={connectionSummary(rows)}
          action={
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Refresh
            </Button>
          }
        />
      </div>
      {isPending ? (
        <div className="space-y-2 border-t border-line p-4" aria-busy="true" aria-label="Loading provider connections">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : null}
      {isError ? (
        <div className="border-t border-line p-4">
          <EmptyState
            title="Could not load providers"
            description={errorMessage(error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        </div>
      ) : null}
      {data ? (
        rows.length === 0 ? (
          <div className="border-t border-line p-4">
            <EmptyState title="No providers" description="No connections are registered in the current data." />
          </div>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-content">{row.name}</p>
                  <p className="truncate text-xs text-content-muted">
                    {row.locationLabel} · {row.id}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={providerStatusTone(row.status)}>{row.status}</Badge>
                  <label className="flex items-center gap-2 text-xs text-content-muted">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(event) => toggleConnection(row.id, event.target.checked)}
                      className="size-4 accent-accent"
                    />
                    Enabled
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </Card>
  );
}

export function SettingsScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Backend URL, API mode, provider connections, and a live connection test."
      />
      <ConnectionCard />
      <TestConnectionCard />
      <ProviderConnectionsCard />
    </div>
  );
}

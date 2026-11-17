import { useMemo, useState } from "react";
import { useCapabilities } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { deriveAudioCapability, parseDialogueScript } from "./audioHelpers";

/** Capability-gated dialogue/TTS panel. The form renders only when a provider
 * advertises an available audio operation; otherwise the gate explains why. */
export function AudioPanel() {
  const capabilitiesQuery = useCapabilities();
  const [script, setScript] = useState("Mara: We should check the last frame.\nDirector: Approved for publish.");
  const [queued, setQueued] = useState(false);

  const capability = useMemo(
    () => deriveAudioCapability(capabilitiesQuery.data ?? []),
    [capabilitiesQuery.data],
  );
  const lines = useMemo(() => parseDialogueScript(script), [script]);

  return (
    <Card>
      <div className="p-4">
        <SectionHeader
          title="Audio & dialogue"
          description="TTS and dialogue hooks, enabled only when a provider advertises audio operations."
          action={<Badge tone={capability.tone}>{capability.enabled ? "available" : "disabled"}</Badge>}
        />
      </div>
      <div className="border-t border-line p-4">
        {capabilitiesQuery.isPending ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading audio capabilities">
            <Skeleton className="h-8" />
            <Skeleton className="h-20" />
          </div>
        ) : null}
        {capabilitiesQuery.isError ? (
          <EmptyState
            title="Could not check audio capability"
            description={errorMessage(capabilitiesQuery.error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void capabilitiesQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : null}
        {capabilitiesQuery.data ? (
          capability.enabled ? (
            <div className="space-y-3">
              <p className="text-xs text-content-muted">{capability.label}</p>
              <label className="flex flex-col gap-1 text-xs text-content-muted">
                Dialogue script (one speaker per line)
                <textarea
                  value={script}
                  onChange={(event) => {
                    setScript(event.target.value);
                    setQueued(false);
                  }}
                  rows={3}
                  className="w-full resize-none rounded-md border border-line bg-surface px-3 py-2 text-sm text-content"
                />
              </label>
              <ul className="space-y-1">
                {lines.length === 0 ? (
                  <li className="text-xs text-content-subtle">No dialogue lines to synthesize.</li>
                ) : (
                  lines.map((line) => (
                    <li key={line.id} className="flex gap-2 text-xs">
                      <Badge tone="accent">{line.speaker}</Badge>
                      <span className="text-content-muted">{line.text}</span>
                    </li>
                  ))
                )}
              </ul>
              <Button variant="primary" size="sm" disabled={lines.length === 0} onClick={() => setQueued(true)}>
                Queue synthesis
              </Button>
              {queued ? (
                <p className="text-xs text-success" role="status">
                  {lines.length} line{lines.length === 1 ? "" : "s"} staged for synthesis (audio jobs pending backend hookup).
                </p>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="Audio capability is off"
              description={`${capability.label}. Connect a TTS/dialogue provider to enable this panel.`}
            />
          )
        ) : null}
      </div>
    </Card>
  );
}

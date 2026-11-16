import type { Asset } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState } from "../../ui/Feedback";
import { buildVersionChains, publishReceiptSummary, versionLabel } from "./versionHelpers";

interface VersionPanelProps {
  readonly assets: readonly Asset[];
}

export function VersionPanel({ assets }: VersionPanelProps) {
  const chains = buildVersionChains(assets);
  return (
    <Card>
      <div className="p-4">
        <SectionHeader
          title="Versions"
          description="Ver_NNN chain list with publish ceremony details (comment, publisher, sidecar) derived from metadata and storage keys."
        />
      </div>
      {chains.length === 0 ? (
        <div className="border-t border-line p-4">
          <EmptyState
            title="No versioned assets"
            description="No assets with Ver_NNN markers or publish receipts were found."
          />
        </div>
      ) : (
        <div className="space-y-4 border-t border-line p-4">
          {chains.map((chain) => (
            <section key={chain.key} aria-label={`${chain.label} version chain`}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-content">{chain.label}</h3>
                <Badge tone="info">{`${chain.entries.length} version${chain.entries.length === 1 ? "" : "s"}`}</Badge>
              </div>
              <ul className="space-y-2">
                {chain.entries.map((entry) => (
                  <li key={entry.asset.id} className="rounded-md border border-line bg-surface-raised p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-content">{versionLabel(entry.asset)}</p>
                        <p className="truncate text-xs text-content-muted" title={entry.asset.name}>{entry.asset.name}</p>
                        <p className="truncate text-2xs text-content-subtle" title={entry.asset.storage.key}>{entry.asset.storage.key}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={entry.kind === "publish" ? "success" : "neutral"}>
                          {entry.kind === "publish" ? "Publish" : "Output"}
                        </Badge>
                        <Badge tone="neutral">{entry.asset.type}</Badge>
                      </div>
                    </div>
                    {entry.receipt ? (
                      <div className="mt-2 space-y-1 rounded bg-surface-overlay p-2 text-xs text-content-muted">
                        <p><span className="font-medium text-content">Publish ceremony</span></p>
                        <p>Comment: {entry.receipt.comment}</p>
                        <p>Publisher: {entry.receipt.publisher}</p>
                        <p className="truncate" title={entry.receipt.sidecar}>Sidecar: {entry.receipt.sidecar}</p>
                      </div>
                    ) : publishReceiptSummary(entry.asset) ? (
                      <p className="mt-2 text-xs text-content-muted">{publishReceiptSummary(entry.asset)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}

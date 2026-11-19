import { useState } from "react";
import { useUpdateAsset } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { Asset } from "../../lib/types";
import { useAssetEditStore } from "../../stores/assetEditStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import {
  applyAssetEdit,
  draftFromAsset,
  draftHasChanges,
  metadataFromLines,
  metadataToLines,
  parseTagsInput,
  provenanceFields,
  storageFields,
  tagsToInput,
} from "./detailHelpers";
import { assetPreviewUrl, assetTypeTone } from "./helpers";
import { AssetImpactPanel } from "../impact/AssetImpactPanel";

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle";

interface AssetDetailPanelProps {
  readonly asset: Asset;
  /** Siblings used to resolve downstream-impact descendant ids to names. */
  readonly assets?: readonly Asset[];
}

/**
 * Asset detail + metadata editor. Edits persist through `useUpdateAsset`
 * (PATCH /assets/{id}) and are also cached in a session store so the form keeps
 * its values while other asset queries refetch.
 */
export function AssetDetailPanel({ asset, assets }: AssetDetailPanelProps) {
  const edit = useAssetEditStore((state) => state.edits[asset.id]);
  const setEdit = useAssetEditStore((state) => state.setEdit);
  const clearEdit = useAssetEditStore((state) => state.clearEdit);
  const updateAsset = useUpdateAsset();

  const original = draftFromAsset(asset);
  const effective = applyAssetEdit(asset, edit);
  const effectiveDraft = draftFromAsset(effective);

  const [name, setName] = useState(effectiveDraft.name);
  const [tags, setTags] = useState(tagsToInput(effectiveDraft.tags));
  const [metadata, setMetadata] = useState(metadataToLines(effectiveDraft.metadata));
  const [saved, setSaved] = useState(false);

  const currentDraft = {
    name,
    tags: parseTagsInput(tags),
    metadata: metadataFromLines(metadata),
  };
  const dirty = draftHasChanges(currentDraft, original);

  function handleSave() {
    updateAsset.mutate(
      {
        assetId: asset.id,
        body: { name: currentDraft.name, tags: [...currentDraft.tags], metadata: currentDraft.metadata },
      },
      {
        onSuccess: () => {
          setEdit(asset.id, currentDraft);
          setSaved(true);
        },
      },
    );
  }

  function handleReset() {
    clearEdit(asset.id);
    setName(original.name);
    setTags(tagsToInput(original.tags));
    setMetadata(metadataToLines(original.metadata));
    setSaved(false);
  }

  const preview = assetPreviewUrl(effective);
  const provenance = provenanceFields(effective);
  const storage = storageFields(effective);

  return (
    <div className="space-y-4">
    <Card>
      <div className="p-4">
        <SectionHeader
          title="Asset details"
          description="View provenance and edit name, tags, and metadata through the assets API."
        />
      </div>
      <div className="grid gap-6 border-t border-line p-4 lg:grid-cols-2">
        <section aria-label="Asset summary" className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-20 w-28 shrink-0 overflow-hidden rounded bg-surface-overlay">
              {preview ? (
                <img src={preview} alt={effective.name} className="size-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-content">{effective.name}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge tone={assetTypeTone(effective.type)}>{effective.type}</Badge>
                {effective.status ? <Badge tone="neutral">{effective.status}</Badge> : null}
                {typeof effective.version === "number" ? (
                  <Badge tone="info">{`v${effective.version}`}</Badge>
                ) : null}
              </div>
            </div>
          </div>

          <dl className="space-y-2 text-xs">
            {storage.map((field) => (
              <div key={field.label} className="flex justify-between gap-3">
                <dt className="shrink-0 text-content-muted">{field.label}</dt>
                <dd className="truncate text-right text-content" title={field.value}>
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>

          {provenance.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-content-muted">Provenance</p>
              <dl className="space-y-2 text-xs">
                {provenance.map((field) => (
                  <div key={field.label} className="flex justify-between gap-3">
                    <dt className="shrink-0 text-content-muted">{field.label}</dt>
                    <dd className="truncate text-right text-content" title={field.value}>
                      {field.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="text-xs text-content-subtle">No provenance recorded for this asset.</p>
          )}
        </section>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            handleSave();
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-content-muted">
            Name
            <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-content-muted">
            Tags (comma separated)
            <input className={inputClass} value={tags} onChange={(event) => setTags(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-content-muted">
            Metadata (one <code>key: value</code> per line)
            <textarea
              className={`${inputClass} min-h-32 font-mono text-2xs`}
              value={metadata}
              onChange={(event) => setMetadata(event.target.value)}
            />
          </label>
          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={!dirty || updateAsset.isPending}>
              {updateAsset.isPending ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={!dirty && !edit}>
              Discard
            </Button>
            {saved && !dirty ? (
              <span className="text-xs text-success" role="status">
                Saved
              </span>
            ) : null}
          </div>
          {updateAsset.isError ? (
            <p className="text-xs text-danger" role="alert">
              {errorMessage(updateAsset.error)}
            </p>
          ) : null}
          <p className="text-2xs leading-relaxed text-content-subtle">
            Changes are persisted with PATCH /assets/{`{id}`} and reflected across all asset views.
          </p>
        </form>
      </div>
    </Card>
    <AssetImpactPanel assetId={asset.id} assets={assets} />
    </div>
  );
}

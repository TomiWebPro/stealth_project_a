import type { Asset, Metadata } from "../../lib/types";

/** An editable snapshot of the user-owned fields of an asset. */
export interface AssetDraft {
  readonly name: string;
  readonly tags: readonly string[];
  readonly metadata: Metadata;
}

/** A local (session-scoped) edit to an asset, keyed by asset id in the store. */
export interface AssetEdit {
  readonly name?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Metadata;
}

export function draftFromAsset(asset: Asset): AssetDraft {
  return {
    name: asset.name,
    tags: [...(asset.tags ?? [])],
    metadata: { ...(asset.metadata ?? {}) },
  };
}

/** Merge a local edit onto the authoritative asset to derive the displayed value. */
export function applyAssetEdit(asset: Asset, edit: AssetEdit | undefined): Asset {
  if (!edit) return asset;
  return {
    ...asset,
    name: edit.name ?? asset.name,
    tags: edit.tags ? [...edit.tags] : asset.tags,
    metadata: edit.metadata ? { ...edit.metadata } : asset.metadata,
  };
}

export function tagsToInput(tags: readonly string[]): string {
  return tags.join(", ");
}

export function parseTagsInput(input: string): readonly string[] {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Flatten a metadata bag to stable, sortable `key: value` lines for editing.
 * Complex values are JSON-stringified so round-trips preserve structure.
 */
export function metadataToLines(metadata: Metadata): string {
  return Object.keys(metadata)
    .sort()
    .map((key) => {
      const value = metadata[key];
      const rendered = typeof value === "string" ? value : JSON.stringify(value);
      return `${key}: ${rendered ?? ""}`;
    })
    .join("\n");
}

export function metadataFromLines(text: string): Metadata {
  const result: Metadata = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    if (key.length === 0) continue;
    result[key] = coerceMetadataValue(rawValue);
  }
  return result;
}

function coerceMetadataValue(raw: string): unknown {
  if (raw.length === 0) return "";
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "number" || typeof parsed === "boolean" || isPlainObject(parsed) || Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Not JSON — treat as a plain string below.
  }
  return raw;
}

export interface DetailField {
  readonly label: string;
  readonly value: string;
}

/** Human-readable provenance rows for the detail panel (derived, never inline). */
export function provenanceFields(asset: Asset): readonly DetailField[] {
  const provenance = asset.provenance;
  if (!provenance) return [];
  const fields: DetailField[] = [];
  if (provenance.operation_id) fields.push({ label: "Operation", value: provenance.operation_id });
  if (provenance.prompt) fields.push({ label: "Prompt", value: provenance.prompt });
  if (provenance.provider_id) fields.push({ label: "Provider", value: provenance.provider_id });
  if (provenance.workflow) fields.push({ label: "Workflow", value: provenance.workflow });
  if (provenance.job_id) fields.push({ label: "Job", value: provenance.job_id });
  return fields;
}

export function storageFields(asset: Asset): readonly DetailField[] {
  return [
    { label: "Key", value: asset.storage.key },
    { label: "Size", value: `${asset.storage.size_bytes.toLocaleString()} bytes` },
    { label: "Content type", value: asset.storage.content_type },
  ];
}

export function draftHasChanges(draft: AssetDraft, original: AssetDraft): boolean {
  if (draft.name.trim() !== original.name) return true;
  if (parseTagsInput(tagsToInput(draft.tags)).join("\u0000") !== original.tags.join("\u0000")) return true;
  return JSON.stringify(draft.metadata) !== JSON.stringify(original.metadata);
}

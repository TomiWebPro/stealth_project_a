import type { Extension } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";

// Derived from the single re-exported contract so this feature stays within the
// UI-facing type surface (lib/types does not re-export these two aliases).
type ExtensionStatus = Extension["status"];
type ExtensionType = Extension["manifest"]["type"];

export interface ExtensionCard {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly publisher: string;
  readonly type: ExtensionType;
  readonly status: ExtensionStatus;
  readonly statusTone: BadgeTone;
  readonly permissions: readonly string[];
  readonly capabilities: readonly string[];
  readonly providerIds: readonly string[];
  readonly uiContributions: readonly string[];
  readonly dependencies: readonly string[];
  readonly trusted: boolean;
}

const STATUS_TONE: Readonly<Record<ExtensionStatus, BadgeTone>> = {
  enabled: "success",
  installed: "info",
  disabled: "neutral",
  update_available: "warning",
};

/** Badge tone shared by registry cards and the authoritative stats panel. */
export function extensionStatusTone(status: ExtensionStatus): BadgeTone {
  return STATUS_TONE[status];
}

export function buildExtensionCards(extensions: readonly Extension[]): readonly ExtensionCard[] {
  return extensions.map((extension) => {
    const manifest = extension.manifest;
    const requirements = manifest.requirements;
    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      publisher: manifest.publisher,
      type: manifest.type,
      status: extension.status,
      statusTone: extensionStatusTone(extension.status),
      permissions: (requirements.permissions ?? []).map((permission) => permission.name),
      capabilities: requirements.capabilities ?? [],
      providerIds: requirements.provider_ids ?? [],
      uiContributions: manifest.ui_contributions ?? [],
      dependencies: (manifest.dependencies ?? []).map(
        (dependency) => `${dependency.extension_id}@${dependency.version_range}`,
      ),
      trusted: extension.signed === true && extension.verified === true,
    };
  });
}

export function extensionSummary(cards: readonly ExtensionCard[]): string {
  if (cards.length === 0) return "No extensions registered";
  const enabled = cards.filter((card) => card.status === "enabled").length;
  return `${cards.length} extension${cards.length === 1 ? "" : "s"} · ${enabled} enabled`;
}

export interface CodeExample {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly language: string;
  readonly code: string;
}

/** SDK + connector examples shipped as data, never embedded in JSX markup. */
export const SDK_EXAMPLES: readonly CodeExample[] = [
  {
    id: "manifest",
    title: "Minimal manifest",
    description: "Every connector declares an id, type, and the permissions it needs.",
    language: "json",
    code: `{
  "id": "my-studio-connector",
  "name": "My connector",
  "version": "0.1.0",
  "publisher": "Example Labs",
  "type": "provider",
  "requirements": {
    "app_versions": ">=0.1.0",
    "permissions": [{ "name": "jobs.submit" }],
    "capabilities": ["text-to-image"]
  }
}`,
  },
  {
    id: "connector",
    title: "Connector skeleton",
    description: "A provider connector implements the shared execution contract.",
    language: "typescript",
    code: `import type { ProviderConnector } from "@studio/sdk";

export const comfyConnector: ProviderConnector = {
  id: "comfy-local",
  async capabilities() {
    return [{ operation_id: "text-to-image", schema_versions: ["v1"] }];
  },
  async execute(request) {
    return submitJob({ ...request, provider_id: this.id });
  },
};`,
  },
  {
    id: "ui-contribution",
    title: "UI contribution",
    description: "Extensions may contribute named panels; navigation stays stable.",
    language: "json",
    code: `{
  "ui_contributions": ["asset.inspector", "jobs.toolbar"],
  "requirements": {
    "app_versions": ">=0.1.0",
    "permissions": [{ "name": "ui.panel" }]
  }
}`,
  },
];

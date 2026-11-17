/**
 * Display-model helpers for the Cmd/Ctrl+K quick finder (C23 follow-up).
 *
 * The palette combines two sources: the static navigation model (screens) and
 * ranked cross-domain matches from `useSearch` (projects/assets/conversations).
 * All display values and navigation targets are derived here so the component
 * stays a thin renderer and each mapping is unit-testable without React.
 */

import {
  NAV_GROUPS,
  type RouteId,
  type RouteLocation,
} from "../../navigation/routes";
import type { SearchResult, SearchResultKind } from "../../types";
import type { IconName } from "../../ui/Icon";

/** Where choosing an entry takes the user (deep link via the UI store). */
export interface QuickFinderNavigation {
  readonly route: RouteId;
  readonly params?: Omit<RouteLocation, "route">;
  /** Assets also scope the browser to the owning project before opening detail. */
  readonly assetsProjectId?: string;
}

/** One selectable row in the quick finder. */
export interface PaletteEntry {
  readonly key: string;
  readonly section: "Screens" | "Results";
  readonly label: string;
  /** Right-aligned muted context (nav group or entity subtitle). */
  readonly subtitle: string;
  readonly icon: IconName;
  readonly navigation: QuickFinderNavigation;
  /** Optional kind pill, used for cross-domain results. */
  readonly badge?: string;
}

const KIND_LABEL: Readonly<Record<SearchResultKind, string>> = {
  project: "Project",
  asset: "Asset",
  conversation: "Conversation",
};

const KIND_ICON: Readonly<Record<SearchResultKind, IconName>> = {
  project: "projects",
  asset: "assets",
  conversation: "chat",
};

/** Human label for a cross-domain result kind. */
export function resultKindLabel(kind: SearchResultKind): string {
  return KIND_LABEL[kind];
}

/** Named icon for a cross-domain result kind. */
export function resultIcon(kind: SearchResultKind): IconName {
  return KIND_ICON[kind];
}

/** Maps a ranked result to the route + deep-link params that open it. */
export function resultNavigation(result: SearchResult): QuickFinderNavigation {
  switch (result.kind) {
    case "project":
      return { route: "projects", params: { projectId: result.id } };
    case "asset":
      return {
        route: "assets",
        params: { assetId: result.id },
        assetsProjectId: result.project_id ?? undefined,
      };
    case "conversation":
      return { route: "chat", params: { conversationId: result.id } };
  }
}

/** Navigable screens whose label/description/id contains the trimmed query. */
export function screenEntries(query: string): readonly PaletteEntry[] {
  const q = query.trim().toLowerCase();
  const entries: PaletteEntry[] = [];
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      const hay = `${item.label} ${item.description} ${item.id}`.toLowerCase();
      if (q.length === 0 || hay.includes(q)) {
        entries.push({
          key: `screen:${item.id}`,
          section: "Screens",
          label: item.label,
          subtitle: group.label,
          icon: item.icon,
          navigation: { route: item.id },
        });
      }
    }
  }
  return entries;
}

/** Render-ready rows for a ranked search response (undefined = not loaded yet). */
export function resultEntries(
  results: readonly SearchResult[] | undefined,
): readonly PaletteEntry[] {
  if (!results) return [];
  return results.map((result) => ({
    key: `result:${result.kind}:${result.id}`,
    section: "Results",
    label: result.title,
    subtitle: result.subtitle?.trim() ?? "",
    icon: resultIcon(result.kind),
    navigation: resultNavigation(result),
    badge: resultKindLabel(result.kind),
  }));
}

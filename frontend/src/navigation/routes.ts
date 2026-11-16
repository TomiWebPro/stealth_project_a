/**
 * Navigation model and route definitions for the app shell.
 *
 * Routes are plain data (no router dependency yet) so the shell can render
 * navigation and resolve the active screen deterministically. Swap the
 * resolution helper for a real router without changing screens.
 */

export type RouteId =
  | "home"
  | "chat"
  | "projects"
  | "assets"
  | "jobs"
  | "workspaces"
  | "extensions"
  | "providers"
  | "settings";

export interface NavItem {
  readonly id: RouteId;
  readonly label: string;
  readonly description: string;
  /** Single-character glyph used until an icon set is adopted. */
  readonly glyph: string;
}

export interface NavGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly NavItem[];
}

export const DEFAULT_ROUTE: RouteId = "home";

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { id: "home", label: "Home", description: "Overview of your studio", glyph: "⌂" },
      { id: "chat", label: "Chat", description: "Conversational workspace", glyph: "✦" },
      { id: "projects", label: "Projects", description: "Organize production work", glyph: "▤" },
      { id: "assets", label: "Assets", description: "Library and lineage", glyph: "◈" },
      { id: "jobs", label: "Jobs", description: "Tasks and pipeline runs", glyph: "◷" },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    items: [
      { id: "workspaces", label: "Workspaces", description: "Shared team spaces", glyph: "⬡" },
      { id: "extensions", label: "Extensions", description: "Connectors and add-ons", glyph: "⌘" },
      { id: "providers", label: "Providers", description: "Local and cloud capabilities", glyph: "☁" },
      { id: "settings", label: "Settings", description: "Preferences and connections", glyph: "⚙" },
    ],
  },
];

const ROUTE_IDS: ReadonlySet<string> = new Set(
  NAV_GROUPS.flatMap((group) => group.items.map((item) => item.id)),
);

export function isRouteId(value: string): value is RouteId {
  return ROUTE_IDS.has(value);
}

/** Returns the nav item for a route, or `undefined` if it is not navigable. */
export function findNavItem(route: RouteId): NavItem | undefined {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.id === route) return item;
    }
  }
  return undefined;
}

/** Canonical URL path for a route (e.g. `home` -> `/home`). */
export function routeToPath(route: RouteId): string {
  return route === DEFAULT_ROUTE ? "/" : `/${route}`;
}

/** Resolves the current browser path back to a known route, defaulting safely. */
export function pathToRoute(pathname: string): RouteId {
  const segment = pathname.replace(/^\/+|\/+$/g, "");
  if (segment === "") return DEFAULT_ROUTE;
  return isRouteId(segment) ? segment : DEFAULT_ROUTE;
}

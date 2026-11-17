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

/** Route plus any entity id encoded as a path segment (History API deep links). */
export interface RouteLocation {
  readonly route: RouteId;
  readonly projectId?: string;
  readonly assetId?: string;
  readonly conversationId?: string;
}

/** Resolves a URL path into a route and optional entity id without a router lib.
 * Unknown routes and extra segments degrade safely to the default route. */
export function parseRoutePath(pathname: string): RouteLocation {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);
  const head = segments[0];
  const route: RouteId = head && isRouteId(head) ? head : DEFAULT_ROUTE;
  const id = segments[1];
  switch (route) {
    case "projects":
      return id ? { route, projectId: id } : { route };
    case "assets":
      return id ? { route, assetId: id } : { route };
    case "chat":
      return id ? { route, conversationId: id } : { route };
    default:
      return { route };
  }
}

/** Builds a canonical URL for a route, appending its entity id when present. */
export function buildRoutePath(route: RouteId, location: Omit<RouteLocation, "route"> = {}): string {
  const base = routeToPath(route);
  const id =
    route === "projects"
      ? location.projectId
      : route === "assets"
        ? location.assetId
        : route === "chat"
          ? location.conversationId
          : undefined;
  return id ? `${base.replace(/\/$/, "")}/${id}` : base;
}

/** Resolves the current browser path back to a known route, defaulting safely. */
export function pathToRoute(pathname: string): RouteId {
  return parseRoutePath(pathname).route;
}

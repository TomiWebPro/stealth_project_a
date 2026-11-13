import { create } from "zustand";
import {
  DEFAULT_ROUTE,
  pathToRoute,
  routeToPath,
  type RouteId,
} from "../navigation/routes";

interface UiState {
  /** Currently selected top-level route. */
  readonly activeRoute: RouteId;
  /** Whether the sidebar is collapsed to its icon rail. */
  readonly sidebarCollapsed: boolean;
  /** Navigates to a route, pushing a history entry and updating the URL. */
  readonly navigate: (route: RouteId) => void;
  /** Reflects a browser-driven (back/forward) path change without pushing. */
  readonly syncFromLocation: (pathname: string) => void;
  readonly toggleSidebar: () => void;
}

/**
 * Client-only UI state. Server data lives in TanStack Query; this store holds
 * ephemeral shell state (navigation, sidebar). Screens should read narrow
 * slices to avoid unnecessary re-renders.
 */
export const useUiStore = create<UiState>((set, get) => ({
  activeRoute:
    typeof window === "undefined"
      ? DEFAULT_ROUTE
      : pathToRoute(window.location.pathname),
  sidebarCollapsed: false,
  navigate: (route) => {
    if (route === get().activeRoute) return;
    set({ activeRoute: route });
    if (typeof window !== "undefined") {
      window.history.pushState({ route }, "", routeToPath(route));
    }
  },
  syncFromLocation: (pathname) => {
    const route = pathToRoute(pathname);
    if (route !== get().activeRoute) set({ activeRoute: route });
  },
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));

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
  /** Selected project for the project detail view (projects route). */
  readonly selectedProjectId: string | null;
  /** Selected project for the assets browser (assets route). */
  readonly assetsProjectId: string | null;
  /** Navigates to a route, pushing a history entry and updating the URL. */
  readonly navigate: (route: RouteId) => void;
  /** Reflects a browser-driven (back/forward) path change without pushing. */
  readonly syncFromLocation: (pathname: string) => void;
  readonly toggleSidebar: () => void;
  readonly selectProject: (projectId: string | null) => void;
  readonly setAssetsProjectId: (projectId: string | null) => void;
}

/**
 * Client-only UI state. Server data lives in TanStack Query; this store holds
 * ephemeral shell state (navigation, sidebar, selections). Screens should read
 * narrow slices to avoid unnecessary re-renders.
 */
export const useUiStore = create<UiState>((set, get) => ({
  activeRoute:
    typeof window === "undefined"
      ? DEFAULT_ROUTE
      : pathToRoute(window.location.pathname),
  sidebarCollapsed: false,
  selectedProjectId: null,
  assetsProjectId: null,
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
  selectProject: (projectId) => set({ selectedProjectId: projectId }),
  setAssetsProjectId: (projectId) => set({ assetsProjectId: projectId }),
}));

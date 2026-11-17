import { create } from "zustand";
import {
  DEFAULT_ROUTE,
  buildRoutePath,
  parseRoutePath,
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
  /** Selected conversation for the chat route (deep-linkable). */
  readonly selectedConversationId: string | null;
  /** Selected asset for the assets detail panel (deep-linkable). */
  readonly selectedAssetId: string | null;
  /** Navigates to a route, pushing a history entry and updating the URL. */
  readonly navigate: (route: RouteId, params?: RouteParams) => void;
  /** Reflects a browser-driven (back/forward) path change without pushing. */
  readonly syncFromLocation: (pathname: string) => void;
  readonly toggleSidebar: () => void;
  readonly selectProject: (projectId: string | null) => void;
  readonly setAssetsProjectId: (projectId: string | null) => void;
  readonly selectConversation: (conversationId: string | null) => void;
  readonly selectAsset: (assetId: string | null) => void;
}

type RouteParams = Parameters<typeof buildRoutePath>[1];

/** Replace (not push) the URL when an in-screen selection changes the deep link. */
function replacePath(path: string): void {
  if (typeof window !== "undefined") {
    window.history.replaceState({ route: path }, "", path);
  }
}

/**
 * Client-only UI state. Server data lives in TanStack Query; this store holds
 * ephemeral shell state (navigation, sidebar, selections). Entity selections
 * are mirrored into the URL as deep links and restored on load / back-forward.
 */
export const useUiStore = create<UiState>((set, get) => {
  const initial =
    typeof window === "undefined"
      ? { route: DEFAULT_ROUTE }
      : parseRoutePath(window.location.pathname);
  return {
    activeRoute: initial.route,
    sidebarCollapsed: false,
    selectedProjectId: initial.projectId ?? null,
    assetsProjectId: null,
    selectedConversationId: initial.conversationId ?? null,
    selectedAssetId: initial.assetId ?? null,
    navigate: (route, params) => {
      if (route === get().activeRoute && !params) return;
      set({
        activeRoute: route,
        selectedProjectId: params?.projectId ?? null,
        selectedConversationId: params?.conversationId ?? null,
        selectedAssetId: params?.assetId ?? null,
      });
      if (typeof window !== "undefined") {
        window.history.pushState({ route }, "", buildRoutePath(route, params));
      }
    },
    syncFromLocation: (pathname) => {
      const location = parseRoutePath(pathname);
      set({
        activeRoute: location.route,
        selectedProjectId: location.projectId ?? null,
        selectedConversationId: location.conversationId ?? null,
        selectedAssetId: location.assetId ?? null,
      });
    },
    toggleSidebar: () =>
      set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    selectProject: (projectId) => {
      set({ selectedProjectId: projectId });
      if (get().activeRoute === "projects") {
        replacePath(buildRoutePath("projects", { projectId: projectId ?? undefined }));
      }
    },
    setAssetsProjectId: (projectId) => set({ assetsProjectId: projectId }),
    selectConversation: (conversationId) => {
      set({ selectedConversationId: conversationId });
      if (get().activeRoute === "chat") {
        replacePath(buildRoutePath("chat", { conversationId: conversationId ?? undefined }));
      }
    },
    selectAsset: (assetId) => {
      set({ selectedAssetId: assetId });
      if (get().activeRoute === "assets") {
        replacePath(buildRoutePath("assets", { assetId: assetId ?? undefined }));
      }
    },
  };
});

import { create } from "zustand";
import type { AssetEdit } from "../features/assets/detailHelpers";

interface AssetEditState {
  /** Locally edited asset fields, keyed by asset id (session-scoped). */
  readonly edits: Readonly<Record<string, AssetEdit>>;
  /** Save/replace the local edit for an asset. */
  readonly setEdit: (assetId: string, edit: AssetEdit) => void;
  /** Discard the local edit for an asset, restoring authoritative data. */
  readonly clearEdit: (assetId: string) => void;
}

/**
 * Session-scoped asset metadata drafts. The contract-facing `ApiClient` has no
 * update method yet (backend exposes PATCH /assets/{id}, but `useQueries` does
 * not surface it), so edits are optimistic and local until that hook lands.
 * Keeping drafts in a store means they survive re-renders and refetches.
 */
export const useAssetEditStore = create<AssetEditState>((set) => ({
  edits: {},
  setEdit: (assetId, edit) =>
    set((state) => ({ edits: { ...state.edits, [assetId]: edit } })),
  clearEdit: (assetId) =>
    set((state) => {
      const edits = { ...state.edits };
      delete edits[assetId];
      return { edits };
    }),
}));

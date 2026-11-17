import { create } from "zustand";
import { draftFromEnv, type SettingsDraft } from "../features/settings/settingsHelpers";
import type { ApiMode } from "../lib/env";

interface SettingsState {
  readonly draft: SettingsDraft;
  readonly saved: boolean;
  readonly setApiMode: (mode: ApiMode) => void;
  readonly setBaseUrl: (url: string) => void;
  readonly toggleConnection: (providerId: string, enabled: boolean) => void;
  readonly save: () => void;
  readonly reset: () => void;
}

/**
 * Session-scoped settings draft. API mode and base URL are build-time env
 * values in `lib/env`, so edits are stored locally until a runtime client
 * switcher is added (tracked in the backlog). They are still validated and
 * reflected in the UI so the settings surface is usable today.
 */
export const useSettingsStore = create<SettingsState>((set) => ({
  draft: draftFromEnv(),
  saved: false,
  setApiMode: (apiMode) => set((state) => ({ draft: { ...state.draft, apiMode }, saved: false })),
  setBaseUrl: (apiBaseUrl) => set((state) => ({ draft: { ...state.draft, apiBaseUrl }, saved: false })),
  toggleConnection: (providerId, enabled) =>
    set((state) => ({
      draft: {
        ...state.draft,
        connectionEnabled: { ...state.draft.connectionEnabled, [providerId]: enabled },
      },
      saved: false,
    })),
  save: () => set({ saved: true }),
  reset: () => set({ draft: draftFromEnv(), saved: false }),
}));

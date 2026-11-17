import { create } from "zustand";
import type { Message } from "../lib/types";

interface ChatState {
  /** Locally appended messages, keyed by conversation id (session-scoped). */
  readonly optimistic: Readonly<Record<string, readonly Message[]>>;
  /** Append a message the user just sent (before a send mutation exists). */
  readonly appendMessage: (conversationId: string, message: Message) => void;
  /** Discard locally appended messages for a conversation. */
  readonly clearMessages: (conversationId: string) => void;
}

/**
 * Session-scoped optimistic chat messages. The ApiClient exposes read-only
 * conversation/message queries today; sending is staged locally until a
 * `sendMessage` mutation + stream are exposed (tracked in the backlog).
 */
export const useChatStore = create<ChatState>((set) => ({
  optimistic: {},
  appendMessage: (conversationId, message) =>
    set((state) => ({
      optimistic: {
        ...state.optimistic,
        [conversationId]: [...(state.optimistic[conversationId] ?? []), message],
      },
    })),
  clearMessages: (conversationId) =>
    set((state) => {
      const optimistic = { ...state.optimistic };
      delete optimistic[conversationId];
      return { optimistic };
    }),
}));

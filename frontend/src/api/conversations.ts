/** Conversation and message endpoints, including the chat event stream. */

import type {
  Conversation,
  ConversationCreate,
  Message,
  MessageCreate,
  StreamEvent,
  Uuid,
} from "../types";
import type { ApiClient } from "./client";

export function createConversationsApi(client: ApiClient) {
  return {
    list(projectId: Uuid): Promise<Conversation[]> {
      return client.get("/conversations", { query: { project_id: projectId } });
    },
    get(conversationId: Uuid): Promise<Conversation> {
      return client.get(`/conversations/${conversationId}`);
    },
    create(projectId: Uuid, body: ConversationCreate): Promise<Conversation> {
      return client.post(`/projects/${projectId}/conversations`, body);
    },
    listMessages(conversationId: Uuid, limit?: number): Promise<Message[]> {
      return client.get(`/conversations/${conversationId}/messages`, {
        query: { limit },
      });
    },
    sendMessage(conversationId: Uuid, body: MessageCreate): Promise<Message> {
      return client.post(`/conversations/${conversationId}/messages`, body);
    },
    /**
     * Open the streaming event channel for a conversation.
     * Recovery: pass the last observed `seq` via `resumeFrom` (see `StreamEvent`).
     */
    openStream(conversationId: Uuid, resumeFrom?: number): WebSocket {
      const suffix = resumeFrom === undefined ? "" : `?since=${resumeFrom}`;
      return new WebSocket(
        client.websocketUrl(`/conversations/${conversationId}/stream${suffix}`),
      );
    },
  };
}

/** Parse a raw WebSocket payload into a typed `StreamEvent`. */
export function parseStreamEvent(data: string): StreamEvent {
  return JSON.parse(data) as StreamEvent;
}

export type ConversationsApi = ReturnType<typeof createConversationsApi>;

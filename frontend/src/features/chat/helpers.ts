import type { Conversation, Message } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";

/** Display model for a conversation row, derived from the API contract. */
export interface ConversationRow {
  readonly id: string;
  readonly title: string;
  readonly messageCount: number;
  readonly updatedAt: string;
  readonly preview: string;
}

/** Display model for a rendered message bubble. */
export interface MessageRow {
  readonly id: string;
  readonly role: Message["role"];
  readonly content: string;
  readonly status: Message["status"];
  readonly createdAt: string;
  readonly isMine: boolean;
  readonly isStreaming: boolean;
  readonly tone: BadgeTone;
}

export function sortConversations(conversations: readonly Conversation[]): readonly Conversation[] {
  return [...conversations].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

function previewFor(updatedAt: string, count: number): string {
  return count === 0 ? "No messages yet" : `Updated ${updatedAt}`;
}

export function buildConversationRows(
  conversations: readonly Conversation[],
  lastMessageByConversation: Readonly<Record<string, string | undefined>>,
): readonly ConversationRow[] {
  return sortConversations(conversations).map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    messageCount: conversation.message_count ?? 0,
    updatedAt: conversation.updated_at,
    preview: lastMessageByConversation[conversation.id] ?? previewFor(conversation.updated_at, conversation.message_count ?? 0),
  }));
}

const ROLE_TONE: Readonly<Record<Message["role"], BadgeTone>> = {
  user: "accent",
  assistant: "info",
  system: "neutral",
  tool: "warning",
};

export function buildMessageRows(messages: readonly Message[]): readonly MessageRow[] {
  return [...messages]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      status: message.status,
      createdAt: message.created_at,
      isMine: message.role === "user",
      isStreaming: message.status === "streaming" || message.status === "pending",
      tone: ROLE_TONE[message.role],
    }));
}

export function mergeMessages(
  authoritative: readonly Message[],
  optimistic: readonly Message[],
): readonly Message[] {
  const seen = new Set(authoritative.map((message) => message.id));
  return [...authoritative, ...optimistic.filter((message) => !seen.has(message.id))];
}

export function conversationSummary(conversations: readonly Conversation[]): string {
  if (conversations.length === 0) return "No conversations";
  const total = conversations.reduce((sum, conversation) => sum + (conversation.message_count ?? 0), 0);
  return `${conversations.length} conversation${conversations.length === 1 ? "" : "s"} · ${total} message${total === 1 ? "" : "s"}`;
}

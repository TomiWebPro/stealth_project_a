import type { StreamEvent } from "./types";

/**
 * Transport-agnostic handle for a conversation event stream.
 *
 * Both the mock and live transports return this shape so hooks and screens can
 * consume streamed `StreamEvent`s without depending on WebSocket directly.
 * `onEvent` returns an unsubscribe function; `close` tears down the channel and
 * is safe to call more than once.
 */
export interface ConversationStream {
  onEvent(handler: (event: StreamEvent) => void): () => void;
  close(): void;
}

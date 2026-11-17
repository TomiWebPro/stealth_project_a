import { useMemo, useState, type FormEvent } from "react";
import {
  useConversations,
  useMessages,
  useProjects,
} from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { PageHeader } from "../../layout/AppLayout";
import { useChatStore } from "../../stores/chatStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { formatRelative } from "../home/format";
import {
  buildConversationRows,
  buildMessageRows,
  conversationSummary,
  mergeMessages,
} from "./helpers";

function ConversationList({
  projectId,
  selectedId,
  onSelect,
}: {
  readonly projectId: string;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}) {
  const conversationsQuery = useConversations(projectId);
  const rows = useMemo(
    () => buildConversationRows(conversationsQuery.data ?? [], {}),
    [conversationsQuery.data],
  );

  return (
    <Card className="flex min-h-0 flex-col overflow-hidden">
      <div className="border-b border-line p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-content-subtle">
          Conversations
        </p>
        {conversationsQuery.data ? (
          <p className="mt-1 text-2xs text-content-muted">{conversationSummary(conversationsQuery.data)}</p>
        ) : null}
      </div>
      {conversationsQuery.isPending ? (
        <div className="space-y-2 p-3" aria-busy="true" aria-label="Loading conversations">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : null}
      {conversationsQuery.isError ? (
        <div className="p-3">
          <EmptyState
            title="Could not load conversations"
            description={errorMessage(conversationsQuery.error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void conversationsQuery.refetch()}>
                Try again
              </Button>
            }
          />
        </div>
      ) : null}
      {conversationsQuery.data ? (
        rows.length === 0 ? (
          <div className="p-3">
            <EmptyState
              title="No conversations"
              description="Start a conversation for this project to see it here."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-y-auto">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onSelect(row.id)}
                  aria-current={selectedId === row.id ? "true" : undefined}
                  className={`w-full px-3 py-3 text-left transition-colors duration-(--duration-fast) hover:bg-surface-overlay ${
                    selectedId === row.id ? "bg-accent-muted" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-content">{row.title}</p>
                    <span className="shrink-0 text-2xs text-content-subtle">
                      {formatRelative(row.updatedAt)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-content-muted">{row.preview}</p>
                  <p className="mt-1 text-2xs text-content-subtle">{row.messageCount} messages</p>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </Card>
  );
}

function MessageThread({ conversationId }: { readonly conversationId: string }) {
  const messagesQuery = useMessages(conversationId);
  const optimistic = useChatStore((state) => state.optimistic[conversationId] ?? []);
  const appendMessage = useChatStore((state) => state.appendMessage);
  const [draft, setDraft] = useState("");

  const messages = useMemo(
    () => mergeMessages(messagesQuery.data ?? [], optimistic),
    [messagesQuery.data, optimistic],
  );
  const rows = useMemo(() => buildMessageRows(messages), [messages]);

  function handleSend(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (content.length === 0) return;
    appendMessage(conversationId, {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      conversation_id: conversationId,
      role: "user",
      content,
      status: "pending",
      created_at: new Date().toISOString(),
    });
    setDraft("");
  }

  return (
    <Card className="flex min-h-[32rem] flex-1 flex-col overflow-hidden">
      <div className="border-b border-line p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-content-subtle">
          Messages
        </p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messagesQuery.isPending ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading messages">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : null}
        {messagesQuery.isError ? (
          <EmptyState
            title="Could not load messages"
            description={errorMessage(messagesQuery.error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void messagesQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : null}
        {rows.length === 0 ? (
          <EmptyState
            title="No messages yet"
            description="Send a prompt to start this conversation."
          />
        ) : (
          rows.map((row) => (
            <article
              key={row.id}
              className={`max-w-[85%] rounded-lg border border-line p-3 ${
                row.isMine ? "ml-auto bg-accent-muted" : "bg-surface-raised"
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <Badge tone={row.tone}>{row.role}</Badge>
                {row.status ? <span className="text-2xs text-content-subtle">{row.status}</span> : null}
                <time className="ml-auto text-2xs text-content-subtle" dateTime={row.createdAt}>
                  {formatRelative(row.createdAt)}
                </time>
              </div>
              <p className="whitespace-pre-wrap text-sm text-content">{row.content}</p>
              {row.isStreaming ? (
                <p className="mt-1 text-2xs text-info" role="status" aria-live="polite">
                  Streaming…
                </p>
              ) : null}
            </article>
          ))
        )}
      </div>
      <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-line p-3">
        <label className="flex flex-1 flex-col gap-1 text-xs text-content-muted">
          Message
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Describe what you want the studio to do…"
            rows={2}
            className="w-full resize-none rounded-md border border-line bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle"
          />
        </label>
        <Button type="submit" variant="primary" disabled={draft.trim().length === 0}>
          Send
        </Button>
      </form>
      <p className="border-t border-line px-3 py-2 text-2xs text-content-subtle">
        Prompts are staged locally. Streaming orchestration and send mutation land with the
        conversations write API (tracked in the backlog).
      </p>
    </Card>
  );
}

export function ChatScreen() {
  const projectsQuery = useProjects();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const projects = projectsQuery.data ?? [];
  const selectedProjectId = projectId ?? projects[0]?.id ?? null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chat"
        description="Conversational workspace backed by the conversations API."
        actions={
          projectsQuery.data ? (
            <label className="flex flex-col gap-1 text-xs text-content-muted">
              Project
              <select
                value={selectedProjectId ?? ""}
                onChange={(event) => {
                  setProjectId(event.target.value || null);
                  setConversationId(null);
                }}
                className="h-8 rounded-md border border-line bg-surface px-2 text-xs text-content"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null
        }
      />
      {projectsQuery.isPending ? <Skeleton className="h-96" /> : null}
      {projectsQuery.isError ? (
        <Card className="p-6">
          <EmptyState
            title="Could not load projects"
            description={errorMessage(projectsQuery.error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void projectsQuery.refetch()}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : null}
      {projects.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No projects" description="Create a project before starting a conversation." />
        </Card>
      ) : selectedProjectId ? (
        <div className="grid min-h-[34rem] gap-4 lg:grid-cols-[minmax(15rem,20rem)_1fr]">
          <ConversationList
            projectId={selectedProjectId}
            selectedId={conversationId}
            onSelect={setConversationId}
          />
          {conversationId ? (
            <MessageThread key={conversationId} conversationId={conversationId} />
          ) : (
            <Card className="grid place-items-center p-6">
              <EmptyState
                title="Select a conversation"
                description="Choose a conversation on the left to read and reply to its messages."
              />
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}

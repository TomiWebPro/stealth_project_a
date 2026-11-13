"""Conversation and message repository."""

from __future__ import annotations

from uuid import UUID, uuid4

from ..errors import InvalidRequestError, NotFoundError
from ..schemas.common import utcnow
from ..schemas.conversation import (
    Conversation,
    ConversationCreate,
    Message,
    MessageCreate,
)
from ..storage.base import Collections, DocumentStore
from .assets import AssetRepository
from .base import BaseRepository
from .projects import ProjectRepository


class ConversationRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        assets: AssetRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects
        self.assets = assets

    def get(self, conversation_id: UUID) -> Conversation | None:
        return self._load(Collections.CONVERSATIONS, str(conversation_id), Conversation)

    def get_or_raise(self, conversation_id: UUID) -> Conversation:
        conversation = self.get(conversation_id)
        if conversation is None:
            raise NotFoundError("Conversation", str(conversation_id))
        return conversation

    def list(self, *, project_id: UUID) -> list[Conversation]:
        self.projects.get_or_raise(project_id)
        conversations = self._load_all(Collections.CONVERSATIONS, Conversation)
        conversations = [
            conversation
            for conversation in conversations
            if conversation.project_id == project_id
        ]
        conversations.sort(
            key=lambda conversation: (
                conversation.updated_at,
                str(conversation.id),
            ),
            reverse=True,
        )
        return conversations

    def create(
        self,
        project_id: UUID,
        payload: ConversationCreate,
        *,
        user_id: UUID,
    ) -> Conversation:
        project = self.projects.get_or_raise(project_id)
        if project.archived:
            raise InvalidRequestError(
                f"Project '{project.id}' is archived; conversations cannot be created.",
                code="project_archived",
            )

        now = self.clock()
        conversation = Conversation(
            id=uuid4(),
            project_id=project_id,
            title=payload.title,
            created_by=user_id,
            created_at=now,
            updated_at=now,
            message_count=0,
        )

        initial = payload.initial_message
        if initial is not None:
            if not initial.strip():
                raise InvalidRequestError(
                    "initial_message must not be blank.",
                    code="invalid_request",
                    details=[("initial_message", "must not be blank")],
                )
            message = self._build_message(
                conversation,
                MessageCreate(role="user", content=initial),
                created_at=now,
            )
            conversation.message_count = 1
            self._save(Collections.MESSAGES, str(message.id), message)

        self._save(Collections.CONVERSATIONS, str(conversation.id), conversation)
        return conversation

    def add_message(
        self, conversation_id: UUID, payload: MessageCreate
    ) -> Message:
        conversation = self.get_or_raise(conversation_id)
        project = self.projects.get_or_raise(conversation.project_id)
        if project.archived:
            raise InvalidRequestError(
                f"Project '{project.id}' is archived; messages cannot be added.",
                code="project_archived",
            )
        self._validate_attachments(payload)
        message = self._build_message(conversation, payload, created_at=self.clock())
        self._save(Collections.MESSAGES, str(message.id), message)

        conversation.message_count += 1
        conversation.updated_at = message.created_at
        self._save(Collections.CONVERSATIONS, str(conversation.id), conversation)
        return message

    def list_messages(
        self, conversation_id: UUID, *, limit: int | None = None
    ) -> list[Message]:
        self.get_or_raise(conversation_id)
        messages = self._load_all(Collections.MESSAGES, Message)
        messages = [
            message
            for message in messages
            if message.conversation_id == conversation_id
        ]
        messages.sort(key=lambda message: (message.created_at, str(message.id)))
        return messages[:limit] if limit is not None else messages

    # --- Internals ----------------------------------------------------------

    def _build_message(
        self, conversation: Conversation, payload: MessageCreate, *, created_at
    ) -> Message:
        return Message(
            id=uuid4(),
            conversation_id=conversation.id,
            role=payload.role,
            content=payload.content,
            status="complete",
            attachments=payload.attachments,
            operation_id=payload.operation_id,
            created_at=created_at,
        )

    def _validate_attachments(self, payload: MessageCreate) -> None:
        for attachment in payload.attachments:
            self.assets.require_available(attachment.asset_id)


__all__ = ["ConversationRepository"]

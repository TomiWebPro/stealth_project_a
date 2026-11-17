"""Persistence primitives shared by the API repositories.

A tiny document-store abstraction keeps business logic independent of the
backing implementation. Phase 2 ships an in-memory store (default) and a
SQLite store (local persistence). PostgreSQL can later implement the same
interface without touching routers or repositories.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class Collections:
    """Canonical collection names used by the document store."""

    PROJECTS = "projects"
    CONVERSATIONS = "conversations"
    MESSAGES = "messages"
    ASSETS = "assets"
    ASSET_VERSIONS = "asset_versions"
    ASSET_RELATIONSHIPS = "asset_relationships"
    UPLOADS = "uploads"
    JOBS = "jobs"
    JOB_EVENTS = "job_events"
    JOB_RETRIES = "job_retries"
    PROVIDERS = "providers"
    ORCHESTRATION_PLANS = "orchestration_plans"
    ORCHESTRATION_RUNS = "orchestration_runs"
    PRESENCE = "presence"
    COMMENTS = "comments"
    USERS = "users"
    ORGANIZATIONS = "organizations"
    MEMBERS = "members"
    AUTH_TOKENS = "auth_tokens"
    EXTENSION_REGISTRY = "extension_registry"
    EXTENSIONS = "extensions"


Document = dict[str, Any]


class DocumentStore(ABC):
    """Minimal document store keyed by ``(collection, doc_id)``.

    Documents are JSON-compatible dicts (timestamps already serialized) so both
    implementations persist exactly the same bytes and models can be rebuilt
    with ``Model.model_validate(document)``.
    """

    @abstractmethod
    def get(self, collection: str, doc_id: str) -> Document | None:
        raise NotImplementedError

    @abstractmethod
    def put(self, collection: str, doc_id: str, document: Document) -> None:
        raise NotImplementedError

    @abstractmethod
    def delete(self, collection: str, doc_id: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def all(self, collection: str) -> list[Document]:
        raise NotImplementedError

    @abstractmethod
    def clear(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def ping(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    def close(self) -> None:
        raise NotImplementedError


__all__ = ["Collections", "Document", "DocumentStore"]

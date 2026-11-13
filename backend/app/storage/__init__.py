"""Storage factory."""

from __future__ import annotations

from ..config import Settings
from .base import Collections, Document, DocumentStore
from .memory import InMemoryStore
from .sqlite import SqliteStore


def create_store(settings: Settings) -> DocumentStore:
    if settings.storage == "sqlite":
        return SqliteStore(settings.sqlite_path)
    return InMemoryStore()


__all__ = ["Collections", "Document", "DocumentStore", "create_store"]

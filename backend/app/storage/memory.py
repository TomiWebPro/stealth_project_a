"""In-memory document store (default for local development and tests)."""

from __future__ import annotations

import copy
import threading
from collections import defaultdict

from .base import Document, DocumentStore


class InMemoryStore(DocumentStore):
    def __init__(self) -> None:
        self._documents: dict[str, dict[str, Document]] = defaultdict(dict)
        self._lock = threading.RLock()
    def get(self, collection: str, doc_id: str) -> Document | None:
        with self._lock:
            document = self._documents.get(collection, {}).get(doc_id)
            return copy.deepcopy(document) if document is not None else None

    def put(self, collection: str, doc_id: str, document: Document) -> None:
        with self._lock:
            self._documents[collection][doc_id] = copy.deepcopy(document)

    def delete(self, collection: str, doc_id: str) -> bool:
        with self._lock:
            return self._documents.get(collection, {}).pop(doc_id, None) is not None

    def all(self, collection: str) -> list[Document]:
        with self._lock:
            return [copy.deepcopy(doc) for doc in self._documents.get(collection, {}).values()]

    def clear(self) -> None:
        with self._lock:
            self._documents.clear()

    def ping(self) -> bool:
        return True

    def close(self) -> None:
        # Nothing to release; keeping the store usable makes test teardown simple.
        return None


__all__ = ["InMemoryStore"]

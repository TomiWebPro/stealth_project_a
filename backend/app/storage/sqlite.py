"""SQLite-backed document store (local persistence, no extra dependencies)."""

from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path

from .base import Document, DocumentStore


class SqliteStore(DocumentStore):
    """Single-table JSON document store.

    This is deliberately simple: Phase 2 needs durable local metadata, not a
    relational schema. PostgreSQL migrations and normalized tables arrive once
    multi-user hosting is on the table (see docs/DEVELOPMENT_ROADMAP.md).
    """

    def __init__(self, path: str | Path) -> None:
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._connection = sqlite3.connect(self.path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        with self._lock:
            if self.path != ":memory:":
                self._connection.execute("PRAGMA journal_mode=WAL")
            self._connection.execute(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    collection TEXT NOT NULL,
                    doc_id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    PRIMARY KEY (collection, doc_id)
                )
                """
            )
            self._connection.commit()

    def get(self, collection: str, doc_id: str) -> Document | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT payload FROM documents WHERE collection = ? AND doc_id = ?",
                (collection, doc_id),
            ).fetchone()
        return json.loads(row["payload"]) if row is not None else None

    def put(self, collection: str, doc_id: str, document: Document) -> None:
        payload = json.dumps(document, separators=(",", ":"))
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO documents (collection, doc_id, payload)
                VALUES (?, ?, ?)
                ON CONFLICT(collection, doc_id)
                DO UPDATE SET payload = excluded.payload
                """,
                (collection, doc_id, payload),
            )
            self._connection.commit()

    def delete(self, collection: str, doc_id: str) -> bool:
        with self._lock:
            cursor = self._connection.execute(
                "DELETE FROM documents WHERE collection = ? AND doc_id = ?",
                (collection, doc_id),
            )
            self._connection.commit()
        return cursor.rowcount > 0

    def all(self, collection: str) -> list[Document]:
        with self._lock:
            rows = self._connection.execute(
                "SELECT payload FROM documents WHERE collection = ?",
                (collection,),
            ).fetchall()
        return [json.loads(row["payload"]) for row in rows]

    def clear(self) -> None:
        with self._lock:
            self._connection.execute("DELETE FROM documents")
            self._connection.commit()

    def ping(self) -> bool:
        if getattr(self, "_closed", False):
            return False
        try:
            with self._lock:
                self._connection.execute("SELECT 1").fetchone()
            return True
        except sqlite3.Error:  # pragma: no cover - defensive
            return False

    def close(self) -> None:
        with self._lock:
            if getattr(self, "_closed", False):
                return
            self._connection.close()
            self._closed = True


__all__ = ["SqliteStore"]

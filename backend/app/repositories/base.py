"""Shared repository helpers."""

from __future__ import annotations

from typing import Callable, Generic, TypeVar

from pydantic import BaseModel

from ..schemas.common import utcnow
from ..storage.base import DocumentStore

ModelT = TypeVar("ModelT", bound=BaseModel)

Clock = Callable[[], object]


class BaseRepository:
    """Persist/load Pydantic models as JSON-compatible documents."""

    def __init__(self, store: DocumentStore, clock: Callable = utcnow) -> None:
        self.store = store
        self.clock = clock

    def _save(self, collection: str, doc_id: str, model: BaseModel) -> None:
        self.store.put(collection, doc_id, model.model_dump(mode="json"))

    def _load(self, collection: str, doc_id: str, model: type[ModelT]) -> ModelT | None:
        document = self.store.get(collection, doc_id)
        return model.model_validate(document) if document is not None else None

    def _load_all(self, collection: str, model: type[ModelT]) -> list[ModelT]:
        return [model.model_validate(document) for document in self.store.all(collection)]


class RepositoryWithDocuments(BaseRepository, Generic[ModelT]):
    """Convenience wrapper kept for readability in type hints."""

    collection: str = ""
    model: type[BaseModel]

    def load(self, doc_id: str) -> ModelT | None:
        return self._load(self.collection, doc_id, self.model)  # type: ignore[arg-type]

    def load_all(self) -> list[ModelT]:
        return self._load_all(self.collection, self.model)  # type: ignore[arg-type]

    def save(self, doc_id: str, model: ModelT) -> None:
        self._save(self.collection, doc_id, model)


__all__ = ["BaseRepository", "Clock", "RepositoryWithDocuments"]

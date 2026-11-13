"""Storage backend semantics: durability, isolation and document-store primitives."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.storage.memory import InMemoryStore
from app.storage.sqlite import SqliteStore

from .conftest import PREFIX


@pytest.fixture(params=["memory", "sqlite"], ids=["memory", "sqlite"])
def store(request, tmp_path):
    if request.param == "sqlite":
        instance = SqliteStore(tmp_path / "store.db")
        yield instance
        instance.close()
    else:
        yield InMemoryStore()


def test_document_store_crud(store):
    assert store.get("projects", "missing") is None

    store.put("projects", "a", {"name": "Alpha"})
    store.put("projects", "b", {"name": "Beta"})
    assert store.get("projects", "a") == {"name": "Alpha"}
    assert sorted(doc["name"] for doc in store.all("projects")) == ["Alpha", "Beta"]

    assert store.delete("projects", "a") is True
    assert store.delete("projects", "a") is False
    assert store.get("projects", "a") is None
    assert [doc["name"] for doc in store.all("projects")] == ["Beta"]

    store.clear()
    assert store.all("projects") == []
    assert store.ping() is True


def test_document_store_isolates_writes(store):
    document = {"name": "Original", "tags": ["one"]}
    store.put("assets", "x", document)

    document["name"] = "Mutated"
    assert store.get("assets", "x") == {"name": "Original", "tags": ["one"]}

    fetched = store.get("assets", "x")
    fetched["tags"].append("two")
    assert store.get("assets", "x")["tags"] == ["one"]


def test_sqlite_persists_across_restart(tmp_path):
    settings = Settings(
        storage="sqlite",
        sqlite_path=tmp_path / "studio.db",
        upload_dir=tmp_path / "uploads",
    )
    app = create_app(settings)
    with TestClient(app) as client:
        created = client.post(
            f"{PREFIX}/projects", json={"name": "Persistent"}
        ).json()

    app = create_app(settings)
    with TestClient(app) as client:
        fetched = client.get(f"{PREFIX}/projects/{created['id']}")
        assert fetched.status_code == 200
        assert fetched.json()["name"] == "Persistent"


def test_sqlite_persists_conversation_messages(tmp_path):
    settings = Settings(
        storage="sqlite",
        sqlite_path=tmp_path / "studio.db",
        upload_dir=tmp_path / "uploads",
    )
    app = create_app(settings)
    with TestClient(app) as client:
        project = client.post(
            f"{PREFIX}/projects", json={"name": "P2"}
        ).json()
        conversation = client.post(
            f"{PREFIX}/projects/{project['id']}/conversations",
            json={"title": "Keep", "initial_message": "Persisted text"},
        ).json()

    app = create_app(settings)
    with TestClient(app) as client:
        conversation = client.get(
            f"{PREFIX}/conversations/{conversation['id']}"
        ).json()
        assert conversation["message_count"] == 1
        messages = client.get(
            f"{PREFIX}/conversations/{conversation['id']}/messages"
        ).json()
        assert messages[0]["content"] == "Persisted text"


def test_memory_store_does_not_persist(tmp_path):
    settings = Settings(storage="memory", upload_dir=tmp_path / "uploads")
    app = create_app(settings)
    with TestClient(app) as client:
        client.post(f"{PREFIX}/projects", json={"name": "Ephemeral"})

    app = create_app(settings)
    with TestClient(app) as client:
        assert client.get(f"{PREFIX}/projects").json() == []
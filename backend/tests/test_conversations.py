"""Conversation and message tests."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX


def _create_project(client):
    response = client.post(
        f"{PREFIX}/projects", json={"name": "Conv Project"}
    )
    assert response.status_code == 201
    return response.json()


def _create_conversation(client, project_id, title="Chat", initial_message=None):
    payload = {"title": title}
    if initial_message is not None:
        payload["initial_message"] = initial_message
    return client.post(
        f"{PREFIX}/projects/{project_id}/conversations", json=payload
    )


def test_create_conversation_with_initial_message(client):
    project = _create_project(client)
    response = _create_conversation(
        client, project["id"], title="Intro", initial_message="Hello world"
    )
    assert response.status_code == 201
    conversation = response.json()
    assert conversation["title"] == "Intro"
    assert conversation["project_id"] == project["id"]
    assert conversation["message_count"] == 1

    messages = client.get(
        f"{PREFIX}/conversations/{conversation['id']}/messages"
    )
    assert messages.status_code == 200
    assert len(messages.json()) == 1
    message = messages.json()[0]
    assert message["role"] == "user"
    assert message["content"] == "Hello world"
    assert message["status"] == "complete"


def test_create_conversation_without_initial_message(client):
    project = _create_project(client)
    conversation = _create_conversation(client, project["id"]).json()
    assert conversation["message_count"] == 0
    assert (
        client.get(f"{PREFIX}/conversations/{conversation['id']}/messages").json() == []
    )


def test_blank_initial_message_rejected(client):
    project = _create_project(client)
    response = _create_conversation(
        client, project["id"], initial_message="   "
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_create_conversation_in_missing_project(client):
    response = _create_conversation(client, uuid4())
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "project_not_found"


def test_list_conversations_by_project(client):
    project_a = _create_project(client)
    project_b = _create_project(client)
    first = _create_conversation(client, project_a["id"], title="First").json()
    second = _create_conversation(client, project_a["id"], title="Second").json()
    _create_conversation(client, project_b["id"], title="Other")

    response = client.get(
        f"{PREFIX}/conversations", params={"project_id": project_a["id"]}
    )
    assert response.status_code == 200
    titles = {conversation["title"] for conversation in response.json()}
    assert titles == {"First", "Second"}
    assert {c["id"] for c in response.json()} == {first["id"], second["id"]}


def test_add_messages_and_count(client):
    project = _create_project(client)
    conversation = _create_conversation(client, project["id"]).json()
    conversation_id = conversation["id"]

    first = client.post(
        f"{PREFIX}/conversations/{conversation_id}/messages",
        json={"role": "user", "content": "First"},
    )
    assert first.status_code == 201
    second = client.post(
        f"{PREFIX}/conversations/{conversation_id}/messages",
        json={"role": "assistant", "content": "Second"},
    )
    assert second.status_code == 201

    assert (
        client.get(f"{PREFIX}/conversations/{conversation_id}").json()["message_count"]
        == 2
    )
    messages = client.get(
        f"{PREFIX}/conversations/{conversation_id}/messages"
    ).json()
    assert [message["content"] for message in messages] == ["First", "Second"]
    assert [message["role"] for message in messages] == ["user", "assistant"]


def test_empty_message_content_rejected(client):
    project = _create_project(client)
    conversation = _create_conversation(client, project["id"]).json()
    response = client.post(
        f"{PREFIX}/conversations/{conversation['id']}/messages",
        json={"content": ""},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_add_message_to_missing_conversation(client):
    response = client.post(
        f"{PREFIX}/conversations/{uuid4()}/messages", json={"content": "Hi"}
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "conversation_not_found"


def test_list_messages_for_missing_conversation(client):
    response = client.get(f"{PREFIX}/conversations/{uuid4()}/messages")
    assert response.status_code == 404


def test_message_attachment_validated(client):
    project = _create_project(client)
    conversation = _create_conversation(client, project["id"]).json()
    response = client.post(
        f"{PREFIX}/conversations/{conversation['id']}/messages",
        json={
            "content": "Looking at",
            "attachments": [{"asset_id": str(uuid4()), "role": "input"}],
        },
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "asset_not_found"


def test_message_attachment_to_deleted_asset_rejected(client):
    project = _create_project(client)
    asset = client.post(
        f"{PREFIX}/assets/register",
        json={
            "project_id": project["id"],
            "type": "image",
            "name": "Gone",
            "storage": {
                "backend": "local",
                "key": "gone.png",
                "size_bytes": 1,
                "content_type": "image/png",
            },
        },
    ).json()
    assert client.delete(f"{PREFIX}/assets/{asset['id']}").status_code == 204

    conversation = _create_conversation(client, project["id"]).json()
    response = client.post(
        f"{PREFIX}/conversations/{conversation['id']}/messages",
        json={
            "content": "Referencing a deleted asset",
            "attachments": [{"asset_id": asset["id"]}],
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "asset_deleted"


def test_conversation_blocked_in_archived_project(client):
    project = _create_project(client)
    client.delete(f"{PREFIX}/projects/{project['id']}")
    response = _create_conversation(client, project["id"])
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "project_archived"


def test_create_conversation_blank_title_rejected(client):
    project = _create_project(client)
    response = _create_conversation(client, project["id"], title="")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
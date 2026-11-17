"""Cross-domain search endpoint tests (success and failure paths)."""

from __future__ import annotations

from .conftest import PREFIX


def _project(client, name, description=None):
    payload = {"name": name}
    if description is not None:
        payload["description"] = description
    response = client.post(f"{PREFIX}/projects", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _asset(client, project_id, name, *, tags=None):
    payload = {
        "project_id": project_id,
        "type": "image",
        "name": name,
        "storage": {
            "backend": "local",
            "key": f"Output/{name}.png",
            "size_bytes": 0,
            "content_type": "image/png",
        },
        "tags": tags or [],
    }
    response = client.post(f"{PREFIX}/assets/register", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _conversation(client, project_id, title):
    response = client.post(
        f"{PREFIX}/projects/{project_id}/conversations", json={"title": title}
    )
    assert response.status_code == 201, response.text
    return response.json()


def _search(client, query, **params):
    return client.get(f"{PREFIX}/search", params={"q": query, **params})


def test_search_ranks_matches_across_domains(client):
    project = _project(client, "Dragon Feature", "epic fantasy short")
    asset = _asset(client, project["id"], "Dragon Concept", tags=["dragon"])
    conversation = _conversation(client, project["id"], "Dragon Lighting")

    response = _search(client, "dragon")
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == {"query", "results"}
    assert body["query"] == "dragon"

    results = body["results"]
    assert len(results) == 3
    # Equal prefix scores tie-break on kind order: project, asset, conversation.
    assert [item["kind"] for item in results] == ["project", "asset", "conversation"]
    assert [item["id"] for item in results] == [
        project["id"],
        asset["id"],
        conversation["id"],
    ]
    assert all(item["score"] == 1.0 for item in results)
    assert all(item["project_id"] == project["id"] for item in results)

    by_kind = {item["kind"]: item for item in results}
    assert by_kind["project"]["title"] == "Dragon Feature"
    assert by_kind["project"]["subtitle"] == "epic fantasy short"
    assert by_kind["asset"]["subtitle"] == "image"
    assert by_kind["conversation"]["subtitle"] == "Dragon Feature"


def test_search_is_case_insensitive_and_matches_tags(client):
    project = _project(client, "Quiet Project")
    asset = _asset(client, project["id"], "Frame 01", tags=["DRAGON", "keyframe"])

    for query in ("dragon", "DRAGON", "DrAgOn"):
        results = _search(client, query).json()["results"]
        assert [item["id"] for item in results] == [asset["id"]]
        # A tag match scores at 75% of a primary-name match.
        assert results[0]["score"] == 0.75


def test_search_kind_filter(client):
    project = _project(client, "Filtered Dragon")
    asset = _asset(client, project["id"], "Dragon Frame")
    _conversation(client, project["id"], "Dragon Chat")

    assets = _search(client, "dragon", kind="asset").json()["results"]
    assert [item["id"] for item in assets] == [asset["id"]]
    assert all(item["kind"] == "asset" for item in assets)

    projects = _search(client, "dragon", kind="project").json()["results"]
    assert [item["id"] for item in projects] == [project["id"]]

    assert _search(client, "dragon", kind="conversation").json()["results"]


def test_search_blank_query_and_no_matches(client):
    # Whitespace satisfies the wire min_length but has no searchable tokens.
    blank = _search(client, "   ")
    assert blank.status_code == 200
    assert blank.json() == {"query": "   ", "results": []}

    _project(client, "Existing Project")
    miss = _search(client, "not-present-anywhere")
    assert miss.status_code == 200
    assert miss.json() == {"query": "not-present-anywhere", "results": []}


def test_search_respects_limit(client):
    project = _project(client, "Limit Project")
    for index in range(3):
        _asset(client, project["id"], f"Limit Asset {index}")

    results = _search(client, "limit", limit=2).json()["results"]
    assert len(results) == 2
    assert len(_search(client, "limit").json()["results"]) == 4  # project + 3 assets


def test_search_skips_deleted_assets(client):
    project = _project(client, "Cleanup Project")
    keep = _asset(client, project["id"], "Keep Dragon")
    drop = _asset(client, project["id"], "Drop Dragon")

    before = {item["id"] for item in _search(client, "dragon").json()["results"]}
    assert before == {keep["id"], drop["id"]}

    deleted = client.delete(f"{PREFIX}/assets/{drop['id']}")
    assert deleted.status_code == 204

    after = {item["id"] for item in _search(client, "dragon").json()["results"]}
    assert after == {keep["id"]}


def test_search_validation_errors_use_envelope(client):
    cases = [
        {"q": ""},
        {"q": "x" * 201},
        {"q": "dragon", "limit": 0},
        {"q": "dragon", "limit": 101},
        {"q": "dragon", "kind": "not-a-kind"},
    ]
    for params in cases:
        response = client.get(f"{PREFIX}/search", params=params)
        assert response.status_code == 422, params
        body = response.json()
        assert set(body) == {"error"}
        error = body["error"]
        assert error["code"] == "validation_error"
        assert error["message"]
        assert error["request_id"] == response.headers["X-Request-ID"]

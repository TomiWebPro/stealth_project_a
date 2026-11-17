"""Dev-local auth/session and organization endpoint tests."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX

EMAIL = "dev@studio.local"
PASSWORD = "studio-dev"


def _login(client, email=EMAIL, password=PASSWORD):
    return client.post(f"{PREFIX}/auth/login", json={"email": email, "password": password})


def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


# --- Login / refresh --------------------------------------------------------


def test_login_success(client, settings):
    response = _login(client)
    assert response.status_code == 200
    body = response.json()
    user = body["user"]
    assert user["email"] == EMAIL
    assert user["id"] == str(settings.default_user_id)
    tokens = body["tokens"]
    assert tokens["token_type"] == "bearer"
    assert tokens["expires_in"] > 0
    assert tokens["access_token"] and tokens["refresh_token"]


def test_login_bad_password(client):
    response = _login(client, password="wrong")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"


def test_login_unknown_email(client):
    response = _login(client, email="someone@elsewhere.test")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"


def test_login_invalid_email_shape(client):
    response = _login(client, email="not-an-email")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_refresh_rotates_tokens(client):
    tokens = _login(client).json()["tokens"]
    response = client.post(
        f"{PREFIX}/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert response.status_code == 200
    new_tokens = response.json()
    assert new_tokens["access_token"] != tokens["access_token"]
    assert new_tokens["refresh_token"] != tokens["refresh_token"]
    # Old refresh token is invalid after rotation.
    replay = client.post(
        f"{PREFIX}/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert replay.status_code == 401
    assert replay.json()["error"]["code"] == "invalid_refresh_token"


def test_refresh_with_access_token_rejected(client):
    tokens = _login(client).json()["tokens"]
    response = client.post(
        f"{PREFIX}/auth/refresh", json={"refresh_token": tokens["access_token"]}
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_refresh_token"


def test_refresh_unknown_token(client):
    response = client.post(f"{PREFIX}/auth/refresh", json={"refresh_token": "bogus"})
    assert response.status_code == 401


# --- Session / me -----------------------------------------------------------


def test_me_with_bearer(client):
    tokens = _login(client).json()["tokens"]
    response = client.get(f"{PREFIX}/auth/me", headers=_bearer(tokens["access_token"]))
    assert response.status_code == 200
    assert response.json()["email"] == EMAIL


def test_me_requires_bearer(client):
    response = client.get(f"{PREFIX}/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_me_bad_token(client):
    response = client.get(f"{PREFIX}/auth/me", headers=_bearer("not-a-token"))
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_token"


def test_session_returns_user_and_tokens(client):
    tokens = _login(client).json()["tokens"]
    response = client.get(
        f"{PREFIX}/auth/session", headers=_bearer(tokens["access_token"])
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == EMAIL
    assert body["tokens"]["access_token"] == tokens["access_token"]


# --- Organizations ----------------------------------------------------------


def test_list_organizations(client, settings):
    response = client.get(f"{PREFIX}/orgs")
    assert response.status_code == 200
    orgs = response.json()
    assert len(orgs) == 1
    assert orgs[0]["id"] == str(settings.default_org_id)
    assert orgs[0]["slug"] == "studio"
    # Alias route used by older clients.
    assert client.get(f"{PREFIX}/organizations").json() == orgs


def test_create_organization(client):
    response = client.post(
        f"{PREFIX}/orgs", json={"name": "Agency", "slug": "agency"}
    )
    assert response.status_code == 201
    org = response.json()
    assert org["slug"] == "agency"
    assert client.get(f"{PREFIX}/orgs/{org['id']}").json() == org


def test_create_organization_duplicate_slug(client):
    assert client.post(
        f"{PREFIX}/orgs", json={"name": "Agency", "slug": "agency"}
    ).status_code == 201
    response = client.post(
        f"{PREFIX}/orgs", json={"name": "Other", "slug": "agency"}
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "slug_exists"


def test_get_missing_organization(client):
    response = client.get(f"{PREFIX}/orgs/{uuid4()}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "organization_not_found"


# --- Members ----------------------------------------------------------------


def test_list_members_seeded_owner(client, settings):
    org_id = str(settings.default_org_id)
    response = client.get(f"{PREFIX}/orgs/{org_id}/members")
    assert response.status_code == 200
    members = response.json()
    assert len(members) == 1
    assert members[0]["user_id"] == str(settings.default_user_id)
    assert members[0]["role"] == "owner"


def test_invite_member(client, settings):
    org_id = str(settings.default_org_id)
    response = client.post(
        f"{PREFIX}/orgs/{org_id}/members",
        json={"email": "artist@studio.local", "role": "member"},
    )
    assert response.status_code == 201
    member = response.json()
    assert member["email"] == "artist@studio.local"
    assert member["role"] == "member"
    emails = {item["email"] for item in client.get(f"{PREFIX}/orgs/{org_id}/members").json()}
    assert emails == {"dev@studio.local", "artist@studio.local"}


def test_invite_duplicate_member(client, settings):
    org_id = str(settings.default_org_id)
    payload = {"email": "artist@studio.local"}
    assert client.post(f"{PREFIX}/orgs/{org_id}/members", json=payload).status_code == 201
    response = client.post(f"{PREFIX}/orgs/{org_id}/members", json=payload)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "member_exists"


def test_members_missing_org(client):
    response = client.get(f"{PREFIX}/orgs/{uuid4()}/members")
    assert response.status_code == 404

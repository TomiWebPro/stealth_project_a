"""Environment-driven settings parsing."""

from __future__ import annotations

from pathlib import Path
from uuid import UUID

import pytest

from app.config import DEFAULT_ORG_ID, DEFAULT_USER_ID, Settings


def test_from_env_defaults(monkeypatch):
    for name in (
        "STUDIO_STORAGE",
        "STUDIO_SQLITE_PATH",
        "STUDIO_UPLOAD_DIR",
        "STUDIO_DEFAULT_ORG_ID",
        "STUDIO_DEFAULT_USER_ID",
        "STUDIO_MAX_UPLOAD_BYTES",
        "STUDIO_CORS_ORIGINS",
        "STUDIO_CORS_ALLOW_CREDENTIALS",
    ):
        monkeypatch.delenv(name, raising=False)

    settings = Settings.from_env()
    assert settings.storage == "memory"
    assert settings.sqlite_path == Path("data/studio.db")
    assert settings.upload_dir == Path("data/uploads")
    assert settings.default_org_id == DEFAULT_ORG_ID
    assert settings.default_user_id == DEFAULT_USER_ID
    assert settings.max_upload_bytes == 512 * 1024 * 1024
    assert settings.allow_cors_credentials is False
    assert settings.cors_origins


def test_from_env_overrides(monkeypatch):
    org_id = UUID("00000000-0000-0000-0000-000000000001")
    user_id = UUID("00000000-0000-0000-0000-000000000002")
    monkeypatch.setenv("STUDIO_STORAGE", "SQLite")
    monkeypatch.setenv("STUDIO_SQLITE_PATH", "/tmp/custom.db")
    monkeypatch.setenv("STUDIO_UPLOAD_DIR", "/tmp/uploads")
    monkeypatch.setenv("STUDIO_DEFAULT_ORG_ID", str(org_id))
    monkeypatch.setenv("STUDIO_DEFAULT_USER_ID", str(user_id))
    monkeypatch.setenv("STUDIO_MAX_UPLOAD_BYTES", "1024")
    monkeypatch.setenv("STUDIO_CORS_ORIGINS", "http://a.test, ,http://b.test")
    monkeypatch.setenv("STUDIO_CORS_ALLOW_CREDENTIALS", "true")

    settings = Settings.from_env()
    assert settings.storage == "sqlite"
    assert settings.sqlite_path == Path("/tmp/custom.db")
    assert settings.upload_dir == Path("/tmp/uploads")
    assert settings.default_org_id == org_id
    assert settings.default_user_id == user_id
    assert settings.max_upload_bytes == 1024
    assert settings.cors_origins == ("http://a.test", "http://b.test")
    assert settings.allow_cors_credentials is True


@pytest.mark.parametrize("value", ["postgres", "postgresql", ""])
def test_from_env_rejects_unknown_storage(monkeypatch, value):
    monkeypatch.setenv("STUDIO_STORAGE", value)
    with pytest.raises(ValueError, match="STUDIO_STORAGE"):
        Settings.from_env()


def test_from_env_rejects_non_integer_size(monkeypatch):
    monkeypatch.setenv("STUDIO_MAX_UPLOAD_BYTES", "lots")
    with pytest.raises(ValueError, match="STUDIO_MAX_UPLOAD_BYTES"):
        Settings.from_env()


def test_from_env_rejects_invalid_uuid(monkeypatch):
    monkeypatch.setenv("STUDIO_DEFAULT_USER_ID", "not-a-uuid")
    with pytest.raises(ValueError, match="STUDIO_DEFAULT_USER_ID"):
        Settings.from_env()

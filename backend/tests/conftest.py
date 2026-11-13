"""Shared fixtures: every test runs against in-memory and SQLite storage."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

PREFIX = "/api/v1"

STORAGES = ["memory", "sqlite"]


@pytest.fixture(params=STORAGES, ids=STORAGES)
def settings(request: pytest.FixtureRequest, tmp_path) -> Settings:
    test_settings = Settings(
        storage=request.param,  # type: ignore[arg-type]
        upload_dir=tmp_path / "uploads",
    )
    if request.param == "sqlite":
        test_settings.sqlite_path = tmp_path / "studio.db"
    return test_settings


@pytest.fixture
def client(settings: Settings):
    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client
    # The TestClient context manager runs the lifespan, which closes the store.
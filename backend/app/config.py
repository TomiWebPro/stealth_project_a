"""Runtime configuration for the Studio Platform backend.

Configuration is intentionally environment-driven and dependency-free so the
same application object can run with in-memory storage (default, used by tests)
or a local SQLite database:

    STUDIO_STORAGE=sqlite STUDIO_SQLITE_PATH=./data/studio.db uvicorn app.main:app

PostgreSQL is the target production store (see docs/SYSTEM_ARCHITECTURE.md);
SQLite/in-memory are the Phase 2 local implementations behind the same document
store interface.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal
from uuid import NAMESPACE_URL, UUID, uuid5

APP_VERSION = "0.2.0"

# Stable development identities used when no auth/org context is supplied.
# The real auth layer (Phase 2+) will replace these with session-derived values.
DEFAULT_ORG_ID = uuid5(NAMESPACE_URL, "studio-platform/default-org")
DEFAULT_USER_ID = uuid5(NAMESPACE_URL, "studio-platform/default-user")

StorageKind = Literal["memory", "sqlite"]

DEFAULT_CORS_ORIGINS: tuple[str, ...] = (
    # Vite dev server used by the Tauri frontend.
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    # Tauri custom-protocol origins.
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError as exc:  # pragma: no cover - misconfiguration path
        raise ValueError(f"{name} must be an integer, got {raw!r}") from exc


def _env_uuid(name: str, default: UUID) -> UUID:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return UUID(raw)
    except ValueError as exc:  # pragma: no cover - misconfiguration path
        raise ValueError(f"{name} must be a UUID, got {raw!r}") from exc


@dataclass(slots=True)
class Settings:
    """Application settings.

    Tests construct this directly; production reads it from the environment via
    :meth:`from_env`.
    """

    storage: StorageKind = "memory"
    sqlite_path: Path = Path("data/studio.db")
    upload_dir: Path = Path("data/uploads")
    default_org_id: UUID = DEFAULT_ORG_ID
    default_user_id: UUID = DEFAULT_USER_ID
    max_upload_bytes: int = 512 * 1024 * 1024
    cors_origins: tuple[str, ...] = field(default_factory=lambda: DEFAULT_CORS_ORIGINS)
    allow_cors_credentials: bool = False

    @classmethod
    def from_env(cls) -> "Settings":
        storage = os.getenv("STUDIO_STORAGE", "memory").strip().lower()
        if storage not in {"memory", "sqlite"}:
            raise ValueError(
                "STUDIO_STORAGE must be 'memory' or 'sqlite', "
                f"got {storage!r}"
            )
        return cls(
            storage=storage,  # type: ignore[arg-type]
            sqlite_path=Path(os.getenv("STUDIO_SQLITE_PATH", "data/studio.db")),
            upload_dir=Path(os.getenv("STUDIO_UPLOAD_DIR", "data/uploads")),
            default_org_id=_env_uuid("STUDIO_DEFAULT_ORG_ID", DEFAULT_ORG_ID),
            default_user_id=_env_uuid("STUDIO_DEFAULT_USER_ID", DEFAULT_USER_ID),
            max_upload_bytes=_env_int("STUDIO_MAX_UPLOAD_BYTES", 512 * 1024 * 1024),
            cors_origins=tuple(
                origin.strip()
                for origin in os.getenv(
                    "STUDIO_CORS_ORIGINS", ",".join(DEFAULT_CORS_ORIGINS)
                ).split(",")
                if origin.strip()
            ),
            allow_cors_credentials=_env_bool(
                "STUDIO_CORS_ALLOW_CREDENTIALS", False
            ),
        )


__all__ = [
    "APP_VERSION",
    "DEFAULT_CORS_ORIGINS",
    "DEFAULT_ORG_ID",
    "DEFAULT_USER_ID",
    "Settings",
    "StorageKind",
]

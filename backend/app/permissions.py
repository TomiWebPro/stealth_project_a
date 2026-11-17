"""Runtime permission enforcement and isolation boundary for extensions.

Installation (P2.5) records that a caller accepted every permission an extension
declares. This layer enforces those declarations at *use* time: an extension can
only exercise a permission or capability it declared, and only while enabled.
The returned scope is also the isolation boundary — the concrete provider ids and
UI contributions an extension is allowed to touch. No third-party code is loaded;
the guard is a deterministic, dependency-free policy check.
"""

from __future__ import annotations

from uuid import UUID

from .errors import ApiError, InvalidRequestError
from .repositories.extensions import ExtensionRepository


class ExtensionPermissionDenied(ApiError):
    """An extension attempted an operation outside its granted scope."""

    status_code = 403
    code = "permission_denied"


class ExtensionPermissionGuard:
    """Policy gate over installed extensions.

    The guard never mutates state; it answers whether a request is within an
    extension's declared, accepted and currently-active scope.
    """

    def __init__(self, extensions: ExtensionRepository) -> None:
        self.extensions = extensions

    def scope(self, extension_id: UUID) -> dict:
        """Return the effective isolation scope for an installed extension."""
        extension = self.extensions.get_or_raise(extension_id)
        requirements = extension.manifest.requirements
        return {
            "extension_id": extension_id,
            "status": extension.status,
            "enabled": extension.status == "enabled",
            "permissions": sorted(p.name for p in requirements.permissions),
            "capabilities": sorted(requirements.capabilities),
            "provider_ids": sorted(requirements.provider_ids),
            "ui_contributions": sorted(extension.manifest.ui_contributions),
            "signed": extension.signed,
            "verified": extension.verified,
        }

    def authorize(
        self,
        extension_id: UUID,
        *,
        permission: str | None = None,
        capability: str | None = None,
    ) -> dict:
        """Authorize a permission/capability request, or raise a typed error.

        A disabled extension has no live scope at all. With no requested
        permission or capability, the call is a no-op scope probe.
        """
        if permission is None and capability is None:
            raise InvalidRequestError(
                "Specify a permission or capability to authorize.",
                code="nothing_to_authorize",
            )

        scope = self.scope(extension_id)
        if not scope["enabled"]:
            raise ExtensionPermissionDenied(
                f"Extension '{extension_id}' is not enabled.",
                details=[("status", scope["status"])],
            )

        granted_permission = permission in scope["permissions"] if permission else None
        granted_capability = capability in scope["capabilities"] if capability else None

        if granted_permission is False:
            raise ExtensionPermissionDenied(
                f"Permission '{permission}' was not declared by extension '{extension_id}'.",
                details=[("permission", "not declared")],
            )
        if granted_capability is False:
            raise ExtensionPermissionDenied(
                f"Capability '{capability}' was not declared by extension '{extension_id}'.",
                details=[("capability", "not declared")],
            )

        return {
            "extension_id": extension_id,
            "allowed": True,
            "permission": permission,
            "capability": capability,
            "reason": "within declared and accepted scope",
            "scope": scope,
        }

    def assert_permission(self, extension_id: UUID, permission: str) -> None:
        self.authorize(extension_id, permission=permission)

    def assert_capability(self, extension_id: UUID, capability: str) -> None:
        self.authorize(extension_id, capability=capability)


__all__ = ["ExtensionPermissionDenied", "ExtensionPermissionGuard"]

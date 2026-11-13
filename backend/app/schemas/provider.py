"""Provider capability discovery and extension manifest contracts."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import Field

from .common import ContractModel, Metadata, NonEmptyStr, SemVer, Timestamp

ProviderStatus = Literal["available", "unavailable", "degraded"]
ProviderLocation = Literal["local", "studio", "cloud"]
ExtensionType = Literal["capability", "ui", "provider", "runtime", "bundle"]
ExtensionStatus = Literal["installed", "enabled", "disabled", "update_available"]


class ProviderCapability(ContractModel):
    operation_id: NonEmptyStr
    schema_versions: list[SemVer] = Field(default_factory=list)


class Provider(ContractModel):
    id: NonEmptyStr
    name: NonEmptyStr
    location: ProviderLocation
    status: ProviderStatus
    capabilities: list[ProviderCapability] = Field(default_factory=list)
    metadata: Metadata = Field(default_factory=dict)


class CapabilityQuery(ContractModel):
    operation_id: str | None = None
    location: ProviderLocation | None = None


class ExtensionPermission(ContractModel):
    name: NonEmptyStr
    description: str | None = None


class ExtensionDependency(ContractModel):
    extension_id: NonEmptyStr
    version_range: NonEmptyStr


class ExtensionRequirements(ContractModel):
    app_versions: NonEmptyStr
    permissions: list[ExtensionPermission] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)
    provider_ids: list[str] = Field(default_factory=list)
    runtime: str | None = None


class ExtensionManifest(ContractModel):
    id: NonEmptyStr
    name: NonEmptyStr
    version: SemVer
    publisher: NonEmptyStr
    type: ExtensionType
    requirements: ExtensionRequirements
    dependencies: list[ExtensionDependency] = Field(default_factory=list)
    ui_contributions: list[str] = Field(default_factory=list)


class Extension(ContractModel):
    manifest: ExtensionManifest
    status: ExtensionStatus
    installed_at: Timestamp | None = None
    signed: bool = False
    verified: bool = False


class ExtensionInstallRequest(ContractModel):
    source: Literal["registry", "package", "org"] = "registry"
    extension_id: NonEmptyStr
    version: SemVer | None = None
    accepted_permissions: list[str] = Field(default_factory=list)


class ExtensionInstallResult(ContractModel):
    extension_id: UUID
    status: ExtensionStatus
    manifest: ExtensionManifest


__all__ = [
    "CapabilityQuery",
    "Extension",
    "ExtensionDependency",
    "ExtensionInstallRequest",
    "ExtensionInstallResult",
    "ExtensionManifest",
    "ExtensionPermission",
    "ExtensionRequirements",
    "ExtensionStatus",
    "ExtensionType",
    "Provider",
    "ProviderCapability",
    "ProviderLocation",
    "ProviderStatus",
]

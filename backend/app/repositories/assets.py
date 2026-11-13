"""Asset library, versioning, relationship and lineage repositories."""

from __future__ import annotations

from uuid import UUID, uuid4

from ..errors import InvalidRequestError, NotFoundError
from ..schemas.asset import (
    Asset,
    AssetLineage,
    AssetLineageNode,
    AssetRegisterRequest,
    AssetVersionCreate,
    AssetRelationship,
    AssetUpdate,
    AssetVersion,
    RelationshipType,
)
from ..schemas.common import utcnow
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

# Relationship types that describe lineage (a child is produced from a parent).
LINEAGE_RELATIONSHIPS: frozenset[str] = frozenset(
    {"derived_from", "variant_of", "uses_input", "duplicate_of"}
)


class AssetRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    # --- Reads --------------------------------------------------------------

    def get(self, asset_id: UUID) -> Asset | None:
        return self._load(Collections.ASSETS, str(asset_id), Asset)

    def get_or_raise(self, asset_id: UUID) -> Asset:
        asset = self.get(asset_id)
        if asset is None:
            raise NotFoundError("Asset", str(asset_id))
        return asset

    def require_available(self, asset_id: UUID) -> Asset:
        """Return an asset that exists and is not soft-deleted."""
        asset = self.get_or_raise(asset_id)
        if asset.status == "deleted":
            raise InvalidRequestError(
                f"Asset '{asset_id}' is deleted and cannot be referenced.",
                code="asset_deleted",
            )
        return asset

    def list(
        self,
        *,
        project_id: UUID | None = None,
        asset_type: str | None = None,
        tag: str | None = None,
        search: str | None = None,
        cursor: UUID | None = None,
        limit: int = 50,
        include_deleted: bool = False,
    ) -> list[Asset]:
        assets = self._load_all(Collections.ASSETS, Asset)
        if project_id is not None:
            assets = [asset for asset in assets if asset.project_id == project_id]
        if asset_type is not None:
            assets = [asset for asset in assets if asset.type == asset_type]
        if tag is not None:
            assets = [asset for asset in assets if tag in asset.tags]
        if not include_deleted:
            assets = [asset for asset in assets if asset.status != "deleted"]
        if search:
            needle = search.strip().lower()
            if needle:
                assets = [
                    asset
                    for asset in assets
                    if needle in asset.name.lower()
                    or any(needle in asset_tag.lower() for asset_tag in asset.tags)
                ]

        assets.sort(key=lambda asset: (asset.created_at, str(asset.id)), reverse=True)

        if cursor is not None:
            cursor_asset = self.get(cursor)
            if cursor_asset is None:
                raise InvalidRequestError(
                    f"Cursor asset '{cursor}' does not exist.",
                    code="invalid_cursor",
                )
            cursor_key = (cursor_asset.created_at, str(cursor_asset.id))
            assets = [
                asset
                for asset in assets
                if (asset.created_at, str(asset.id)) < cursor_key
            ]

        return assets[:limit]

    def list_versions(self, asset_id: UUID) -> list[AssetVersion]:
        self.get_or_raise(asset_id)
        versions = self._load_all(Collections.ASSET_VERSIONS, AssetVersion)
        versions = [version for version in versions if version.asset_id == asset_id]
        versions.sort(key=lambda version: version.version, reverse=True)
        return versions

    def list_relationships(
        self, asset_id: UUID, relationship_type: RelationshipType | None = None
    ) -> list[AssetRelationship]:
        self.get_or_raise(asset_id)
        relationships = self._load_all(
            Collections.ASSET_RELATIONSHIPS, AssetRelationship
        )
        relationships = [
            relationship
            for relationship in relationships
            if relationship.from_asset_id == asset_id
            or relationship.to_asset_id == asset_id
        ]
        if relationship_type is not None:
            relationships = [
                relationship
                for relationship in relationships
                if relationship.type == relationship_type
            ]
        relationships.sort(
            key=lambda relationship: (
                relationship.created_at,
                str(relationship.id),
            ),
            reverse=True,
        )
        return relationships

    def lineage(self, asset_id: UUID, depth: int = 5) -> AssetLineage:
        root = self.get_or_raise(asset_id)
        nodes = [
            AssetLineageNode(asset_id=root.id, relationship=None, depth=0)
        ]
        if depth <= 0:
            return AssetLineage(root_asset_id=root.id, nodes=nodes)

        relationships = self._load_all(
            Collections.ASSET_RELATIONSHIPS, AssetRelationship
        )
        outgoing: dict[UUID, list[AssetRelationship]] = {}
        for relationship in relationships:
            if relationship.type in LINEAGE_RELATIONSHIPS:
                outgoing.setdefault(relationship.from_asset_id, []).append(relationship)
        for edges in outgoing.values():
            edges.sort(
                key=lambda relationship: (
                    relationship.created_at,
                    str(relationship.id),
                )
            )

        visited = {root.id}
        frontier = [root.id]
        for current_depth in range(1, depth + 1):
            next_frontier: list[UUID] = []
            for current in frontier:
                for relationship in outgoing.get(current, []):
                    parent_id = relationship.to_asset_id
                    if parent_id in visited:
                        continue
                    visited.add(parent_id)
                    nodes.append(
                        AssetLineageNode(
                            asset_id=parent_id,
                            relationship=relationship.type,
                            depth=current_depth,
                        )
                    )
                    next_frontier.append(parent_id)
            if not next_frontier:
                break
            frontier = next_frontier

        return AssetLineage(root_asset_id=root.id, nodes=nodes)

    # --- Writes -------------------------------------------------------------

    def register(
        self, payload: AssetRegisterRequest, *, user_id: UUID
    ) -> Asset:
        project = self.projects.get_or_raise(payload.project_id)
        if project.archived:
            raise InvalidRequestError(
                f"Project '{project.id}' is archived; new assets cannot be registered.",
                code="project_archived",
            )

        parent_ids: list[UUID] = []
        for parent_id in payload.parent_asset_ids:
            parent = self.require_available(parent_id)
            if parent.id not in parent_ids:
                parent_ids.append(parent.id)

        now = self.clock()
        asset = Asset(
            id=uuid4(),
            project_id=payload.project_id,
            type=payload.type,
            name=payload.name,
            status="ready",
            creator_id=user_id,
            version=1,
            tags=list(payload.tags),
            storage=payload.storage,
            props=payload.props,
            provenance=payload.provenance,
            parent_asset_ids=parent_ids,
            created_at=now,
            updated_at=now,
        )
        self._save(Collections.ASSETS, str(asset.id), asset)
        self._save_version(asset, created_at=now, created_by=user_id)
        for parent_id in parent_ids:
            self._save_relationship(
                from_asset_id=asset.id,
                to_asset_id=parent_id,
                relationship_type="derived_from",
                created_at=now,
            )
        return asset

    def create_version(
        self, asset_id: UUID, payload: AssetVersionCreate, *, user_id: UUID
    ) -> AssetVersion:
        asset = self.get_or_raise(asset_id)
        if asset.status == "deleted":
            raise InvalidRequestError(
                f"Asset '{asset_id}' is deleted and cannot be versioned.",
                code="asset_deleted",
            )
        project = self.projects.get_or_raise(asset.project_id)
        if project.archived:
            raise InvalidRequestError(
                f"Project '{project.id}' is archived; asset versions cannot be created.",
                code="project_archived",
            )

        now = self.clock()
        document = asset.model_dump(mode="json")
        document["version"] = asset.version + 1
        document["storage"] = payload.storage.model_dump(mode="json")
        document["updated_at"] = now.isoformat()
        updated = Asset.model_validate(document)
        self._save(Collections.ASSETS, str(asset_id), updated)
        return self._save_version(updated, created_at=now, created_by=user_id)

    def update(self, asset_id: UUID, payload: AssetUpdate) -> Asset:
        asset = self.get_or_raise(asset_id)
        if asset.status == "deleted":
            raise InvalidRequestError(
                f"Asset '{asset_id}' is deleted and cannot be updated.",
                code="asset_deleted",
            )
        changes = payload.model_dump(exclude_unset=True)

        if "name" in changes and changes["name"] is None:
            raise InvalidRequestError(
                "Asset name cannot be null.",
                code="invalid_request",
                details=[("name", "name is required and cannot be null")],
            )

        document = asset.model_dump(mode="json")
        for field in ("name", "tags", "metadata"):
            value = changes.get(field)
            if value is not None:
                document[field] = value
        document["updated_at"] = self.clock().isoformat()
        updated = Asset.model_validate(document)
        self._save(Collections.ASSETS, str(asset_id), updated)
        return updated

    def soft_delete(self, asset_id: UUID) -> Asset:
        asset = self.get_or_raise(asset_id)
        if asset.status == "deleted":
            return asset
        document = asset.model_dump(mode="json")
        document["status"] = "deleted"
        document["updated_at"] = self.clock().isoformat()
        deleted = Asset.model_validate(document)
        self._save(Collections.ASSETS, str(asset_id), deleted)
        return deleted

    # --- Internals ----------------------------------------------------------

    def _save_version(self, asset: Asset, *, created_at, created_by: UUID) -> AssetVersion:
        version = AssetVersion(
            asset_id=asset.id,
            version=asset.version,
            storage=asset.storage,
            created_at=created_at,
            created_by=created_by,
        )
        doc_id = f"{asset.id}:{version.version}"
        self._save(Collections.ASSET_VERSIONS, doc_id, version)
        return version

    def _save_relationship(
        self,
        *,
        from_asset_id: UUID,
        to_asset_id: UUID,
        relationship_type: RelationshipType,
        created_at,
    ) -> AssetRelationship:
        relationship = AssetRelationship(
            id=uuid4(),
            from_asset_id=from_asset_id,
            to_asset_id=to_asset_id,
            type=relationship_type,
            created_at=created_at,
        )
        self._save(
            Collections.ASSET_RELATIONSHIPS, str(relationship.id), relationship
        )
        return relationship


__all__ = ["AssetRepository", "LINEAGE_RELATIONSHIPS"]

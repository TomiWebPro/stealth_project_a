"""Authoritative downstream asset impact repository.

Impact is derived from the relationship store on every call: there is no second
index to drift and removing the router leaves no orphaned collection behind.
Where ``AssetRepository.lineage`` walks upstream (an asset's parents), this walks
downstream: every asset transitively derived from the root.

Traversal is breadth-first over inbound lineage relationships (child ->
root), bounded by ``max_depth``, cycle-safe via a visited set, and deterministic
across the memory and SQLite stores (edges are sorted by creation time + id).
Soft-deleted descendant assets are excluded from both the node list and
``total``. An unknown root raises ``NotFoundError`` so the shared 404 envelope
is used, matching the other asset-scoped routers.

Mirrors ``frontend/src/types/impact.ts`` contracts.
"""

from __future__ import annotations

from collections import deque

from ..schemas.asset import AssetRelationship
from ..schemas.common import utcnow
from ..schemas.impact import AssetImpact, ImpactNode
from ..storage.base import Collections, DocumentStore
from .assets import LINEAGE_RELATIONSHIPS, AssetRepository
from .base import BaseRepository


class ImpactRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        assets: AssetRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.assets = assets

    def impact(self, asset_id, *, max_depth: int = 5) -> AssetImpact:
        """Build a downstream impact view rooted at ``asset_id``.

        ``max_depth`` is the maximum number of edges to follow from the root;
        the root itself is always present as the implicit depth-0 ancestor and
        is never included in ``descendants``.
        """
        root = self.assets.get_or_raise(asset_id)

        # Index inbound edges: for each asset, the relationships of assets that
        # were derived from it. Only lineage-shaped relationships participate.
        incoming: dict = {}
        for relationship in self._load_all(
            Collections.ASSET_RELATIONSHIPS, AssetRelationship
        ):
            if relationship.type in LINEAGE_RELATIONSHIPS:
                incoming.setdefault(relationship.to_asset_id, []).append(relationship)
        for edges in incoming.values():
            edges.sort(key=lambda rel: (rel.created_at, str(rel.id)))

        descendants: list[ImpactNode] = []
        visited = {root.id}
        frontier = deque([(root.id, 0)])
        while frontier:
            current, depth = frontier.popleft()
            if depth >= max_depth:
                continue
            for relationship in incoming.get(current, []):
                child_id = relationship.from_asset_id
                if child_id in visited:
                    continue
                visited.add(child_id)
                asset = self.assets.get(child_id)
                if asset is None or asset.status == "deleted":
                    # Deleted assets (and their subtrees) are not part of impact.
                    continue
                descendants.append(
                    ImpactNode(
                        asset_id=child_id,
                        relationship=relationship.type,
                        depth=depth + 1,
                    )
                )
                frontier.append((child_id, depth + 1))

        return AssetImpact(
            root_asset_id=root.id,
            descendants=descendants,
            total=len(descendants),
        )


__all__ = ["ImpactRepository"]

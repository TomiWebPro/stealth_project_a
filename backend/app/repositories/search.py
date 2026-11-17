"""Cross-domain search repository.

Matches are derived from the authoritative stores on every call, so there is no
second index to drift and the feature is fully reversible: removing the router
leaves no collection behind. This mirrors the approach of ``AuditRepository``.

Ranking is intentionally simple and deterministic:

* a case-insensitive substring match in the primary text scores higher than a
  match further into that text (prefix matches approach 1.0);
* an asset tag match counts at 75% of a name match;
* ties break on kind order and insertion order, so results are stable across
  refetches (important for React keys and quick-finder keyboard navigation).
"""

from __future__ import annotations

from ..schemas.asset import Asset
from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.conversation import Conversation
from ..schemas.search import SearchResponse, SearchResult, SearchResultKind
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository

_KIND_ORDER: dict[str, int] = {"project": 0, "asset": 1, "conversation": 2}


def _score(text: str | None, needle: str) -> float:
    """Substring score in ``(0, 1]``; 0.0 means 'no match'."""
    if not text:
        return 0.0
    haystack = text.lower()
    index = haystack.find(needle)
    if index < 0:
        return 0.0
    # A prefix match scores 1.0; later matches decay gently.
    return round(1.0 - index / (len(haystack) + 1), 4)


class SearchRepository(BaseRepository):
    def __init__(self, store: DocumentStore, clock=utcnow) -> None:
        super().__init__(store, clock)

    def search(
        self,
        query: str,
        *,
        kind: SearchResultKind | None = None,
        limit: int = 50,
    ) -> SearchResponse:
        """Return up to ``limit`` ranked matches, best first.

        A blank query returns an empty result set rather than an error; the
        router enforces a non-empty ``q`` on the wire, but this keeps the
        repository safe for direct callers too.
        """
        needle = query.strip().lower()
        if not needle:
            return SearchResponse(query=query, results=[])

        # (negative score, kind order, insertion order, result)
        ranked: list[tuple[float, int, int, SearchResult]] = []
        sequence = 0

        if kind is None or kind == "project":
            for project in self._load_all(Collections.PROJECTS, Project):
                score = _score(project.name, needle)
                if score:
                    ranked.append(
                        (
                            -score,
                            _KIND_ORDER["project"],
                            sequence,
                            SearchResult(
                                kind="project",
                                id=project.id,
                                title=project.name,
                                subtitle=project.description,
                                project_id=project.id,
                                score=score,
                            ),
                        )
                    )
                sequence += 1

        if kind is None or kind == "asset":
            for asset in self._load_all(Collections.ASSETS, Asset):
                if asset.status == "deleted":
                    continue
                name_score = _score(asset.name, needle)
                tag_score = _score(" ".join(asset.tags), needle) * 0.75
                score = round(max(name_score, tag_score), 4)
                if score:
                    ranked.append(
                        (
                            -score,
                            _KIND_ORDER["asset"],
                            sequence,
                            SearchResult(
                                kind="asset",
                                id=asset.id,
                                title=asset.name,
                                subtitle=asset.type,
                                project_id=asset.project_id,
                                score=score,
                            ),
                        )
                    )
                sequence += 1

        if kind is None or kind == "conversation":
            projects = {
                project.id: project
                for project in self._load_all(Collections.PROJECTS, Project)
            }
            for conversation in self._load_all(Collections.CONVERSATIONS, Conversation):
                score = _score(conversation.title, needle)
                if score:
                    owner = projects.get(conversation.project_id)
                    ranked.append(
                        (
                            -score,
                            _KIND_ORDER["conversation"],
                            sequence,
                            SearchResult(
                                kind="conversation",
                                id=conversation.id,
                                title=conversation.title,
                                subtitle=owner.name if owner else None,
                                project_id=conversation.project_id,
                                score=score,
                            ),
                        )
                    )
                sequence += 1

        ranked.sort(key=lambda row: (row[0], row[1], row[2]))
        return SearchResponse(
            query=query,
            results=[row[3] for row in ranked[:limit]],
        )


__all__ = ["SearchRepository", "_KIND_ORDER", "_score"]

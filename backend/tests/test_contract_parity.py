"""Contract parity between `backend/app/schemas` and `frontend/src/types`.

The Pydantic models are canonical. These tests fail whenever the hand-written
TypeScript mirror drifts from them, so a shared-interface change cannot land on
one side only (AGENTS.md: "Do not silently change shared interfaces").

What is enforced, per contract:
  - the exported name exists on both sides;
  - the set of fields is identical;
  - field order is identical (it is documentation order, and drift there usually
    signals an accidental merge);
  - required vs. optional fields agree;
  - nullability agrees (in particular "required but nullable" vs. "optional");
  - primitives, literals, arrays, maps, UUIDs and timestamps map 1:1;
  - nested contract references point at the same contract on both sides;
  - enum / literal value sets are identical.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from contract_parity import (  # noqa: E402
    TsParseError,
    load_ts_types,
    pydantic_shapes,
    ts_enum_values,
    ts_shapes,
)
from pydantic import BaseModel  # noqa: E402

from app import schemas  # noqa: E402

# Declarations that the backend exposes but which intentionally have no
# TypeScript mirror, with the reason. Keep this empty unless there is a real
# reason; the test also guards against stale entries.
TS_ONLY_EXEMPT = {
    # `SettingDefault` narrows `OperationSetting.default` to the JSON scalars a
    # UI input can produce. Pydantic declares it inline, so there is no model
    # to compare against.
    "SettingDefault": "inline union in OperationSetting.default",
    # TypeScript spelling of the UUID wire value; Pydantic uses `UUID` directly.
    "Uuid": "primitive alias for Pydantic UUID fields",
}

PY_ONLY_EXEMPT: dict[str, str] = {
    # Implementation base class, not a wire contract.
    "ContractModel": "Pydantic base class",
    # Pydantic type aliases (Annotated[str, ...]) have no standalone TS form.
    "NonEmptyStr": "Pydantic string constraint alias",
    "Slug": "Pydantic string constraint alias",
    "SemVer": "Pydantic string constraint alias",
}


def _contract_models() -> dict[str, type[BaseModel]]:
    models: dict[str, type[BaseModel]] = {}
    for name in schemas.__all__:
        candidate = getattr(schemas, name)
        if isinstance(candidate, type) and issubclass(candidate, BaseModel):
            models[name] = candidate
    return models


PY_MODELS = _contract_models()
# Every name the backend publishes: models plus type aliases (Literal unions,
# Annotated string types) that TS can mirror as aliases.
PY_NAMES = set(schemas.__all__)
TS_DECLS = load_ts_types()

# Alias (type-only) names on the TS side that correspond to Pydantic models.
PAYLOAD_TS_NAMES = {name for name, decl in TS_DECLS.items() if decl.kind == "interface"}
ENUM_TS_NAMES = {
    name
    for name, decl in TS_DECLS.items()
    if decl.kind == "alias" and ts_enum_values(decl, TS_DECLS, set()) is not None
}

# TS aliases that are primitives rather than enums; excluded from enum checks.
PRIMITIVE_TS_ALIASES = {
    "Timestamp": "string",
    "Uuid": "string",
    "Metadata": "Record<string, unknown>",
    "Email": "string",
}

KIND_HINTS = set(PRIMITIVE_TS_ALIASES)


def _shape_mismatches(name: str) -> list[str]:
    model = PY_MODELS[name]
    decl = TS_DECLS[name]
    py_shapes = pydantic_shapes(model, set(PY_MODELS))
    ts_shape_map = ts_shapes(decl, TS_DECLS, KIND_HINTS)

    problems: list[str] = []
    py_order = list(py_shapes)
    ts_order = list(ts_shape_map)
    if py_order != ts_order:
        problems.append(f"field order differs: backend {py_order}, frontend {ts_order}")

    for field in sorted(set(py_shapes) - set(ts_shape_map)):
        problems.append(f"field only on backend: {py_shapes[field].describe()}")
    for field in sorted(set(ts_shape_map) - set(py_shapes)):
        problems.append(f"field only on frontend: {ts_shape_map[field].describe()}")
    for field in sorted(set(py_shapes) & set(ts_shape_map)):
        want, got = py_shapes[field], ts_shape_map[field]
        if want != got:
            problems.append(
                f"field {field!r}: backend {want.describe()!r} != frontend {got.describe()!r}"
            )
    return problems


def test_every_backend_contract_has_a_frontend_type() -> None:
    missing = sorted(set(PY_MODELS) - set(TS_DECLS) - set(PY_ONLY_EXEMPT))
    assert not missing, (
        "Backend contracts without a frontend/src/types declaration: "
        f"{missing}. Add the TypeScript mirror (or document an exemption)."
    )


def test_every_frontend_type_has_a_backend_contract() -> None:
    missing = sorted(set(TS_DECLS) - set(PY_NAMES) - set(TS_ONLY_EXEMPT))
    assert not missing, (
        "frontend/src/types declarations with no backend schema: "
        f"{missing}. Add the Pydantic contract (or document an exemption)."
    )


def test_frontend_payload_types_mirror_pydantic_models() -> None:
    problems: list[str] = []
    for name in sorted(PAYLOAD_TS_NAMES & set(PY_MODELS)):
        for problem in _shape_mismatches(name):
            problems.append(f"{name}: {problem}")
    assert not problems, "Contract parity broken:\n  " + "\n  ".join(problems)


def test_enum_values_match_backend_literals() -> None:
    from typing import Literal, get_args, get_origin

    problems: list[str] = []
    compared = 0
    for name in sorted(ENUM_TS_NAMES & set(PY_NAMES)):
        backend = getattr(schemas, name)
        if get_origin(backend) is not Literal:
            problems.append(f"{name}: frontend declares an enum but backend does not")
            continue
        expected = tuple(
            str(value).lower() if isinstance(value, bool) else str(value)
            for value in get_args(backend)
        )
        actual = ts_enum_values(TS_DECLS[name], TS_DECLS, KIND_HINTS)
        compared += 1
        if tuple(expected) != tuple(actual or ()):
            problems.append(f"{name}: backend {list(expected)} != frontend {list(actual or ())}")
    assert compared, "Expected to compare at least one enum contract."
    assert not problems, "Enum parity broken:\n  " + "\n  ".join(problems)


def test_exemptions_are_not_stale() -> None:
    for name in TS_ONLY_EXEMPT:
        assert name in TS_DECLS, f"Stale TS_ONLY_EXEMPT entry: {name}"
        assert name not in PY_NAMES, f"{name} is now also a backend contract; drop the exemption"
    for name in PY_ONLY_EXEMPT:
        assert name in PY_NAMES, f"Stale PY_ONLY_EXEMPT entry: {name}"
        assert name not in TS_DECLS, f"{name} now has a TS mirror; drop the exemption"


def test_api_version_matches_frontend() -> None:
    """`API_VERSION` and `API_PREFIX` must be identical literals on both sides."""
    common_ts = (Path(__file__).resolve().parents[2] / "frontend" / "src" / "types" / "common.ts").read_text(
        encoding="utf-8"
    )
    assert f'export const API_VERSION = "{schemas.API_VERSION}";' in common_ts
    assert f'export const API_PREFIX = "{schemas.API_PREFIX}";' in common_ts


def test_parser_rejects_unparseable_types(tmp_path: Path) -> None:
    """The parity checker must fail loudly rather than silently skip syntax."""
    from contract_parity import parse_type_file

    broken = tmp_path / "broken.ts"
    broken.write_text("export interface Foo { bar: SomeGeneric<Thing<1, 2>> }", encoding="utf-8")
    with pytest.raises(TsParseError):
        parse_type_file(broken)

    empty = tmp_path / "empty.ts"
    empty.write_text("// nothing to see\n", encoding="utf-8")
    with pytest.raises(TsParseError):
        parse_type_file(empty)

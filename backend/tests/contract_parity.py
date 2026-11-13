"""Lint the TypeScript contract declarations in frontend/src/types.

The backend Pydantic models in ``app/schemas`` are the canonical wire
contracts; ``frontend/src/types`` is a hand-written mirror. This module parses
the TypeScript side with a small, dependency-free scanner and normalizes both
sides into comparable *field shapes* so ``tests/test_contract_parity.py`` can
assert they match exactly (names, required/optional, nullability, kinds,
literals, array element types and nested contract references).

The scanner intentionally supports only the subset of TypeScript used in
``frontend/src/types``: exported ``type`` aliases and ``interface`` bodies with
``readonly`` members and inline ``//`` / ``/** */`` comments. Anything outside
that subset raises :class:`TsParseError` instead of being silently ignored, so
the checker can never pass on unparseable input.

Run directly to print a human-readable report::

    python -m tests.contract_parity
"""

from __future__ import annotations

import re
import sys
import types as pytypes
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Union, get_args, get_origin

REPO_ROOT = Path(__file__).resolve().parents[2]
TYPES_DIR = REPO_ROOT / "frontend" / "src" / "types"


class TsParseError(ValueError):
    """Raised when the TypeScript contracts use unsupported syntax."""


# --- Parsing ----------------------------------------------------------------


@dataclass(frozen=True)
class TsTypeDecl:
    name: str
    # "interface": ``body`` is the interface body text (without braces).
    # "alias": ``body`` is the aliased type expression.
    kind: str
    body: str


def _strip_comments(source: str) -> str:
    """Remove `//` and `/* */` comments, leaving string literals untouched."""
    out: list[str] = []
    index = 0
    length = len(source)
    while index < length:
        char = source[index]
        if char in {'"', "'", "`"}:
            quote = char
            out.append(char)
            index += 1
            while index < length:
                if source[index] == "\\":
                    out.append(source[index : index + 2])
                    index += 2
                    continue
                out.append(source[index])
                if source[index] == quote:
                    index += 1
                    break
                index += 1
            continue
        if source.startswith("//", index):
            newline = source.find("\n", index)
            index = length if newline == -1 else newline
            continue
        if source.startswith("/*", index):
            end = source.find("*/", index + 2)
            if end == -1:
                raise TsParseError("Unterminated block comment.")
            index = end + 2
            continue
        out.append(char)
        index += 1
    return "".join(out)


_INTERFACE_RE = re.compile(r"export\s+interface\s+(\w+)[^{]*\{", re.MULTILINE)
_TYPE_ALIAS_RE = re.compile(
    r"export\s+type\s+(\w+)\s*(?:<[^>]*>)?\s*=\s*", re.MULTILINE
)

# Generic wrappers the parser understands. Anything else is a syntax error
# rather than an accepted-but-unchecked type (see parse_type_file).
_ALLOWED_GENERICS = frozenset({"Record", "Array", "ReadonlyArray"})
_GENERIC_USE_RE = re.compile(r"\b(\w+)\s*<")


def _validate_generics(declaration: TsTypeDecl) -> None:
    for match in _GENERIC_USE_RE.finditer(declaration.body):
        if match.group(1) not in _ALLOWED_GENERICS:
            raise TsParseError(
                f"{declaration.name}: unsupported generic type "
                f"{match.group(1)}<...>."
            )


def parse_type_file(path: Path) -> dict[str, TsTypeDecl]:
    """Parse one file in frontend/src/types into ``name -> declaration``."""
    source = _strip_comments(path.read_text(encoding="utf-8"))
    declarations: dict[str, TsTypeDecl] = {}

    for match in _INTERFACE_RE.finditer(source):
        start = match.end()
        end = _find_matching(source, start - 1, "{", "}")
        declaration = TsTypeDecl(match.group(1), "interface", source[start:end])
        _validate_generics(declaration)
        declarations[match.group(1)] = declaration

    for match in _TYPE_ALIAS_RE.finditer(source):
        start = match.end()
        # A type alias ends at the first `;` outside of any brackets.
        end = start
        depth = 0
        while end < len(source):
            char = source[end]
            if char in "{([<":
                depth += 1
            elif char in "})]>":
                depth -= 1
            elif char == ";" and depth == 0:
                break
            end += 1
        declaration = TsTypeDecl(match.group(1), "alias", source[start:end])
        _validate_generics(declaration)
        declarations[match.group(1)] = declaration

    if not declarations:
        raise TsParseError(f"{path.name}: no exported type/interface declarations found.")
    return declarations


def _find_matching(source: str, open_index: int, opener: str, closer: str) -> int:
    depth = 0
    for index in range(open_index, len(source)):
        if source[index] == opener:
            depth += 1
        elif source[index] == closer:
            depth -= 1
            if depth == 0:
                return index
    raise TsParseError(f"Unbalanced {opener!r} starting at offset {open_index}.")


def load_ts_types(directory: Path = TYPES_DIR) -> dict[str, TsTypeDecl]:
    """Load every parsed declaration from ``directory`` (excluding index.ts)."""
    declarations: dict[str, TsTypeDecl] = {}
    for path in sorted(directory.glob("*.ts")):
        if path.name == "index.ts":
            continue
        for name, decl in parse_type_file(path).items():
            if name in declarations:
                raise TsParseError(f"Duplicate type declaration {name!r}.")
            declarations[name] = decl
    return declarations


# --- Normalized shape -------------------------------------------------------


@dataclass(frozen=True)
class FieldShape:
    """Comparable, implementation-agnostic description of one field.

    ``required`` and ``present`` are deliberately separate. On the wire the
    backend always emits every field (Pydantic ``model_dump``), so optional
    fields never look like ``presence: "required"``. What *does* break is
    response validation: a field with a non-None default is required in the
    response body, while an optional field may be omitted. Since the TS mirror
    is used for both requests and responses, a field must be typed optional
    (``?: T``) exactly when the backend model has a default.
    """

    name: str
    required: bool  # Pydantic: no default -> must be sent by clients.
    present: bool  # TS: emitted without `?`.
    nullable: bool
    kind: str
    # For literals: the allowed values. For arrays: the element FieldShape.
    # For refs: the referenced declaration name.
    detail: Any = None

    def describe(self) -> str:
        base = self.kind
        if self.kind == "literal":
            base = "literal[" + "|".join(self.detail) + "]"
        elif self.kind == "ref":
            base = f"ref:{self.detail}"
        elif self.kind == "array":
            base = f"array<{self.detail.describe()}>"
        optional = "" if self.present else "?"
        required = "!" if self.required else ""
        nullable = "|null" if self.nullable else ""
        return f"{self.name}{optional}{required}: {base}{nullable}"

    def with_presence(self, present: bool) -> FieldShape:
        return FieldShape(self.name, self.required, present, self.nullable, self.kind, self.detail)


# --- Pydantic -> FieldShape ----------------------------------------------------


def _strip_annotated(annotation: Any) -> Any:
    """Unwrap ``Annotated[...]`` and normalize PEP 604 unions."""
    if getattr(annotation, "__metadata__", None) is not None:
        return _strip_annotated(annotation.__origin__)
    if get_origin(annotation) in (Union, pytypes.UnionType):
        args = tuple(_strip_annotated(arg) for arg in get_args(annotation))
        return Union[args]  # type: ignore[valid-type]
    return annotation


def _is_pydantic_model(annotation: Any) -> bool:
    from pydantic import BaseModel as PydanticBase

    return isinstance(annotation, type) and issubclass(annotation, PydanticBase)


def pydantic_field_shape(name: str, field_info: Any, declarations: set[str]) -> FieldShape:
    """Describe one Pydantic model field.

    ``declarations`` is the set of contract names the TS side may reference.
    Pydantic models that appear *inside* the contracts under test are compared
    structurally by the parity test, so they are reported as inline literals
    here as well; the test compares them as ``literal`` on both sides is NOT
    wanted, so models are reported as ``ref`` and the TS side uses named types.
    """
    annotation = _strip_annotated(field_info.annotation)
    required = field_info.is_required()
    present = required

    nullable = False
    if get_origin(annotation) in (Union, pytypes.UnionType):
        args = get_args(annotation)
        if type(None) in args:
            nullable = True
            remaining = tuple(arg for arg in args if arg is not type(None))
            annotation = remaining[0] if len(remaining) == 1 else Union[remaining]  # type: ignore[valid-type]

    def shape(kind: str, detail: Any = None) -> FieldShape:
        return FieldShape(name, required, present, nullable, kind, detail)

    if annotation is type(None):
        return shape("null")

    origin = get_origin(annotation)
    if origin is Literal:
        values = tuple(
            str(value).lower() if isinstance(value, bool) else str(value)
            for value in get_args(annotation)
        )
        return shape("literal", values)
    if origin is list:
        (item,) = get_args(annotation) or (Any,)
        item_annotation = _strip_annotated(item)
        if _is_pydantic_model(item_annotation) and item_annotation.__name__ in declarations:
            element = FieldShape("item", True, True, False, "ref", item_annotation.__name__)
        else:
            element = pydantic_field_shape_of_type("item", item_annotation, declarations)
        return shape("array", element)
    if origin is dict or annotation is dict:
        return shape("object")
    if origin in (Union, pytypes.UnionType):
        return shape("union")
    if _is_pydantic_model(annotation) and annotation.__name__ in declarations:
        return shape("ref", annotation.__name__)

    return pydantic_field_shape_of_type(name, annotation, declarations, required, present, nullable)


def pydantic_field_shape_of_type(
    name: str,
    annotation: Any,
    declarations: set[str],
    required: bool = True,
    present: bool = True,
    nullable: bool = False,
) -> FieldShape:
    annotation = _strip_annotated(annotation)
    if annotation is bool:
        return FieldShape(name, required, present, nullable, "boolean")
    if annotation in (int, float):
        return FieldShape(name, required, present, nullable, "number")
    if annotation is str:
        return FieldShape(name, required, present, nullable, "string")
    if annotation is Any:
        return FieldShape(name, required, present, nullable, "unknown")
    if annotation is type(None):
        return FieldShape(name, required, present, True, "null")
    if _is_pydantic_model(annotation):
        if annotation.__name__ not in declarations:
            raise TypeError(
                f"{name!r} references Pydantic model {annotation.__name__!r}, "
                "which is not a published contract."
            )
        return FieldShape(name, required, present, nullable, "ref", annotation.__name__)

    origin = get_origin(annotation)
    if origin is dict or annotation is dict:
        return FieldShape(name, required, present, nullable, "object")
    if origin is list:
        (item,) = get_args(annotation) or (Any,)
        element = pydantic_field_shape_of_type("item", item, declarations)
        return FieldShape(name, required, present, nullable, "array", element)
    if origin is Literal:
        values = tuple(
            str(value).lower() if isinstance(value, bool) else str(value)
            for value in get_args(annotation)
        )
        return FieldShape(name, required, present, nullable, "literal", values)
    if origin in (Union, pytypes.UnionType):
        return FieldShape(name, required, present, nullable, "union")

    class_name = getattr(annotation, "__name__", None)
    if class_name == "UUID":
        return FieldShape(name, required, present, nullable, "uuid")
    if class_name == "datetime":
        return FieldShape(name, required, present, nullable, "timestamp")

    raise TypeError(f"Unsupported Pydantic annotation for {name!r}: {annotation!r}")


def pydantic_shapes(model: type, declarations: set[str]) -> dict[str, FieldShape]:
    return {
        name: pydantic_field_shape(name, info, declarations)
        for name, info in model.model_fields.items()
    }


# --- TypeScript -> FieldShape --------------------------------------------------


def _split_top_level(text: str, separator: str = "|") -> list[str]:
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    for char in text:
        if char in "{[<(":
            depth += 1
        elif char in "}]>)":
            depth -= 1
        if char == separator and depth == 0:
            parts.append("".join(current))
            current = []
            continue
        current.append(char)
    parts.append("".join(current))
    return [part.strip() for part in parts if part.strip()]


def _normalize_ws(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


_LITERAL_STRING_RE = re.compile(r'^"([^"]*)"$|^\'([^\']*)\'$')


_TS_MEMBER_RE = re.compile(r"^(?P<name>\w+)(?P<optional>\??)$")


def _split_members(body: str) -> list[str]:
    """Split an interface body into members.

    Members are separated by `;` or by a `,` that ends a type expression (i.e. a
    comma followed by the next `name`/`name?` member). Commas *inside* a type,
    such as `Record<string, string>`, are preserved because they are followed by
    a type rather than by another member name.
    """
    members: list[str] = []
    current: list[str] = []
    depth = 0
    index = 0
    while index < len(body):
        char = body[index]
        if char in "{[<(":
            depth += 1
        elif char in "}]>)":
            depth -= 1
        if depth == 0 and char == ";":
            members.append("".join(current))
            current = []
            index += 1
            continue
        if depth == 0 and char == ",":
            rest = body[index + 1 :]
            if re.match(r"\s*(?:readonly\s+)?\w+\??\s*:", rest):
                members.append("".join(current))
                current = []
                index += 1
                continue
        current.append(char)
        index += 1
    members.append("".join(current))
    return members


def _ts_shapes(
    body: str,
    required_key: str,
    declarations: dict[str, TsTypeDecl],
    kind_hints: set[str],
) -> dict[str, FieldShape]:
    if required_key not in declarations:
        raise TsParseError(f"Unknown declaration {required_key!r}.")
    shapes: dict[str, FieldShape] = {}
    for member in _split_members(body):
        member = _normalize_ws(member)
        if not member:
            continue
        member = re.sub(r"^readonly\s+", "", member)
        if ":" not in member:
            raise TsParseError(f"Unsupported member syntax: {member!r}")
        name, raw_type = member.split(":", 1)
        header = _TS_MEMBER_RE.match(name.strip())
        if header is None:
            raise TsParseError(f"Unsupported member name: {name!r}")
        optional = header.group("optional") == "?"
        field_name = header.group("name")
        shape = _ts_type_shape(
            field_name, _normalize_ws(raw_type), declarations, kind_hints
        )
        if optional and shape.required:
            # `name?: T` matches a Pydantic field with a default: neither
            # required on input nor unconditionally present on output.
            shape = FieldShape(
                shape.name, False, False, shape.nullable, shape.kind, shape.detail
            )
        if field_name in shapes:
            raise TsParseError(f"Duplicate member {field_name!r}.")
        shapes[field_name] = shape
    return shapes


_TS_KIND_BY_NAME = {
    "string": "string",
    "number": "number",
    "boolean": "boolean",
    "unknown": "unknown",
    "Uuid": "uuid",
    "Timestamp": "timestamp",
    "Metadata": "object",
    "Email": "string",
}


def _ts_type_shape(
    name: str,
    raw_type: str,
    declarations: dict[str, TsTypeDecl],
    kind_hints: set[str],
) -> FieldShape:
    members = _split_top_level(raw_type, "|")
    nullable = "null" in members
    members = [member for member in members if member != "null"]

    if not members:
        raise TsParseError(f"{name!r} has no non-null type.")
    if len(members) > 1:
        inline_values: list[str] = []
        for option in members:
            match = _LITERAL_STRING_RE.match(option)
            if match is None:
                inline_values = []
                break
            inline_values.append(match.group(1) or match.group(2))
        if inline_values:
            return FieldShape(name, True, True, nullable, "literal", tuple(inline_values))
        # Mixed non-literal union (e.g. `string | number | boolean`); the
        # Pydantic side normalizes these to ``union`` as well.
        return FieldShape(name, True, True, nullable, "union")
    member = members[0]

    array_match = re.fullmatch(r"(?:ReadonlyArray|Array)<(.+)>", member)
    if member.startswith("Record<"):
        return FieldShape(name, True, True, nullable, "object")
    inline_array = member.endswith("[]")
    if array_match or inline_array:
        element = array_match.group(1) if array_match else member[:-2]
        element_shape = _ts_type_shape("item", element.strip(), declarations, kind_hints)
        # Array elements are always present when the array is present.
        return FieldShape(name, True, True, nullable, "array", element_shape)

    if member.startswith('"') or member.startswith("'"):
        values = tuple(match.group(1) or match.group(2) for match in [_LITERAL_STRING_RE.match(member)] if match)
        if len(values) != 1:
            raise TsParseError(f"{name!r} has a malformed literal: {member!r}")
        return FieldShape(name, True, True, nullable, "literal", values)

    if member in _TS_KIND_BY_NAME:
        return FieldShape(name, True, True, nullable, _TS_KIND_BY_NAME[member])

    if member in declarations:
        if member in kind_hints:
            raise TsParseError(
                f"{name!r} references {member!r}, which is both a contract and a kind."
            )
        decl = declarations[member]
        if decl.kind == "alias":
            # `type X = ...` aliases carry no runtime identity: resolve them to
            # the underlying shape. This makes enum aliases compare as literals,
            # and primitive unions (e.g. SettingDefault) compare as unions.
            resolved = _ts_type_shape(
                name, _normalize_ws(decl.body), declarations, kind_hints
            )
            if nullable and not resolved.nullable:
                resolved = FieldShape(
                    resolved.name,
                    resolved.required,
                    resolved.present,
                    True,
                    resolved.kind,
                    resolved.detail,
                )
            return resolved
        return FieldShape(name, True, True, nullable, "ref", member)

    raise TsParseError(f"{name!r} uses an unsupported type: {member!r}")


def ts_shapes(
    decl: TsTypeDecl,
    declarations: dict[str, TsTypeDecl],
    kind_hints: set[str],
) -> dict[str, FieldShape]:
    if decl.kind == "interface":
        return _ts_shapes(decl.body, decl.name, declarations, kind_hints)

    # `export type Alias = "a" | "b";` — an enum alias.
    shape = _ts_type_shape(decl.name, _normalize_ws(decl.body), declarations, kind_hints)
    return {decl.name: shape}


def ts_enum_values(
    decl: TsTypeDecl,
    declarations: dict[str, TsTypeDecl],
    kind_hints: set[str],
) -> tuple[str, ...] | None:
    """Return the literal members of an alias like `type X = "a" | "b"`, if any."""
    if decl.kind == "interface":
        return None
    members = _split_top_level(_normalize_ws(decl.body), "|")
    values: list[str] = []
    for member in members:
        match = _LITERAL_STRING_RE.match(member)
        if match is None:
            return None
        values.append(match.group(1) or match.group(2))
    return tuple(values)


# --- Comparison helpers -------------------------------------------------------


def format_shape(shape: FieldShape) -> str:
    return shape.describe()


def describe_mapping(shapes: Mapping[str, FieldShape]) -> list[str]:
    return [shapes[name].describe() for name in shapes]


def diff_shapes(
    expected: Mapping[str, FieldShape], actual: Mapping[str, FieldShape]
) -> list[str]:
    """Return human-readable differences between two field-shape mappings."""
    problems: list[str] = []
    for name in sorted(set(expected) - set(actual)):
        problems.append(f"missing field {expected[name].describe()!r}")
    for name in sorted(set(actual) - set(expected)):
        problems.append(f"unexpected field {actual[name].describe()!r}")
    for name in sorted(set(expected) & set(actual)):
        want, got = expected[name], actual[name]
        if want != got:
            problems.append(f"field differs: expected {want.describe()!r}, got {got.describe()!r}")
    return problems


def main() -> int:
    """Print a summary of the parsed TypeScript contracts."""
    try:
        declarations = load_ts_types()
    except TsParseError as error:
        print(f"parse error: {error}")
        return 1
    for name in sorted(declarations):
        print(f"{name}: {_normalize_ws(declarations[name].body)[:100]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

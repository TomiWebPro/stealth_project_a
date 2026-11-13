# Project folder conventions

Ported from the Backlot studio-app folder spec (`docs/FOLDERS.md` + the
`core/paths.py`, `core/template.py`, `core/links.py` implementation that proved
it: template-copy project creation, `Ver_NNN` versioning, `Output/` vs
`Publish/`, reference-never-copy shared libraries). Ported as conventions and
naming rules — not code. One deliberate difference from Backlot: **the backend
registry stays authoritative** (platform principle). The on-disk tree is the
canonical local materialization of a project; tooling validates it against the
backend, never the other way round.

## The tree

```
<studio-root>/
├── Pipeline/                           NON-project shared defaults (generic
│   ├── Loras/                          models, scripts, workflows)
│   ├── Scripts/
│   └── Workflows/
│       ├── Image/ {Composition, Dataset, Design, Edit}
│       └── Video/ {Edit, Gen, Upscale}
└── Projects/
    └── Default/                        TEMPLATE (dirs only, 0 files) — copied
        │                               to create every project
        ├── Assets/
        │   ├── Char/                   kind category (user-extensible)
        │   │   └── Asset_Name/         template placeholder — renamed on create
        │   │       └── Ver_001/        bump → new Ver_002/… (never mutate)
        │   │           ├── Dataset/  {Output, Publish}
        │   │           ├── Design/   {Output, Publish}
        │   │           ├── Loras/    {Output, Publish}
        │   │           └── Workflows/ {Dataset, Design, Edit}
        │   ├── Env/                   same scaffold
        │   └── Prop/                  same scaffold
        ├── Resources/
        │   ├── Loras/                 project-local library (+ auto reference links)
        │   ├── Scripts/
        │   └── Workflows/
        │       ├── Image/ {Composition, Dataset, Design, Edit}
        │       └── Video/ {Edit, Gen, Upscale}
        └── Shots/
            └── Seq_shot/              template placeholder (e.g. s01_c01)
                └── Ver_001/           sequence + shot combined token
                    ├── Compose/  {Output, Publish}
                    ├── Dataset/  {Output, Publish}
                    ├── Loras/    {Output, Publish}
                    └── Workflows/ {Composition, Dataset, Edit}
```

Workflow-type folder names above are the default production profile, not a
closed list: projects extend kinds (`Char/Env/Prop` + vehicle, creature, …)
and workflow types by editing the checked-in template manifest, never with
hidden per-tool paths.

## Rules (UI and backend must enforce)

1. **Default/ is a template.** New projects = copy. Template contains
   directories ONLY (0 files); versions are folders.
2. **Version by folder, not filename.** `Ver_NNN` per asset AND per shot;
   bumping creates a new folder, never mutates. Format: `Ver_` + zero-padded
   number (`Ver_001`). Published files also carry the `_vNNN` suffix
   (`hero_v003.png`, i.e. `_v` + 3+ digits before end/dot/slash).
3. **Output/ vs Publish/.** Working files vs approved immutable deliverables.
   Publish is a ceremony: explicit action + comment, thumbnail, sidecar JSON.
4. **Shared libraries are referenced, never copied.** `Pipeline/` (studio
   shared) and the global library link into `Resources/` as relative symlinks
   so the studio root stays movable; where symlinks are unavailable (locked-down
   Windows) the fallback is a `<name>.link.txt` marker holding the absolute
   source path. References are recorded in `Resources/.links.json`
   (`{target: source}`, project-relative targets). Nothing outside the project
   is ever written — deleting a project can never delete shared weights.
5. **Tools read/write the right dirs automatically.** No file browser, no paths
   to type. Pickers and galleries are live views of the tree.
6. **Naming.** Folder-safe names: lowercase `[a-z0-9_]`, no spaces
   (`sanitize`: anything else → `_`). Kind tokens keep their case (`Char`,
   not `char`); accept legacy spellings (`character`→`Char`) at input.
   Shot token = `{sequence}_{shot}` (`s01` + `c01` → `s01_c01`).
7. **Cross-platform paths.** Build every path with `pathlib`; tests must pass
   on Windows (`\`, drive letters, `.lnk`) as well as Linux/macOS.

## Platform mapping (how this fits the architecture)

- **Authority.** Backend registry (PostgreSQL / local SQLite) is the source of
  truth for projects, assets, versions. The tree above is the local
  project-root layout the backend manages and validates
  (`validate`/`verify`-style checks against the checked-in template manifest).
- **Versions.** `Ver_NNN` folder number ↔ `AssetVersion.version`
  (`schemas/asset.py`); `_vNNN` file suffix mirrors it on published files.
- **Storage.** Local `StorageRef.key` = the project-relative POSIX path under
  this layout; S3 keys use the same relative path under the project prefix.
  Either backend serves the same tree.
- **Library publishing.** `ASSET_MANAGEMENT.md` "publish to reusable libs" is
  this spec's `Publish/` + reference-link mechanism: promote into
  `Pipeline/` (or the global library), consume via links, never copies.
- **Manifest.** Each project carries a small `project.json` mirror
  (`{schema, name, template_version, …}`) so a root is self-describing even
  before the backend indexes it.

## Build order

- Phase 2 (projects API): adopt the tree for local project roots; template-copy
  creation; `project.json` manifest.
- Phase 3 (asset management): `Ver_NNN` ↔ `AssetVersion`; `Output/` vs
  `Publish/` + publish ceremony (comment, thumbnail, sidecar JSON);
  reference links + `.links.json` with a dry-run plan mode.

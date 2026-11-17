import { useEffect, useMemo, useRef, useState } from "react";
import {
  resultEntries,
  screenEntries,
  type PaletteEntry,
} from "../features/search/quickFinderHelpers";
import { useSearch } from "../hooks/useQueries";
import { errorMessage } from "../lib/errors";
import { useUiStore } from "../stores/uiStore";
import { Badge } from "./Badge";
import { Icon } from "./Icon";
import { cn } from "./cn";

/** Modal body, mounted fresh each time the palette opens (clean local state). */
function PaletteDialog({ onClose }: { readonly onClose: () => void }) {
  const navigate = useUiStore((state) => state.navigate);
  const setAssetsProjectId = useUiStore((state) => state.setAssetsProjectId);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasQuery = query.trim().length > 0;
  // Hook is gated on non-blank text inside useSearch; blank queries never fetch.
  const search = useSearch(query.trim(), { limit: 8 });

  const screens = useMemo(() => screenEntries(query), [query]);
  const results = useMemo(() => resultEntries(search.data?.results), [search.data]);
  // Flat list drives roving keyboard focus across both sections.
  const entries = useMemo(() => [...screens, ...results], [screens, results]);
  const activeIndex = Math.min(selected, Math.max(entries.length - 1, 0));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function choose(index: number) {
    const entry = entries[index];
    if (!entry) return;
    const { route, params, assetsProjectId } = entry.navigation;
    if (assetsProjectId) setAssetsProjectId(assetsProjectId);
    navigate(route, params);
    onClose();
  }

  function row(entry: PaletteEntry, index: number) {
    const active = index === activeIndex;
    return (
      <li key={entry.key} role="option" aria-selected={active}>
        <button
          type="button"
          tabIndex={-1}
          onMouseEnter={() => setSelected(index)}
          onClick={() => choose(index)}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm",
            active ? "bg-accent-muted text-accent" : "text-content-muted hover:bg-surface-overlay",
          )}
        >
          <Icon name={entry.icon} />
          <span className="truncate font-medium">{entry.label}</span>
          {entry.badge ? <Badge tone="neutral">{entry.badge}</Badge> : null}
          {entry.subtitle ? (
            <span className="ml-auto truncate text-2xs text-content-subtle">{entry.subtitle}</span>
          ) : null}
        </button>
      </li>
    );
  }

  // Search section states: hint (blank), searching, error, empty, populated.
  let searchStatus: string | null = null;
  if (!hasQuery) {
    searchStatus = "Type to search projects, assets and conversations";
  } else if (search.isPending) {
    searchStatus = "Searching…";
  } else if (search.isError) {
    searchStatus = `Search unavailable — ${errorMessage(search.error)}`;
  } else if (results.length === 0) {
    searchStatus = "No matching projects, assets or conversations";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[12vh]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick switcher"
        className="w-full max-w-lg overflow-hidden rounded-lg border border-line-strong bg-surface shadow-panel"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            // Restart keyboard selection on every keystroke (no sync-in-effect).
            setQuery(event.target.value);
            setSelected(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setSelected((index) => Math.min(index + 1, entries.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setSelected((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              choose(activeIndex);
            }
          }}
          placeholder="Search screens and content…"
          aria-label="Search screens and content"
          className="w-full border-b border-line bg-surface px-4 py-3 text-sm text-content placeholder:text-content-subtle focus:outline-none"
        />
        <ul className="max-h-80 overflow-y-auto p-2" role="listbox" aria-label="Screens and results">
          {screens.length > 0 ? (
            <li
              role="presentation"
              className="px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-content-subtle"
            >
              Screens
            </li>
          ) : null}
          {screens.map((entry, index) => row(entry, index))}

          {hasQuery ? (
            <li
              role="presentation"
              className="mt-1 border-t border-line px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-content-subtle"
            >
              Search results
            </li>
          ) : null}
          {results.map((entry, index) => row(entry, screens.length + index))}
          {searchStatus ? (
            <li role="presentation" className="px-3 py-3 text-center text-xs text-content-muted">
              {searchStatus}
            </li>
          ) : null}
        </ul>
        <p className="border-t border-line px-3 py-2 text-2xs text-content-subtle">
          ↑↓ to navigate · Enter to open · Esc to close
        </p>
      </div>
    </div>
  );
}

/**
 * Cmd/Ctrl+K quick switcher. Screens come from the static nav model and
 * cross-domain results come from `useSearch` (ApiClient hooks only); navigation
 * goes through the UI store, so no screen/route changes.
 */
export function CommandPalette() {
  const open = useUiStore((state) => state.commandPaletteOpen);
  const setOpen = useUiStore((state) => state.setCommandPaletteOpen);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const state = useUiStore.getState();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        state.setCommandPaletteOpen(!state.commandPaletteOpen);
      } else if (event.key === "Escape" && state.commandPaletteOpen) {
        state.setCommandPaletteOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!open) return null;
  return <PaletteDialog onClose={() => setOpen(false)} />;
}

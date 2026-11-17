import { useEffect, useMemo, useRef, useState } from "react";
import { NAV_GROUPS, type NavItem } from "../navigation/routes";
import { useUiStore } from "../stores/uiStore";
import { Icon } from "./Icon";
import { cn } from "./cn";

interface Result {
  readonly item: NavItem;
  readonly groupLabel: string;
}

function searchRoutes(query: string): readonly Result[] {
  const q = query.trim().toLowerCase();
  const results: Result[] = [];
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      const hay = `${item.label} ${item.description} ${item.id}`.toLowerCase();
      if (q.length === 0 || hay.includes(q)) {
        results.push({ item, groupLabel: group.label });
      }
    }
  }
  return results;
}

/** Modal body, mounted fresh each time the palette opens (clean local state). */
function PaletteDialog({ onClose }: { readonly onClose: () => void }) {
  const navigate = useUiStore((state) => state.navigate);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchRoutes(query), [query]);
  const activeIndex = Math.min(selected, Math.max(results.length - 1, 0));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function choose(index: number) {
    const result = results[index];
    if (!result) return;
    navigate(result.item.id);
    onClose();
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
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setSelected((index) => Math.min(index + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setSelected((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              choose(activeIndex);
            }
          }}
          placeholder="Search screens…"
          aria-label="Search screens"
          className="w-full border-b border-line bg-surface px-4 py-3 text-sm text-content placeholder:text-content-subtle focus:outline-none"
        />
        <ul className="max-h-80 overflow-y-auto p-2" role="listbox" aria-label="Screens">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-content-muted">No matching screens</li>
          ) : (
            results.map((result, index) => (
              <li key={result.item.id} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => choose(index)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm",
                    index === activeIndex
                      ? "bg-accent-muted text-accent"
                      : "text-content-muted hover:bg-surface-overlay",
                  )}
                >
                  <Icon name={result.item.icon} />
                  <span className="font-medium">{result.item.label}</span>
                  <span className="ml-auto text-2xs text-content-subtle">{result.groupLabel}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="border-t border-line px-3 py-2 text-2xs text-content-subtle">
          ↑↓ to navigate · Enter to open · Esc to close
        </p>
      </div>
    </div>
  );
}

/**
 * Cmd/Ctrl+K quick switcher. Pure UI: results come from the static nav model
 * and navigation goes through the UI store, so no screen/route changes.
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

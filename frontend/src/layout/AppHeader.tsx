import type { ReactNode } from "react";
import { env } from "../lib/env";
import { findNavItem } from "../navigation/routes";
import { useUiStore } from "../stores/uiStore";
import { Badge } from "../ui/Badge";
import { IconButton } from "../ui/IconButton";

export interface AppHeaderProps {
  /** Slot for global actions (search, command menu, profile). */
  readonly actions?: ReactNode;
}

/** Global application header: brand, current location, and header actions. */
export function AppHeader({ actions }: AppHeaderProps) {
  const activeRoute = useUiStore((state) => state.activeRoute);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const current = findNavItem(activeRoute);

  return (
    <header className="flex h-(--layout-header-height) shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
      <IconButton
        label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-pressed={sidebarCollapsed}
        onClick={toggleSidebar}
      >
        <span aria-hidden="true">☰</span>
      </IconButton>

      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-md bg-accent text-sm font-bold text-accent-contrast">
          S
        </span>
        <span className="text-sm font-semibold tracking-wide text-content">
          Studio
        </span>
      </div>

      <span className="text-content-subtle" aria-hidden="true">
        /
      </span>
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex items-center gap-2 text-sm">
          <li className="truncate font-medium text-content">
            {current?.label ?? "Home"}
          </li>
        </ol>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {env.apiMode === "mock" ? <Badge tone="accent">Mock data</Badge> : null}
        {actions}
      </div>
    </header>
  );
}

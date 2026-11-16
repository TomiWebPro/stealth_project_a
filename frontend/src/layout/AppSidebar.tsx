import type { MouseEvent } from "react";
import { NAV_GROUPS, routeToPath, type RouteId } from "../navigation/routes";
import { useUiStore } from "../stores/uiStore";
import { cn } from "../ui/cn";

interface SidebarItemProps {
  readonly id: RouteId;
  readonly label: string;
  readonly glyph: string;
  readonly active: boolean;
  readonly collapsed: boolean;
  readonly onSelect: () => void;
}

function SidebarItem({ id, label, glyph, active, collapsed, onSelect }: SidebarItemProps) {
  // Render a real link for semantics (focusable, openable in a new tab), but
  // intercept plain left-clicks so in-app navigation goes through the store.
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelect();
  }

  return (
    <a
      href={routeToPath(id)}
      onClick={handleClick}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm",
        "transition-colors duration-(--duration-fast)",
        active
          ? "bg-accent-muted text-accent"
          : "text-content-muted hover:bg-surface-overlay hover:text-content",
        collapsed && "justify-center px-0",
      )}
    >
      <span aria-hidden="true" className="w-4 shrink-0 text-center text-base leading-none">
        {glyph}
      </span>
      {collapsed ? null : <span className="truncate">{label}</span>}
    </a>
  );
}

/** Primary application navigation. Collapses to an icon rail via UI store. */
export function AppSidebar() {
  const activeRoute = useUiStore((state) => state.activeRoute);
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const navigate = useUiStore((state) => state.navigate);

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-surface p-3 transition-[width] duration-(--duration-base)",
        collapsed ? "w-(--layout-sidebar-width-collapsed)" : "w-(--layout-sidebar-width)",
      )}
    >
      {NAV_GROUPS.map((group) => (
        <nav key={group.id} aria-label={group.label} className="flex flex-col gap-1">
          <p
            className={cn(
              "px-2.5 pb-1 text-2xs font-semibold uppercase tracking-wider text-content-subtle",
              collapsed && "sr-only",
            )}
          >
            {group.label}
          </p>
          {group.items.map((item) => (
            <SidebarItem
              key={item.id}
              id={item.id}
              label={item.label}
              glyph={item.glyph}
              collapsed={collapsed}
              active={activeRoute === item.id}
              onSelect={() => navigate(item.id)}
            />
          ))}
        </nav>
      ))}

      {collapsed ? null : (
        <div className="mt-auto rounded-md border border-line bg-surface-raised p-3 text-xs text-content-muted">
          <p className="font-medium text-content">Phase 1b · Mock screens</p>
          <p className="mt-1 leading-relaxed">
            Projects, assets, jobs, and lineage render from the mock API client.
          </p>
        </div>
      )}
    </aside>
  );
}

import type { KeyboardEvent, MouseEvent } from "react";
import { NAV_GROUPS, routeToPath, type RouteId } from "../navigation/routes";
import { useUiStore } from "../stores/uiStore";
import { cn } from "../ui/cn";
import { Icon, type IconName } from "../ui/Icon";

interface SidebarItemProps {
  readonly id: RouteId;
  readonly label: string;
  readonly icon: IconName;
  readonly active: boolean;
  readonly collapsed: boolean;
  readonly onSelect: () => void;
  readonly onArrow: (element: HTMLAnchorElement, direction: -1 | 1) => void;
}

function SidebarItem({ id, label, icon, active, collapsed, onSelect, onArrow }: SidebarItemProps) {
  // Render a real link for semantics (focusable, openable in a new tab), but
  // intercept plain left-clicks so in-app navigation goes through the store.
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelect();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      onArrow(event.currentTarget, event.key === "ArrowDown" ? 1 : -1);
    }
  }

  return (
    <a
      href={routeToPath(id)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
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
      <span aria-hidden="true" className="w-4 shrink-0 text-center leading-none">
        <Icon name={icon} />
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

  // Roving focus across all nav links so keyboard users can traverse the rail
  // with Up/Down without tabbing through every item.
  function moveFocus(from: HTMLElement, direction: -1 | 1) {
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>("aside nav a[href]"),
    );
    const index = links.indexOf(from as HTMLAnchorElement);
    if (index === -1 || links.length === 0) return;
    const next = links[(index + direction + links.length) % links.length];
    next?.focus();
  }

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
              icon={item.icon}
              collapsed={collapsed}
              active={activeRoute === item.id}
              onSelect={() => navigate(item.id)}
              onArrow={(element, direction) => moveFocus(element, direction)}
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

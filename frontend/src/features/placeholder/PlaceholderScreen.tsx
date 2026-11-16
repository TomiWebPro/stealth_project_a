import type { RouteId } from "../../navigation/routes";
import { findNavItem } from "../../navigation/routes";
import { PageHeader } from "../../layout/AppLayout";
import { Card } from "../../ui/Card";
import { EmptyState } from "../../ui/Feedback";

interface PlaceholderScreenProps {
  readonly route: RouteId;
  readonly title: string;
  readonly description: string;
  readonly note?: string;
}

/**
 * Intentional placeholder for routes not yet backed by a full Phase 1b screen.
 * Ensures every RouteId resolves to an explicit view (no silent fallbacks).
 */
export function PlaceholderScreen({
  route,
  title,
  description,
  note,
}: PlaceholderScreenProps) {
  const item = findNavItem(route);
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
      />
      <Card className="p-6">
        <EmptyState
          title={`${title} (placeholder)`}
          description={
            note ??
            item?.description ??
            "This area is intentionally stubbed in the current frontend-mock phase."
          }
        />
      </Card>
    </div>
  );
}

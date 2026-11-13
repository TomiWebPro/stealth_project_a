import { findNavItem } from "../navigation/routes";
import { useUiStore } from "../stores/uiStore";
import { PageHeader } from "../layout/AppLayout";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/Feedback";

/** Placeholder for routes whose screens arrive in later roadmap phases. */
export function PlaceholderScreen() {
  const activeRoute = useUiStore((state) => state.activeRoute);
  const item = findNavItem(activeRoute);

  return (
    <div>
      <PageHeader
        title={item?.label ?? "Coming soon"}
        description={item?.description}
      />
      <Card className="p-6">
        <EmptyState
          title={`${item?.label ?? "This screen"} is not built yet`}
          description="This route is reserved in the Phase 1 navigation shell. Its screen will be implemented in an upcoming phase."
        />
      </Card>
    </div>
  );
}

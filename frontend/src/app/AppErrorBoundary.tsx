import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/Feedback";

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly error: Error | null;
}

/**
 * Last-resort UI boundary around the active screen. Data-loading failures are
 * handled per-screen with retry; this catches unexpected render errors so the
 * shell stays usable and the user can retry without a full reload.
 */
export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep the message in the console for diagnosis without surfacing internals.
    console.error("Screen render failed", error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <Card className="p-6">
        <EmptyState
          title="This screen could not be displayed"
          description={error.message || "An unexpected error occurred while rendering."}
          action={
            <Button variant="primary" size="sm" onClick={this.handleRetry}>
              Try again
            </Button>
          }
        />
      </Card>
    );
  }
}

import { ApiProvider } from "./app/ApiProvider";
import { AppErrorBoundary } from "./app/AppErrorBoundary";
import { AssetsBrowserScreen } from "./features/assets/AssetsBrowserScreen";
import { ChatScreen } from "./features/chat/ChatScreen";
import { ExtensionsScreen } from "./features/extensions/ExtensionsScreen";
import { HomeScreen } from "./features/home/HomeScreen";
import { JobsScreen } from "./features/jobs/JobsScreen";
import { PlaceholderScreen } from "./features/placeholder/PlaceholderScreen";
import { ProjectsScreen } from "./features/projects/ProjectsScreen";
import { ProvidersScreen } from "./features/providers/ProvidersScreen";
import { SettingsScreen } from "./features/settings/SettingsScreen";
import { WorkspacesScreen } from "./features/workspaces/WorkspacesScreen";
import { AppHeader } from "./layout/AppHeader";
import { AppLayout } from "./layout/AppLayout";
import { AppSidebar } from "./layout/AppSidebar";
import { CommandPalette } from "./ui/CommandPalette";
import { resolveApiClient } from "./lib/createApiClient";
import { useUiStore } from "./stores/uiStore";

const apiClient = resolveApiClient();

function CurrentScreen() {
  const activeRoute = useUiStore((state) => state.activeRoute);

  switch (activeRoute) {
    case "home":
      return <HomeScreen />;
    case "chat":
      return <ChatScreen />;
    case "projects":
      return <ProjectsScreen />;
    case "assets":
      return <AssetsBrowserScreen />;
    case "jobs":
      return <JobsScreen />;
    case "workspaces":
      return <WorkspacesScreen />;
    case "extensions":
      return <ExtensionsScreen />;
    case "providers":
      return <ProvidersScreen />;
    case "settings":
      return <SettingsScreen />;
    default: {
      const exhaustive: never = activeRoute;
      return <PlaceholderScreen route="home" title="Unknown" description={`Unknown route: ${String(exhaustive)}`} />;
    }
  }
}

/**
 * Application root: provides the API client, then composes the reusable
 * shell layout (header / sidebar / main) around the active screen.
 */
export function App() {
  return (
    <ApiProvider client={apiClient}>
      <AppLayout header={<AppHeader />} sidebar={<AppSidebar />}>
        <AppErrorBoundary>
          <CurrentScreen />
        </AppErrorBoundary>
      </AppLayout>
      <CommandPalette />
    </ApiProvider>
  );
}

export default App;

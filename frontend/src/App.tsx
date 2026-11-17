import { ApiProvider } from "./app/ApiProvider";
import { AssetsBrowserScreen } from "./features/assets/AssetsBrowserScreen";
import { ChatScreen } from "./features/chat/ChatScreen";
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
      return (
        <PlaceholderScreen
          route="extensions"
          title="Extensions"
          description="Connectors and add-ons with permissioned capabilities."
          note="Extension platform arrives in Phase 5; this screen is an intentional placeholder."
        />
      );
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
        <CurrentScreen />
      </AppLayout>
    </ApiProvider>
  );
}

export default App;

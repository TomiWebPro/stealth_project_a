import { ApiProvider } from "./app/ApiProvider";
import { HomeScreen } from "./features/home/HomeScreen";
import { ProjectsScreen } from "./features/projects/ProjectsScreen";
import { PlaceholderScreen } from "./features/PlaceholderScreen";
import { AppHeader } from "./layout/AppHeader";
import { AppLayout } from "./layout/AppLayout";
import { AppSidebar } from "./layout/AppSidebar";
import { resolveApiClient } from "./lib/createApiClient";
import { useUiStore } from "./stores/uiStore";

const apiClient = resolveApiClient();

function CurrentScreen() {
  const activeRoute = useUiStore((state) => state.activeRoute);

  if (activeRoute === "home") {
    return <HomeScreen />;
  }
  if (activeRoute === "projects") {
    return <ProjectsScreen />;
  }
  return <PlaceholderScreen />;
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

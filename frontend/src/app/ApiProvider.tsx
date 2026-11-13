import type { ReactNode } from "react";
import { ApiContext } from "./apiContext";
import type { ApiClient } from "../lib/apiClient";

export interface ApiProviderProps {
  readonly client: ApiClient;
  readonly children: ReactNode;
}

/** Provides the active API client to the tree. Read it via `useApiClient`. */
export function ApiProvider({ client, children }: ApiProviderProps) {
  return <ApiContext value={client}>{children}</ApiContext>;
}

import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export interface AppSettings {
  mapTabEnabled: boolean;
  wrappedEnabled: boolean;
}

// Defaults match the backend's schema defaults, so a still-loading fetch
// never has to hide something that should be visible by default.
const DEFAULT_SETTINGS: AppSettings = { mapTabEnabled: true, wrappedEnabled: true };

export function useAppSettings(): AppSettings {
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<{ settings: AppSettings }>("/settings"),
    staleTime: 30_000,
  });
  return data?.settings ?? DEFAULT_SETTINGS;
}

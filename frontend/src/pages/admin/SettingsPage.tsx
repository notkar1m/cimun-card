import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { isApiError, useAuth } from "../../auth/AuthContext";
import { Alert, Spinner, Toggle } from "../../components/ui";

interface Settings {
  mapTabEnabled: boolean;
  wrappedEnabled: boolean;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isOwner = !!user?.isOwner;
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<{ settings: Settings }>("/settings"),
  });
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<keyof Settings | null>(null);

  async function handleToggle(key: keyof Settings, value: boolean) {
    setError(null);
    setSavingKey(key);
    try {
      const res = await api.patch<{ settings: Settings }>("/admin/settings", { [key]: value });
      queryClient.setQueryData(["settings"], { settings: res.settings });
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong");
    } finally {
      setSavingKey(null);
    }
  }

  const settings = data?.settings;

  return (
    <div className="page-narrow" style={{ padding: "8px 16px" }}>
      <h1>Settings</h1>
      <p className="muted">Control which delegate-facing features are turned on.</p>
      {!isOwner && (
        <p className="muted" style={{ marginTop: -8 }}>
          You can see these settings, but only the account owner can change them.
        </p>
      )}

      {error && <Alert type="error">{error}</Alert>}

      {isLoading || !settings ? (
        <Spinner />
      ) : (
        <div className="card settings-list">
          <div className="settings-row">
            <div>
              <p className="settings-row-title">Map tab</p>
              <p className="muted settings-row-note">
                Show the branch map tab in the delegate app's bottom navigation.
              </p>
            </div>
            <Toggle
              checked={settings.mapTabEnabled}
              disabled={!isOwner || savingKey === "mapTabEnabled"}
              onChange={(value) => handleToggle("mapTabEnabled", value)}
            />
          </div>

          <div className="settings-row">
            <div>
              <p className="settings-row-title">Cimun Card Wrapped</p>
              <p className="muted settings-row-note">
                Let delegates view a Spotify Wrapped-style recap of their redemption history, from
                their Account page.
              </p>
            </div>
            <Toggle
              checked={settings.wrappedEnabled}
              disabled={!isOwner || savingKey === "wrappedEnabled"}
              onChange={(value) => handleToggle("wrappedEnabled", value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

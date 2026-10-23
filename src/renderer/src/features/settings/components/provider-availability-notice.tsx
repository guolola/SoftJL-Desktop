// Shows persistent provider setup guidance only after a blocked model or send action.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuthenticatedRouteSession } from "../../user-platform/components/authenticated-route-session.js";
import { loadUserSettings, USER_SETTINGS_CHANGED_EVENT, USER_SETTINGS_STORAGE_KEY } from "../../../shared/lib/user-settings.js";
import { PROVIDER_REQUIRED_NOTICE_EVENT } from "../../../shared/lib/provider-required-notice.js";
import ProviderRequiredAlert from "../../../shared/ui/provider-required-alert.js";

export function ProviderAvailabilityNotice({ onConfigure }: { onConfigure: () => void }) {
  const session = useAuthenticatedRouteSession();
  const userId = session?.user.id;
  const [missing, setMissing] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const settingsChanged = () => {
      const settings = loadUserSettings();
      // Saving a usable provider removes the notice immediately, including a manually reopened one.
      if (settings.providerConfigId && settings.providerModelOptions.length > 0) setMissing(false);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === USER_SETTINGS_STORAGE_KEY || event.key === null) settingsChanged();
    };
    const reopen = () => { setMissing(true); setRevision(value => value + 1); };
    window.addEventListener(PROVIDER_REQUIRED_NOTICE_EVENT, reopen);
    window.addEventListener(USER_SETTINGS_CHANGED_EVENT, settingsChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PROVIDER_REQUIRED_NOTICE_EVENT, reopen);
      window.removeEventListener(USER_SETTINGS_CHANGED_EVENT, settingsChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [userId]);

  if (!userId || !missing) return null;
  // Body-level placement avoids the workspace's clipped scrolling containers; there is no auto-dismiss timer.
  return createPortal(
    <div data-slot="provider-notice-viewport" className="pointer-events-none fixed right-4 bottom-4 z-[100] w-[calc(100%-2rem)] max-w-sm">
      <div className="pointer-events-auto">
        <ProviderRequiredAlert key={revision} onConfigure={onConfigure} />
      </div>
    </div>, document.body,
  );
}

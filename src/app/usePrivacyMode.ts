import { useCallback, useEffect, useState } from "react";
import type { AppSettings } from "../domain/models";
import { updateSettings } from "../db/repository";
import { readSessionPrivacy, subscribeSessionPrivacy, writeSessionPrivacy } from "../browser/privacySession";

export function usePrivacyMode(settings: Pick<AppSettings, "privacyPersist" | "privacyEnabled">) {
  const [sessionPrivacy, setSessionPrivacy] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void readSessionPrivacy().then((enabled) => { if (active) setSessionPrivacy(enabled); }).catch(() => { if (active) setSessionPrivacy(false); });
    const unsubscribe = subscribeSessionPrivacy((enabled) => { if (active) setSessionPrivacy(enabled); });
    return () => { active = false; unsubscribe(); };
  }, []);

  const privacy = settings.privacyPersist ? settings.privacyEnabled : sessionPrivacy ?? true;
  const setPrivacy = useCallback(async (enabled: boolean): Promise<void> => {
    if (settings.privacyPersist) await updateSettings({ privacyEnabled: enabled });
    else {
      await writeSessionPrivacy(enabled);
      setSessionPrivacy(enabled);
    }
  }, [settings.privacyPersist]);

  return { privacy, setPrivacy };
}

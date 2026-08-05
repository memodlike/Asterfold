import { lazy, Suspense, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Sparkles } from "lucide-react";
import { WorkspaceApp } from "../../app/WorkspaceApp";
import { Button } from "../../components/Button";
import { db } from "../../db/database";
import { ensureStarterWorkspace, getWorkspaceData } from "../../db/repository";
import { I18nProvider, translate } from "../../i18n";
import { shouldShowOnboarding } from "./onboardingState";

const OnboardingWizard = lazy(() => import("./OnboardingEntry"));

export function OnboardingGate() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setReady(false);
    setFailed(false);
    void ensureStarterWorkspace(db)
      .then(() => { if (active) setReady(true); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt]);

  const settings = useLiveQuery(async () => ready ? db.settings.get("app") : undefined, [ready, attempt], undefined);

  if (failed) {
    return <div className="app-loading">
      <span>{translate("auto", "error.actionFailed")}</span>
      <Button onClick={() => setAttempt((current) => current + 1)}>{translate("auto", "generic.retry")}</Button>
    </div>;
  }
  if (!settings) return <div className="app-loading"><Sparkles size={22} /><span>{translate("auto", "loading.opening")}</span></div>;
  if (!shouldShowOnboarding(settings)) return <WorkspaceApp />;
  return <PendingOnboarding />;
}

function PendingOnboarding() {
  const workspace = useLiveQuery(() => getWorkspaceData(db, false), [], undefined);
  if (!workspace) return <div className="app-loading"><Sparkles size={22} /><span>{translate("auto", "loading.opening")}</span></div>;
  return <I18nProvider preference={workspace.settings.locale} documentTitle="tab.title">
    <div className="onboarding-shell" aria-hidden="true">
      <div className="onboarding-shell__wallpaper" />
      <div className="onboarding-shell__preview">
        <span /><span /><span /><span /><span /><span />
      </div>
    </div>
    <Suspense fallback={<div className="app-loading"><Sparkles size={22} /><span>{translate(workspace.settings.locale, "loading.opening")}</span></div>}>
      <OnboardingWizard workspace={workspace} />
    </Suspense>
  </I18nProvider>;
}

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ensureStarterWorkspace, getWorkspaceData } from "../db/repository";
import { db } from "../db/database";

export function useWorkspace() {
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
  const workspace = useLiveQuery(async () => {
    if (!ready) return undefined;
    try {
      return await getWorkspaceData(db, false);
    } catch {
      setFailed(true);
      return undefined;
    }
  }, [ready, attempt], undefined);
  return {
    workspace,
    failed,
    retry: (): void => setAttempt((current) => current + 1),
  };
}

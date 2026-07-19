import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ensureStarterWorkspace, getWorkspaceData } from "../db/repository";
import { db } from "../db/database";

export function useWorkspace() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void ensureStarterWorkspace(db).then(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  return useLiveQuery(async () => ready ? getWorkspaceData(db, false) : undefined, [ready], undefined);
}

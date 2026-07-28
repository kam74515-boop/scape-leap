import { useCallback, useEffect, useState } from "react";
import { loadProject, saveProject } from "./mock-data";
import { DEMO_PROJECT_CHANGE_EVENT, DEMO_PROJECT } from "./mock-data";
import type { FormscapeProject, Profile, StageId } from "./types";

export function useFormscapeProject(projectId = DEMO_PROJECT.id) {
  const [project, setProject] = useState<FormscapeProject>(() => loadProject(projectId));

  useEffect(() => {
    const refresh = () => setProject(loadProject(projectId));
    refresh();
    window.addEventListener(DEMO_PROJECT_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(DEMO_PROJECT_CHANGE_EVENT, refresh);
  }, [projectId]);

  const persist = useCallback((next: FormscapeProject) => {
    setProject(next);
    saveProject(next);
  }, []);

  const updateProfile = useCallback(
    (patch: Partial<Profile>) => {
      persist({ ...project, profile: { ...project.profile, ...patch } });
    },
    [project, persist]
  );

  const setStage = useCallback(
    (stage: StageId) => {
      persist({ ...project, stage });
    },
    [project, persist]
  );

  const togglePurchase = useCallback(
    (id: string) => {
      const set = new Set(project.purchaseIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      persist({ ...project, purchaseIds: Array.from(set) });
    },
    [project, persist]
  );

  return { project, updateProfile, setStage, togglePurchase, persist };
}

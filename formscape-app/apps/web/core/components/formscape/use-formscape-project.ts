import { useCallback, useEffect, useState } from "react";
import { loadProject, saveProject } from "./mock-data";
import type { FormscapeProject, Profile, StageId } from "./types";

export function useFormscapeProject() {
  const [project, setProject] = useState<FormscapeProject>(loadProject);

  useEffect(() => {
    setProject(loadProject());
  }, []);

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

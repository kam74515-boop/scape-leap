import { lazy, Suspense } from "react";
import { observer } from "mobx-react";
import { useParams } from "react-router";
import { CanvasWorkspaceSkeleton } from "@/components/formscape/canvas/CanvasWorkspaceSkeleton";

/** 路由级懒加载：进入 /canvas 才拉 FormscapeCanvasPage 壳 + 后续 workspace chunk */
const FormscapeCanvasPage = lazy(function loadFormscapeCanvasPage() {
  return import("@/components/formscape/CanvasPage").then((m) => ({ default: m.FormscapeCanvasPage }));
});

function CanvasRoutePage() {
  const { workspaceSlug } = useParams();
  if (!workspaceSlug) return null;
  return (
    <Suspense fallback={<CanvasWorkspaceSkeleton />}>
      <FormscapeCanvasPage workspaceSlug={workspaceSlug} />
    </Suspense>
  );
}

export default observer(CanvasRoutePage);

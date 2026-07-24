import { observer } from "mobx-react";
import { PageHead } from "@/components/core/page-title";
import { FormscapeDraftsPage } from "@/components/formscape/DraftsPage";
import type { Route } from "./+types/page";

function WorkspaceDraftPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  return (
    <>
      <PageHead title="草稿 · 构境AI" />
      <FormscapeDraftsPage workspaceSlug={workspaceSlug} />
    </>
  );
}

export default observer(WorkspaceDraftPage);

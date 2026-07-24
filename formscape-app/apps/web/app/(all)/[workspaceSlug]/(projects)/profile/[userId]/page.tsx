/**
 * 我的工作 = 分配给我的工作内容（覆盖原 profile overview）
 */
import { observer } from "mobx-react";
import { PageHead } from "@/components/core/page-title";
import { FormscapeMyWorkPage } from "@/components/formscape/MyWorkPage";
import type { Route } from "./+types/page";

function ProfileOverviewPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  return (
    <>
      <PageHead title="我的工作 · 构境AI" />
      <FormscapeMyWorkPage workspaceSlug={workspaceSlug} />
    </>
  );
}

export default observer(ProfileOverviewPage);

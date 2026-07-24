/**
 * 我的工作布局 — 去掉 Plane profile 侧栏/子导航，只保留内容区
 */
import { observer } from "mobx-react";
import { Outlet } from "react-router";
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { UserProfileHeader } from "./header";

function UseProfileLayout() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <AppHeader header={<UserProfileHeader />} />
      <ContentWrapper>
        <div className="h-full w-full overflow-hidden">
          <Outlet />
        </div>
      </ContentWrapper>
    </div>
  );
}

export default observer(UseProfileLayout);

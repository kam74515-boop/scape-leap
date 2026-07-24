/**
 * 首页顶栏：项目管理仪表盘
 */
import { observer } from "mobx-react";
import { Home } from "@/icons";
import { Breadcrumbs, Header } from "@plane/ui";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";

export const WorkspaceDashboardHeader = observer(function WorkspaceDashboardHeader() {
  return (
    <Header>
      <Header.LeftItem>
        <div className="flex items-center gap-2">
          <Breadcrumbs>
            <Breadcrumbs.Item
              component={<BreadcrumbLink label="首页" icon={<Home className="h-4 w-4 text-tertiary" />} />}
            />
          </Breadcrumbs>
        </div>
      </Header.LeftItem>
    </Header>
  );
});

/**
 * 草稿顶栏
 */
import { observer } from "mobx-react";
import { FileEdit } from "@/icons";
import { Breadcrumbs, Header } from "@plane/ui";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";

export const WorkspaceDraftHeader = observer(function WorkspaceDraftHeader() {
  return (
    <Header>
      <Header.LeftItem>
        <div className="flex items-center gap-2">
          <Breadcrumbs>
            <Breadcrumbs.Item
              component={<BreadcrumbLink label="草稿" icon={<FileEdit className="h-4 w-4 text-tertiary" />} />}
            />
          </Breadcrumbs>
        </div>
      </Header.LeftItem>
    </Header>
  );
});

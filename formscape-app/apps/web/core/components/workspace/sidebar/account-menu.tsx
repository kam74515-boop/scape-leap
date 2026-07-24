/**
 * 类 ChatGPT：组织 + 个人一体入口
 * - rail：L1 底部仅头像
 * - sidebar：宽条（备用）
 */
import { Fragment, useEffect, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { Menu, Transition } from "@headlessui/react";
import { Check, ChevronUp, CirclePlus, LogOut, Mails, Settings, Settings2 } from "@/icons";
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import type { IWorkspace } from "@plane/types";
import { Avatar } from "@plane/ui";
import { cn, getFileURL, orderWorkspacesList } from "@plane/utils";
import { AppSidebarItem } from "@/components/sidebar/sidebar-item";
import { WorkspaceLogo } from "@/components/workspace/logo";
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useInstance } from "@/hooks/store/use-instance";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUser, useUserProfile } from "@/hooks/store/user";

type AccountMenuRootProps = {
  /** rail = L1 窄栏头像；sidebar = 宽触发条 */
  variant?: "rail" | "sidebar";
};

export const AccountMenuRoot = observer(function AccountMenuRoot({ variant = "rail" }: AccountMenuRootProps) {
  const { toggleSidebar, toggleAnySidebarDropdown } = useAppTheme();
  const { config } = useInstance();
  const { data: currentUser, signOut } = useUser();
  const { updateUserProfile } = useUserProfile();
  const { currentWorkspace: activeWorkspace, workspaces } = useWorkspace();
  const { toggleProfileSettingsModal } = useCommandPalette();
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const isWorkspaceCreationDisabled = config?.is_workspace_creation_disabled ?? false;
  const workspacesList = orderWorkspacesList(Object.values(workspaces ?? {}));
  const isRail = variant === "rail";

  useEffect(() => {
    toggleAnySidebarDropdown(open);
  }, [open, toggleAnySidebarDropdown]);

  const displayName =
    [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(" ") ||
    currentUser?.display_name ||
    "用户";

  const handleWorkspaceNavigation = (workspace: IWorkspace) => {
    updateUserProfile({ last_workspace_id: workspace?.id });
    if (window.innerWidth < 768) toggleSidebar();
  };

  const handleSignOut = () => {
    signOut().catch(() =>
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("auth.sign_out.toast.error.title"),
        message: t("auth.sign_out.toast.error.message"),
      })
    );
  };

  const panel = (
    <Transition
      as={Fragment}
      enter="transition ease-out duration-100"
      enterFrom="transform opacity-0 translate-y-1"
      enterTo="transform opacity-100 translate-y-0"
      leave="transition ease-in duration-75"
      leaveFrom="transform opacity-100 translate-y-0"
      leaveTo="transform opacity-0 translate-y-1"
    >
      <Menu.Items
        className={cn(
          "z-30 w-64 overflow-hidden rounded-lg border border-subtle bg-surface-1 shadow-raised-200 outline-none",
          isRail
            ? "absolute bottom-0 left-full ml-2 origin-bottom-left"
            : "absolute bottom-full left-0 mb-1.5 w-full min-w-[16rem] origin-bottom"
        )}
      >
        {/* 个人信息头 */}
        <div className="border-b border-subtle px-3 py-3">
          <div className="flex items-center gap-2.5">
            <Avatar
              name={currentUser?.display_name}
              src={getFileURL(currentUser?.avatar_url ?? "")}
              size={36}
              shape="circle"
            />
            <div className="min-w-0">
              <div className="truncate text-13 font-semibold text-primary">{displayName}</div>
              <div className="truncate text-11 text-tertiary">{currentUser?.email}</div>
            </div>
          </div>
        </div>

        {/* 工作区 / 组织 */}
        <div className="max-h-52 overflow-y-auto py-1.5">
          <div className="px-3 py-1 text-11 font-medium text-placeholder">工作室 / 组织</div>
          {(activeWorkspace
            ? [activeWorkspace, ...workspacesList.filter((w) => w.id !== activeWorkspace.id)]
            : workspacesList
          ).map((workspace) => {
            const isActive = workspace.id === activeWorkspace?.id;
            return (
              <Menu.Item key={workspace.id}>
                {({ active }) => (
                  <Link
                    href={`/${workspace.slug}`}
                    onClick={() => handleWorkspaceNavigation(workspace)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-13",
                      active || isActive ? "bg-layer-transparent-hover" : "",
                      isActive ? "text-primary" : "text-secondary"
                    )}
                  >
                    <WorkspaceLogo
                      logo={workspace.logo_url}
                      name={workspace.name}
                      classNames="size-7 shrink-0 rounded-md border border-subtle"
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{workspace.name}</span>
                    {isActive && <Check className="size-3.5 shrink-0 text-accent-primary" />}
                  </Link>
                )}
              </Menu.Item>
            );
          })}
          {!isWorkspaceCreationDisabled && (
            <Menu.Item>
              {({ active }) => (
                <Link
                  href="/create-workspace"
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-13 text-secondary",
                    active && "bg-layer-transparent-hover"
                  )}
                >
                  <CirclePlus className="size-4 shrink-0" />
                  新建工作室
                </Link>
              )}
            </Menu.Item>
          )}
          <Menu.Item>
            {({ active }) => (
              <Link
                href="/invitations"
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-13 text-secondary",
                  active && "bg-layer-transparent-hover"
                )}
              >
                <Mails className="size-4 shrink-0" />
                工作室邀请
              </Link>
            )}
          </Menu.Item>
        </div>

        {/* 个人设置 */}
        <div className="border-t border-subtle py-1.5">
          <Menu.Item>
            {({ active }) => (
              <button
                type="button"
                onClick={() => toggleProfileSettingsModal({ activeTab: "general", isOpen: true })}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-13 text-secondary",
                  active && "bg-layer-transparent-hover"
                )}
              >
                <Settings className="size-4 shrink-0" />
                账户设置
              </button>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <button
                type="button"
                onClick={() => toggleProfileSettingsModal({ activeTab: "preferences", isOpen: true })}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-13 text-secondary",
                  active && "bg-layer-transparent-hover"
                )}
              >
                <Settings2 className="size-4 shrink-0" />
                偏好设置
              </button>
            )}
          </Menu.Item>
          {activeWorkspace && (
            <Menu.Item>
              {({ active }) => (
                <Link
                  href={`/${activeWorkspace.slug}/settings`}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-13 text-secondary",
                    active && "bg-layer-transparent-hover"
                  )}
                >
                  <Settings className="size-4 shrink-0" />
                  工作室设置
                </Link>
              )}
            </Menu.Item>
          )}
        </div>

        <div className="border-t border-subtle py-1.5">
          <Menu.Item>
            {({ active }) => (
              <button
                type="button"
                onClick={handleSignOut}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-13 text-danger-primary",
                  active && "bg-layer-transparent-hover"
                )}
              >
                <LogOut className="size-4 shrink-0" />
                退出登录
              </button>
            )}
          </Menu.Item>
        </div>
      </Menu.Items>
    </Transition>
  );

  return (
    <Menu as="div" className={cn("relative", isRail ? "flex justify-center" : "w-full")}>
      {({ open: menuOpen }) => {
        if (open !== menuOpen) setOpen(menuOpen);

        if (isRail) {
          // 与 HelpMenuRoot 同一套 AppSidebarItem size-8 格子，垂直齐平
          return (
            <>
              <Tooltip tooltipContent={`${displayName} · ${activeWorkspace?.name ?? "工作室"}`} position="right">
                <Menu.Button className="outline-none" aria-label="账号与工作室">
                  <AppSidebarItem
                    variant="button"
                    item={{
                      icon: (
                        <Avatar
                          name={currentUser?.display_name}
                          src={getFileURL(currentUser?.avatar_url ?? "")}
                          size={20}
                          shape="circle"
                        />
                      ),
                      isActive: menuOpen,
                      showLabel: false,
                    }}
                  />
                </Menu.Button>
              </Tooltip>
              {panel}
            </>
          );
        }

        return (
          <>
            <Menu.Button
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
                "hover:bg-layer-transparent-hover",
                menuOpen && "bg-layer-transparent-selected"
              )}
            >
              <Avatar
                name={currentUser?.display_name}
                src={getFileURL(currentUser?.avatar_url ?? "")}
                size={32}
                shape="circle"
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-13 font-medium text-primary">{displayName}</div>
                <div className="flex min-w-0 items-center gap-1.5">
                  {activeWorkspace && (
                    <WorkspaceLogo
                      logo={activeWorkspace.logo_url}
                      name={activeWorkspace.name}
                      classNames="size-3.5 shrink-0 rounded-sm"
                    />
                  )}
                  <span className="truncate text-11 text-tertiary">
                    {activeWorkspace?.name ?? "构境工作室"}
                  </span>
                </div>
              </div>
              <ChevronUp
                className={cn("size-4 shrink-0 text-placeholder transition-transform", !menuOpen && "rotate-180")}
              />
            </Menu.Button>
            {panel}
          </>
        );
      }}
    </Menu>
  );
});

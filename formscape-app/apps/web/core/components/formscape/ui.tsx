/**
 * 构境页 UI 基元 — 对齐 Plane token（surface / subtle / text-11·13 / rounded-md）
 * 图标统一 lucide-react
 */
import type { ReactNode } from "react";
import { Link } from "react-router";
import { observer } from "mobx-react";
import { cn } from "@plane/utils";
import { useParams } from "react-router";
import { AppSidebarToggleButton } from "@/components/sidebar/sidebar-toggle-button";
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useProjectNavigationPreferences } from "@/hooks/use-navigation-preferences";
import { FormscapeAiHeaderButton } from "./AiDrawer";

/** 主区页面外壳：固定高度、禁止整页滚；滚动只在 FsPageBody / 子面板内 */
export function FsPageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden bg-surface-1", className)}>{children}</div>
  );
}

/** 页内顶栏：左折叠 · 右 AI（展开 Agent 时按钮也在顶栏） */
export const FsPageHeader = observer(function FsPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const { projectId } = useParams();
  const { sidebarCollapsed } = useAppTheme();
  const { preferences: projectPreferences } = useProjectNavigationPreferences();
  // TABBED 项目顶栏已有 AI / 折叠钮，避免重复
  const aiInTabChrome = !!projectId && projectPreferences.navigationMode === "TABBED";
  // 仅收起态在主区显示展开钮（严格 true，避免 undefined 误判）
  const showSidebarToggle = sidebarCollapsed === true && !aiInTabChrome;

  return (
    <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-subtle bg-surface-1 px-3">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {showSidebarToggle && (
          <div className="flex shrink-0 items-center">
            <AppSidebarToggleButton />
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-13 font-semibold text-primary">{title}</div>
          {description && <div className="truncate text-11 text-tertiary">{description}</div>}
        </div>
      </div>
      <div className="relative z-20 flex shrink-0 items-center gap-1.5">
        {actions}
        {!aiInTabChrome && <FormscapeAiHeaderButton />}
      </div>
    </div>
  );
});

/**
 * 壳内可滚动内容区（非整页 document 滚动）
 */
export function FsPageBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-surface-1 px-3 py-3 md:px-4 md:py-4",
        className
      )}
    >
      {children}
    </div>
  );
}

/** 卡片：白底 + 细边框 */
export function FsCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-subtle bg-surface-1 p-4 shadow-sm", className)}>{children}</div>
  );
}

export function FsCardTitle({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-13 font-semibold text-primary">{children}</div>;
}

export function FsMuted({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-11 text-tertiary", className)}>{children}</p>;
}

export function FsSectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-11 font-semibold text-placeholder">{children}</div>;
}

export function FsField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-11 font-medium text-secondary">{label}</span>
      {children}
    </label>
  );
}

/** 与 Plane 表单输入一致 */
export const fsInputClass =
  "w-full rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-13 text-primary placeholder:text-placeholder outline-none transition-colors focus:border-accent-primary";

export function FsTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-sm bg-surface-2 px-1.5 py-0.5 text-11 font-medium text-secondary">
      {children}
    </span>
  );
}

export function FsPrimaryLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center justify-center rounded-md bg-accent-primary px-3 py-1.5 text-11 font-medium text-on-color transition-opacity hover:opacity-90",
        className
      )}
    >
      {children}
    </Link>
  );
}

export function FsSecondaryLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center justify-center rounded-md border border-subtle bg-surface-1 px-3 py-1.5 text-11 font-medium text-secondary transition-colors hover:bg-surface-2",
        className
      )}
    >
      {children}
    </Link>
  );
}

export function FsTextLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn("text-11 font-medium text-accent-primary hover:underline", className)}>
      {children}
    </Link>
  );
}

export function FsEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-subtle bg-surface-1 px-6 py-12 text-center">
      <div className="text-13 font-semibold text-primary">{title}</div>
      <p className="mt-1.5 max-w-sm text-11 text-tertiary">{body}</p>
    </div>
  );
}

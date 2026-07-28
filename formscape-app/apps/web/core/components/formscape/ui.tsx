/**
 * 构境页 UI 基元 — 设计规范 v3（年轻化扁平化）
 * 主按钮 pill · 卡片 12px 圆角无阴影 · 徽标软色块 · AI 能力一律紫（ai token）
 * 图标统一 lucide-react；禁用原生 alert/confirm/prompt，用 FsModal / FsConfirm / toast
 */
import { useEffect, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from "react";
import { Link } from "react-router";
import { observer } from "mobx-react";
import { Sparkles } from "lucide-react";
import { cn } from "@plane/utils";
import { useParams } from "react-router";
import { AppSidebarToggleButton } from "@/components/sidebar/sidebar-toggle-button";
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useProjectNavigationPreferences } from "@/hooks/use-navigation-preferences";
import { FormscapeAiHeaderButton } from "./AiDrawer";
import "./formscape-ui.css";

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
          <div className="truncate text-14 font-semibold text-primary">{title}</div>
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

/** 壳内可滚动内容区（非整页 document 滚动） */
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

/** 页内主标题（20px semibold，规范 v3 §3）——用于内容区顶部，不是顶栏 */
export function FsPageTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cn("text-20 font-semibold text-primary", className)}>{children}</h1>;
}

/** 卡片：细边框 + 无阴影（扁平）；interactive 时 hover 上浮 */
export function FsCard({
  children,
  className,
  interactive,
  onClick,
  id,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
  id?: string;
}) {
  return (
    <div
      id={id}
      onClick={onClick}
      className={cn(
        "rounded-lg border border-subtle bg-surface-1 p-4",
        (interactive || onClick) &&
          "cursor-pointer transition-[transform,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-strong",
        className
      )}
    >
      {children}
    </div>
  );
}

/** 区块标题（15px semibold，规范 v3 §3） */
export function FsCardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-2 text-15 font-semibold text-primary", className)}>{children}</div>;
}

export function FsMuted({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-12 text-tertiary", className)}>{children}</p>;
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

/** 与 Plane 表单输入一致（圆角上移一档） */
export const fsInputClass =
  "w-full rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-13 text-primary placeholder:text-placeholder outline-none transition-colors focus:border-accent-strong";

/* ============================== 按钮 ============================== */

type FsButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "ai";
type FsButtonSize = "sm" | "md";

const fsButtonBase =
  "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-all duration-150 ease-out disabled:pointer-events-none disabled:opacity-50";

const fsButtonVariants: Record<FsButtonVariant, string> = {
  // 主按钮：pill、brand 底白字、hover 提亮 + 轻微上浮
  primary: "rounded-full bg-accent-primary text-on-color hover:brightness-105 hover:-translate-y-px active:translate-y-0",
  // 次按钮：pill、1px 边框
  secondary:
    "rounded-full border border-subtle bg-surface-1 text-secondary hover:bg-layer-transparent-hover hover:text-primary",
  ghost: "rounded-full text-secondary hover:bg-layer-transparent-hover hover:text-primary",
  danger: "rounded-full bg-danger-primary text-on-color hover:brightness-105 hover:-translate-y-px",
  // AI 按钮：紫底（仅 AI 能力可用）
  ai: "rounded-full bg-ai-primary text-on-color hover:brightness-105 hover:-translate-y-px active:translate-y-0",
};

const fsButtonSizes: Record<FsButtonSize, string> = {
  sm: "h-7 px-3 text-11",
  md: "h-8 px-3.5 text-13",
};

export interface FsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: FsButtonVariant;
  size?: FsButtonSize;
  /** AI 按钮默认带星形图标；显式传 false 可关 */
  sparkle?: boolean;
}

export function FsButton({
  variant = "primary",
  size = "md",
  sparkle,
  className,
  children,
  type = "button",
  ...rest
}: FsButtonProps) {
  const showSparkle = sparkle ?? variant === "ai";
  return (
    <button
      type={type}
      className={cn(fsButtonBase, fsButtonVariants[variant], fsButtonSizes[size], className)}
      {...rest}
    >
      {showSparkle && <Sparkles className="size-3.5" strokeWidth={1.75} />}
      {children}
    </button>
  );
}

export function FsPrimaryLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        fsButtonBase,
        fsButtonVariants.primary,
        "h-8 px-3.5 text-12",
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
      className={cn(fsButtonBase, fsButtonVariants.secondary, "h-8 px-3.5 text-12", className)}
    >
      {children}
    </Link>
  );
}

export function FsTextLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn("text-12 font-medium text-accent-primary hover:underline", className)}>
      {children}
    </Link>
  );
}

/* ============================== 徽标 ============================== */

export type FsTagTone = "neutral" | "brand" | "success" | "warning" | "danger" | "ai";

const fsTagTones: Record<FsTagTone, string> = {
  neutral: "bg-surface-2 text-secondary",
  brand: "bg-accent-subtle text-accent-secondary",
  success: "bg-success-subtle text-success-primary",
  warning: "bg-warning-subtle text-warning-primary",
  danger: "bg-danger-subtle text-danger-primary",
  ai: "bg-ai-subtle text-ai-secondary",
};

/** 徽标：软色块（浅底深字）、rounded-full、11px medium */
export function FsTag({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: FsTagTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-11 font-medium",
        fsTagTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ============================== KPI / 步骤条 / 进度 ============================== */

/** KPI 统计块：28px semibold tabular 数字 + 标签 + 可选趋势徽标 */
export function FsStat({
  label,
  value,
  trend,
  trendTone = "success",
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  trend?: ReactNode;
  trendTone?: FsTagTone;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <div className="text-12 text-tertiary">{label}</div>
      <div className="flex items-baseline gap-2">
        <div className="text-28 font-semibold leading-none text-primary tabular-nums">{value}</div>
        {trend && <FsTag tone={trendTone}>{trend}</FsTag>}
      </div>
      {hint && <div className="text-11 text-tertiary">{hint}</div>}
    </div>
  );
}

/** 圆角胶囊步骤条：done=brand 实底 · current=brand 描边 · todo=灰（规范 v3 §8） */
export function FsSteps({
  steps,
  current,
  onStepClick,
  className,
}: {
  steps: { key: string; label: string }[];
  current: number;
  onStepClick?: (index: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <div key={step.key} className="flex items-center gap-1.5">
            {i > 0 && (
              <div className={cn("h-px w-3", i <= current ? "bg-accent-primary" : "bg-[var(--border-strong)]")} />
            )}
            <button
              type="button"
              disabled={!onStepClick}
              onClick={() => onStepClick?.(i)}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-11 font-medium transition-colors",
                state === "done" && "bg-accent-primary text-on-color",
                state === "current" && "border border-accent-strong bg-accent-subtle text-accent-secondary",
                state === "todo" && "bg-surface-2 text-tertiary",
                onStepClick && "cursor-pointer"
              )}
            >
              <span className="tabular-nums">{i + 1}</span>
              {step.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 细进度条。value 0–100；不传 value 为不确定进度（AI 生成态紫色流动条）。
 * ai=false 时用 brand 色（非 AI 的长任务）。
 */
export function FsProgress({
  value,
  ai = true,
  className,
}: {
  value?: number;
  ai?: boolean;
  className?: string;
}) {
  const indeterminate = value === undefined;
  return (
    <div
      className={cn(
        "h-1 w-full rounded-full bg-surface-2",
        indeterminate && "fs-progress-indeterminate",
        className
      )}
    >
      {indeterminate ? (
        <i style={ai ? undefined : { background: "var(--brand-default)" }} />
      ) : (
        <div
          className={cn("h-full rounded-full transition-[width] duration-200 ease-out", ai ? "bg-ai-primary" : "bg-accent-primary")}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      )}
    </div>
  );
}

/** 滑杆：轨道 4px 圆角、拇指 14px 圆点、accent=brand（样式在 formscape-ui.css） */
export function FsSlider({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="range" className={cn("fs-range", className)} {...rest} />;
}

/* ============================== 空态 ============================== */

/** 默认空态线条插画（currentColor 描边，随主题） */
function FsEmptyIllustration() {
  return (
    <svg width="88" height="64" viewBox="0 0 88 64" fill="none" className="text-placeholder" aria-hidden>
      <rect x="6" y="10" width="52" height="40" rx="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 42l14-12 12 10 8-6 18 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="24" r="4" stroke="currentColor" strokeWidth="1.5" />
      <rect x="62" y="22" width="20" height="28" rx="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M67 30h10M67 36h10M67 42h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M74 10l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2 1.2-3z" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

/** 空态：线条插画 + 一句结果导向文案 + 主 CTA（规范 v3 §4） */
export function FsEmpty({
  title,
  body,
  action,
  illustration,
  className,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  illustration?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-subtle bg-surface-1 px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-3">{illustration ?? <FsEmptyIllustration />}</div>
      <div className="text-14 font-semibold text-primary">{title}</div>
      <p className="mt-1.5 max-w-sm text-12 text-tertiary">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ============================== 模态 / 确认 ============================== */

/** 轻量模态：rounded-xl 面板 + overlay 阴影 + 160ms 弹入；Esc / 点遮罩关闭 */
export function FsModal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "sm",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg";
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="fs-ui-fade absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal
        className={cn(
          "fs-ui-pop relative flex max-h-[85vh] w-full flex-col rounded-xl border border-subtle bg-surface-1 shadow-overlay-200",
          width === "sm" && "max-w-sm",
          width === "md" && "max-w-lg",
          width === "lg" && "max-w-2xl",
          className
        )}
      >
        {title && <div className="shrink-0 px-5 pt-4 text-15 font-semibold text-primary">{title}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-13 text-secondary">{children}</div>
        {footer && <div className="flex shrink-0 items-center justify-end gap-2 px-5 pb-4">{footer}</div>}
      </div>
    </div>
  );
}

/** 确认框：替代原生 confirm（规范 v3 禁用原生弹窗） */
export function FsConfirm({
  open,
  onCancel,
  onConfirm,
  title,
  body,
  confirmLabel = "确定",
  cancelLabel = "取消",
  danger,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}) {
  return (
    <FsModal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <FsButton variant="secondary" size="sm" onClick={onCancel}>
            {cancelLabel}
          </FsButton>
          <FsButton variant={danger ? "danger" : "primary"} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </FsButton>
        </>
      }
    >
      {body ?? null}
    </FsModal>
  );
}

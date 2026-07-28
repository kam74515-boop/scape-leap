/**
 * L2 树形控件
 * 父行：chevron + 图标 + 文案
 * 子行：仅 图标 + 文案，缩进对齐父级文案起点（不额外空出 chevron 槽）
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Folder, FolderOpen } from "@/icons";
import { cn } from "@plane/utils";

/** 统一行高；水平 padding 一致 */
const ROW = "relative flex h-8 w-full items-center gap-1.5 rounded-md px-1 text-13 transition-colors";

/** 选中态：brand 软色块（浅底深字）+ 左侧 3px 圆角指示条（规范 v3 §8） */
const ROW_ACTIVE = "bg-accent-subtle text-accent-secondary";

function ActiveBar({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span aria-hidden className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-full bg-accent-primary" />
  );
}

export function TreeSectionLabel({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-7 items-center justify-between gap-2 px-1 pt-1">
      <span className="text-11 font-semibold tracking-wide text-placeholder">{children}</span>
      {action}
    </div>
  );
}

export function TreeRoot({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-0.5">{children}</div>;
}

type TreeFolderProps = {
  id: string;
  label: string;
  meta?: string;
  defaultOpen?: boolean;
  /** 受控展开（手风琴：父级统一管理） */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  href?: string;
  active?: boolean;
  children?: ReactNode;
  forceLeafStyle?: boolean;
};

export function TreeFolder({
  id,
  label,
  meta,
  defaultOpen = true,
  open: openControlled,
  onOpenChange,
  href,
  active,
  children,
  forceLeafStyle,
}: TreeFolderProps) {
  const storageKey = `fs-tree-open:${id}`;
  const hasChildren = !forceLeafStyle && children != null && children !== false;
  const isControlled = openControlled !== undefined;
  const [openInternal, setOpenInternal] = useState(defaultOpen);
  const open = isControlled ? !!openControlled : openInternal;

  useEffect(() => {
    if (isControlled) return;
    try {
      const v = localStorage.getItem(storageKey);
      if (v === "0") setOpenInternal(false);
      if (v === "1") setOpenInternal(true);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, isControlled]);

  const setOpen = (next: boolean) => {
    if (isControlled) {
      onOpenChange?.(next);
      return;
    }
    setOpenInternal(next);
    try {
      localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const toggle = () => {
    if (!hasChildren) return;
    setOpen(!open);
  };

  const titleClass = cn(
    "min-w-0 flex-1 truncate text-left font-medium",
    active ? "text-accent-secondary" : "text-secondary"
  );

  // 有子节点：单击整行只做展开/收起（再点即收起），不导航
  // 无子节点且有 href：才走链接
  return (
    <div className="flex flex-col gap-0.5">
      {hasChildren ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={toggle}
          className={cn(
            ROW,
            "w-full cursor-pointer select-none text-left",
            "hover:bg-layer-transparent-hover",
            active && ROW_ACTIVE
          )}
        >
          <ActiveBar show={active} />
          <span className={cn("flex size-4 shrink-0 items-center justify-center", active ? "text-accent-primary" : "text-tertiary")}>
            {open ? <FolderOpen className="size-3.5" strokeWidth={1.75} /> : <Folder className="size-3.5" strokeWidth={1.75} />}
          </span>
          <span className={titleClass}>{label}</span>
          {meta && <span className="ml-auto shrink-0 pl-1 text-11 text-placeholder">{meta}</span>}
        </button>
      ) : href ? (
        <Link
          to={href}
          className={cn(ROW, "hover:bg-layer-transparent-hover", active && ROW_ACTIVE)}
        >
          <ActiveBar show={active} />
          <span className={cn("flex size-4 shrink-0 items-center justify-center", active ? "text-accent-primary" : "text-tertiary")}>
            <Folder className="size-3.5" strokeWidth={1.75} />
          </span>
          <span className={titleClass}>{label}</span>
          {meta && <span className="ml-auto shrink-0 pl-1 text-11 text-placeholder">{meta}</span>}
        </Link>
      ) : (
        <div className={cn(ROW, active && ROW_ACTIVE)}>
          <ActiveBar show={active} />
          <span className={cn("flex size-4 shrink-0 items-center justify-center", active ? "text-accent-primary" : "text-tertiary")}>
            <Folder className="size-3.5" strokeWidth={1.75} />
          </span>
          <span className={titleClass}>{label}</span>
          {meta && <span className="ml-auto shrink-0 pl-1 text-11 text-placeholder">{meta}</span>}
        </div>
      )}
      {hasChildren && open && (
        <div className="ml-2 flex flex-col gap-0.5 border-l border-subtle pl-2">{children}</div>
      )}
    </div>
  );
}

type TreeLeafProps = {
  to?: string;
  onClick?: () => void;
  label: string;
  meta?: string;
  active?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  muted?: boolean;
};

export function TreeLeaf({ to, onClick, label, meta, active, icon: Icon, muted }: TreeLeafProps) {
  const className = cn(
    ROW,
    active
      ? cn(ROW_ACTIVE, "font-medium")
      : muted
        ? "text-placeholder hover:bg-layer-transparent-hover hover:text-secondary"
        : "text-secondary hover:bg-layer-transparent-hover"
  );

  // 子项：仅 icon + 文案（不再空出 chevron 列，避免文本严重右偏）
  const inner = (
    <>
      <ActiveBar show={active} />
      <span className={cn("flex size-4 shrink-0 items-center justify-center", active ? "text-accent-primary" : "text-placeholder")}>
        {Icon ? <Icon className="size-3.5" /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta && (
        <span className={cn("ml-auto shrink-0 text-11", active ? "text-accent-primary" : "text-placeholder")}>
          {meta}
        </span>
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cn(className, "w-full text-left")}>
      {inner}
    </button>
  );
}

export function TreeAddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        ROW,
        "w-full border border-dashed border-subtle text-placeholder hover:border-accent-primary/40 hover:bg-accent-subtle/30 hover:text-accent-primary"
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center text-13 font-medium">+</span>
      <span className="truncate font-medium">{label}</span>
    </button>
  );
}

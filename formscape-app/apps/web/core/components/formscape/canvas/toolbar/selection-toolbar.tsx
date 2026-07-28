/**
 * 选中节点功能栏 — 对齐 Lovspark Toolbar/Index.vue + config.ts（图片选中）
 *
 * 图片单选主区：图生视频 | 局部重绘 · 抠图 · 高清放大 · 问 AI · 重新生成 · 下载 · 更多 · 锁定
 * 更多：图片扩展 · AI重绘 · 智能消除 · 裁剪 · 调节 · 删除
 * 锁定态：仅解锁
 * 多选：水平排列 · 问 AI · 下载 · 锁定 · 删除
 * 非图片：复制 · 锁定 · 置顶 · 置底 · 删除
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Crop,
  Download,
  Eraser,
  Expand,
  Film,
  ImagePlus,
  Lock,
  LockOpen,
  MoreHorizontal,
  Paintbrush,
  Scissors,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { cn } from "@plane/utils";

export type AlignMode =
  | "left"
  | "center-x"
  | "right"
  | "top"
  | "center-y"
  | "bottom";

export type SelectionToolbarAction =
  | "video"
  | "partialRedraw"
  | "removeBg"
  | "upscale"
  | "askAi"
  | "regenerate"
  | "download"
  | "expand"
  | "aiRedraw"
  | "erase"
  | "crop"
  | "adjust"
  | "delete"
  | "tidyH";

type Props = {
  count: number;
  locked: boolean;
  /** 选中项是否为图片/生成器 */
  showImageActions?: boolean;
  /** 对齐 Lovspark canvasSettings.showToolNames */
  showToolNames?: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
  onBringFront?: () => void;
  onSendBack?: () => void;
  /** 图片工具动作（与 Lovspark 菜单 id 对齐） */
  onImageAction?: (action: SelectionToolbarAction) => void;
};

type Item = {
  id: string;
  label: string;
  title?: string;
  icon: ReactNode;
  danger?: boolean;
  /** AI 能力按钮：ai 紫 */
  ai?: boolean;
  action: () => void;
};

/** 选中节点浮出工具条 — Lovspark toolbar-merged 形态 */
export function SelectionToolbar({
  count,
  locked,
  showImageActions,
  showToolNames = true,
  onDuplicate,
  onDelete,
  onToggleLock,
  onBringFront,
  onSendBack,
  onImageAction,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreOpen]);

  useEffect(() => {
    setMoreOpen(false);
  }, [count, locked, showImageActions]);

  if (count === 0) return null;

  const run = (a: SelectionToolbarAction) => {
    setMoreOpen(false);
    onImageAction?.(a);
  };

  // —— 锁定态：仅解锁 ——
  if (locked) {
    return (
      <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
        <div className="fs-sel-toolbar pointer-events-auto">
          <ToolBtn
            title="解锁"
            label={showToolNames ? "解锁" : undefined}
            onClick={onToggleLock}
          >
            <LockOpen className="size-4" />
          </ToolBtn>
        </div>
      </div>
    );
  }

  // —— 非图片节点 ——
  if (!showImageActions) {
    return (
      <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
        <div className="fs-sel-toolbar pointer-events-auto">
          <ToolBtn title="复制 ⌘D" label={showToolNames ? "复制" : undefined} onClick={onDuplicate}>
            <Copy className="size-4" />
          </ToolBtn>
          <ToolBtn title="锁定" label={showToolNames ? "锁定" : undefined} onClick={onToggleLock}>
            <Lock className="size-4" />
          </ToolBtn>
          {onBringFront && (
            <ToolBtn title="置于顶层 ]" label={showToolNames ? "顶层" : undefined} onClick={onBringFront}>
              <ArrowUpToLine className="size-4" />
            </ToolBtn>
          )}
          {onSendBack && (
            <ToolBtn title="置于底层 [" label={showToolNames ? "底层" : undefined} onClick={onSendBack}>
              <ArrowDownToLine className="size-4" />
            </ToolBtn>
          )}
          <Divider />
          <ToolBtn title="删除" label={showToolNames ? "删除" : undefined} onClick={onDelete} danger>
            <Trash2 className="size-4" />
          </ToolBtn>
        </div>
      </div>
    );
  }

  // —— 图片多选 ——
  if (count >= 2) {
    return (
      <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
        <div className="fs-sel-toolbar pointer-events-auto">
          <ToolBtn
            title="水平排列"
            label={showToolNames ? "水平排列" : undefined}
            onClick={() => run("tidyH")}
          >
            <Expand className="size-4" />
          </ToolBtn>
          <ToolBtn title="问 AI" label={showToolNames ? "问 AI" : undefined} ai onClick={() => run("askAi")}>
            <Sparkles className="size-4" strokeWidth={1.75} />
          </ToolBtn>
          <ToolBtn title="下载" label={showToolNames ? "下载" : undefined} onClick={() => run("download")}>
            <Download className="size-4" />
          </ToolBtn>
          <ToolBtn title="锁定" label={showToolNames ? "锁定" : undefined} onClick={onToggleLock}>
            <Lock className="size-4" />
          </ToolBtn>
          <Divider />
          <ToolBtn title="删除" label={showToolNames ? "删除" : undefined} onClick={onDelete} danger>
            <Trash2 className="size-4" />
          </ToolBtn>
        </div>
      </div>
    );
  }

  // —— 图片单选：对齐 Lovspark menuItems + moreItems + left Seedance ——
  const main: Item[] = [
    {
      id: "partialRedraw",
      label: "局部重绘",
      icon: <Paintbrush className="size-4" />,
      action: () => run("partialRedraw"),
    },
    {
      id: "removeBg",
      label: "抠图",
      icon: <Scissors className="size-4" />,
      action: () => run("removeBg"),
    },
    {
      id: "upscale",
      label: "高清放大",
      icon: <ImagePlus className="size-4" />,
      action: () => run("upscale"),
    },
    {
      id: "askAi",
      label: "问 AI",
      icon: <Sparkles className="size-4" strokeWidth={1.75} />,
      ai: true,
      action: () => run("askAi"),
    },
    {
      id: "regenerate",
      label: "重新生成",
      icon: <Wand2 className="size-4" />,
      action: () => run("regenerate"),
    },
    {
      id: "download",
      label: "下载",
      icon: <Download className="size-4" />,
      action: () => run("download"),
    },
  ];

  const more: Item[] = [
    {
      id: "expand",
      label: "图片扩展",
      icon: <Expand className="size-4" />,
      action: () => run("expand"),
    },
    {
      id: "aiRedraw",
      label: "AI重绘",
      icon: <Wand2 className="size-4" />,
      action: () => run("aiRedraw"),
    },
    {
      id: "erase",
      label: "智能消除",
      icon: <Eraser className="size-4" />,
      action: () => run("erase"),
    },
    {
      id: "crop",
      label: "裁剪",
      icon: <Crop className="size-4" />,
      action: () => run("crop"),
    },
    {
      id: "adjust",
      label: "调节",
      icon: <Paintbrush className="size-4" />,
      action: () => run("adjust"),
    },
    {
      id: "delete",
      label: "删除",
      icon: <Trash2 className="size-4" />,
      danger: true,
      action: () => {
        setMoreOpen(false);
        onDelete();
      },
    },
  ];

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
      <div className="fs-sel-toolbar pointer-events-auto">
        {/* leftItems: 图生视频 */}
        <ToolBtn
          title="图生视频"
          label={showToolNames ? "图生视频" : undefined}
          onClick={() => run("video")}
        >
          <Film className="size-4" />
        </ToolBtn>
        <Divider />

        {main.map((it) => (
          <ToolBtn
            key={it.id}
            title={it.title || it.label}
            label={showToolNames ? it.label : undefined}
            ai={it.ai}
            onClick={it.action}
          >
            {it.icon}
          </ToolBtn>
        ))}

        {/* 更多 */}
        <div className="relative" ref={moreRef}>
          <ToolBtn
            title="更多"
            label={showToolNames ? "更多" : undefined}
            onClick={() => setMoreOpen((v) => !v)}
            active={moreOpen}
          >
            <MoreHorizontal className="size-4" />
          </ToolBtn>
          {moreOpen && (
            <div className="fs-sel-more absolute right-0 top-[calc(100%+6px)] z-30 min-w-[148px] py-1">
              {more.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={it.action}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-11 hover:bg-layer-transparent-hover",
                    it.danger ? "text-danger-primary" : "text-secondary"
                  )}
                >
                  <span className="shrink-0 opacity-80">{it.icon}</span>
                  {it.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <ToolBtn title="锁定" label={showToolNames ? "锁定" : undefined} onClick={onToggleLock}>
          <Lock className="size-4" />
        </ToolBtn>
      </div>
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-subtle" aria-hidden />;
}

function ToolBtn({
  title,
  label,
  onClick,
  danger,
  active,
  ai,
  children,
}: {
  title: string;
  label?: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
  /** AI 能力按钮：ai 紫（v3 AI 专属色） */
  ai?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "fs-sel-btn inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 transition-colors duration-150 ease-out",
        danger
          ? "text-danger-primary hover:bg-danger-subtle"
          : ai
            ? "text-ai-primary hover:bg-ai-subtle"
            : active
              ? "bg-accent-subtle text-accent-primary"
              : "text-secondary hover:bg-layer-transparent-hover hover:text-primary"
      )}
    >
      {children}
      {label ? <span className="text-[11px] font-medium leading-none">{label}</span> : null}
    </button>
  );
}

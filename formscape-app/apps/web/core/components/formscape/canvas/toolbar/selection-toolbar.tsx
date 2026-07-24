import type { ReactNode } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Lock,
  LockOpen,
  Sparkles,
  Trash2,
} from "lucide-react";

type Props = {
  count: number;
  locked: boolean;
  showImageActions?: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
  onBringFront?: () => void;
  onSendBack?: () => void;
  onRegenerate?: () => void;
  onAlign?: (mode: AlignMode) => void;
};

export type AlignMode =
  | "left"
  | "center-x"
  | "right"
  | "top"
  | "center-y"
  | "bottom";

/** 选中节点浮出工具条 */
export function SelectionToolbar({
  count,
  locked,
  showImageActions,
  onDuplicate,
  onDelete,
  onToggleLock,
  onBringFront,
  onSendBack,
  onRegenerate,
  onAlign,
}: Props) {
  if (count === 0) return null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
      <div className="pointer-events-auto flex max-w-[min(96vw,720px)] items-center gap-0.5 overflow-x-auto rounded-md border border-subtle bg-surface-1 px-1 py-0.5 shadow-sm">
        <span className="shrink-0 px-2 text-11 font-medium text-tertiary">
          {count > 1 ? `${count} 项` : "已选中"}
        </span>
        <span className="h-4 w-px shrink-0 bg-subtle" />
        <Btn title="复制 ⌘D" onClick={onDuplicate}>
          <Copy className="size-3.5" />
        </Btn>
        <Btn title={locked ? "解锁" : "锁定"} onClick={onToggleLock}>
          {locked ? <LockOpen className="size-3.5" /> : <Lock className="size-3.5" />}
        </Btn>
        {onBringFront && (
          <Btn title="置于顶层 ]" onClick={onBringFront}>
            <ArrowUpToLine className="size-3.5" />
          </Btn>
        )}
        {onSendBack && (
          <Btn title="置于底层 [" onClick={onSendBack}>
            <ArrowDownToLine className="size-3.5" />
          </Btn>
        )}
        {count >= 2 && onAlign && (
          <>
            <span className="h-4 w-px shrink-0 bg-subtle" />
            <Btn title="左对齐" onClick={() => onAlign("left")}>
              <AlignStartVertical className="size-3.5" />
            </Btn>
            <Btn title="水平居中" onClick={() => onAlign("center-x")}>
              <AlignCenterVertical className="size-3.5" />
            </Btn>
            <Btn title="右对齐" onClick={() => onAlign("right")}>
              <AlignEndVertical className="size-3.5" />
            </Btn>
            <Btn title="顶对齐" onClick={() => onAlign("top")}>
              <AlignStartHorizontal className="size-3.5" />
            </Btn>
            <Btn title="垂直居中" onClick={() => onAlign("center-y")}>
              <AlignCenterHorizontal className="size-3.5" />
            </Btn>
            <Btn title="底对齐" onClick={() => onAlign("bottom")}>
              <AlignEndHorizontal className="size-3.5" />
            </Btn>
          </>
        )}
        {showImageActions && onRegenerate && (
          <>
            <span className="h-4 w-px shrink-0 bg-subtle" />
            <Btn title="再生成 / 风格延展" onClick={onRegenerate}>
              <Sparkles className="size-3.5" />
            </Btn>
          </>
        )}
        <Btn title="删除 ⌫" onClick={onDelete} danger>
          <Trash2 className="size-3.5" />
        </Btn>
      </div>
    </div>
  );
}

function Btn({
  title,
  onClick,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={
        danger
          ? "shrink-0 rounded-md p-1.5 text-danger-primary hover:bg-danger-subtle"
          : "shrink-0 rounded-md p-1.5 text-secondary hover:bg-layer-transparent-hover"
      }
    >
      {children}
    </button>
  );
}

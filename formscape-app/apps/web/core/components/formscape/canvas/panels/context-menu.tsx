import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Focus,
  ImageIcon,
  ImagePlus,
  Lock,
  StickyNote,
  Trash2,
  Type,
  Video,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export type ContextMenuState = {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
  nodeId?: string;
} | null;

type Props = {
  menu: ContextMenuState;
  onClose: () => void;
  onAction: (action: string) => void;
  /** 节点模式才显示生成器菜单项 */
  nodeMode?: boolean;
};

const ITEMS: {
  id: string;
  label: string;
  icon: typeof Copy;
  danger?: boolean;
  nodeOnly?: boolean;
  blankOnly?: boolean;
  nodeModeOnly?: boolean;
}[] = [
  { id: "paste", label: "粘贴", icon: Copy, blankOnly: true },
  { id: "duplicate", label: "复制节点 ⌘D", icon: Copy, nodeOnly: true },
  { id: "lock", label: "锁定 / 解锁", icon: Lock, nodeOnly: true },
  { id: "bring-front", label: "置于顶层 ]", icon: ArrowUpToLine, nodeOnly: true },
  { id: "send-back", label: "置于底层 [", icon: ArrowDownToLine, nodeOnly: true },
  { id: "delete", label: "删除 ⌫", icon: Trash2, danger: true, nodeOnly: true },
  { id: "fit", label: "适应画布 ⌘1", icon: Focus },
  { id: "zoom-in", label: "放大 ⌘+", icon: ZoomIn },
  { id: "zoom-out", label: "缩小 ⌘-", icon: ZoomOut },
  { id: "add-imagegen", label: "图片生成器（落点）", icon: ImageIcon, blankOnly: true },
  { id: "add-videogen", label: "视频生成器（落点）", icon: Video, blankOnly: true },
  { id: "add-text", label: "添加文字", icon: Type, blankOnly: true },
  { id: "add-sticky", label: "添加便签", icon: StickyNote, blankOnly: true },
  { id: "upload", label: "上传图片 ⌘⇧K", icon: ImagePlus, blankOnly: true },
];

export function CanvasContextMenu({ menu, onClose, onAction, nodeMode = false }: Props) {
  if (!menu) return null;
  const hasNode = !!menu.nodeId;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => e.preventDefault()} />
      <div
        className="fixed z-50 min-w-[200px] overflow-hidden rounded-md border border-subtle bg-surface-1 py-1 shadow-lg"
        style={{ left: menu.x, top: menu.y }}
      >
        {ITEMS.filter((it) => {
          if (it.nodeModeOnly && !nodeMode) return false;
          if (it.nodeOnly && !hasNode) return false;
          if (it.blankOnly && hasNode) return false;
          return true;
        }).map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              type="button"
              className={
                it.danger
                  ? "flex w-full items-center gap-2 px-3 py-1.5 text-left text-11 text-danger-primary hover:bg-danger-subtle"
                  : "flex w-full items-center gap-2 px-3 py-1.5 text-left text-11 text-secondary hover:bg-layer-transparent-hover"
              }
              onClick={() => {
                onAction(it.id);
                onClose();
              }}
            >
              <Icon className="size-3.5 shrink-0" />
              {it.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

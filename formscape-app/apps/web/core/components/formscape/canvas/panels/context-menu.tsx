import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Focus,
  ImageIcon,
  ImagePlus,
  Lock,
  Sparkles,
  StickyNote,
  Trash2,
  Type,
  Video,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { CANVAS_SKILLS } from "../skills/registry";

export type ContextMenuState = {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
  nodeId?: string;
  /** image | imagegen 时可展示改图 / 技能 */
  nodeType?: string;
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
  imageOnly?: boolean;
}[] = [
  { id: "paste", label: "粘贴", icon: Copy, blankOnly: true },
  { id: "duplicate", label: "复制节点 ⌘D", icon: Copy, nodeOnly: true },
  { id: "regen", label: "再生成", icon: Sparkles, nodeOnly: true, imageOnly: true },
  { id: "style-extend", label: "风格延展", icon: Sparkles, nodeOnly: true, imageOnly: true },
  { id: "variant", label: "出变体 ×2", icon: Sparkles, nodeOnly: true, imageOnly: true },
  { id: "mask-edit", label: "局部改图（蒙版）", icon: Sparkles, nodeOnly: true, imageOnly: true },
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
  { id: "seed-samples", label: "导入 4 张样例", icon: ImagePlus, blankOnly: true },
];

export function CanvasContextMenu({ menu, onClose, onAction, nodeMode = false }: Props) {
  if (!menu) return null;
  const hasNode = !!menu.nodeId;
  const isImageNode = menu.nodeType === "image" || menu.nodeType === "imagegen";

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => e.preventDefault()} />
      <div
        className="fixed z-50 max-h-[min(80vh,520px)] min-w-[220px] overflow-y-auto overflow-x-hidden rounded-md border border-subtle bg-surface-1 py-1 shadow-lg"
        style={{ left: menu.x, top: menu.y }}
      >
        {ITEMS.filter((it) => {
          if (it.nodeModeOnly && !nodeMode) return false;
          if (it.nodeOnly && !hasNode) return false;
          if (it.blankOnly && hasNode) return false;
          if (it.imageOnly && !isImageNode) return false;
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

        {isImageNode && (
          <>
            <div className="my-1 border-t border-subtle" />
            <div className="px-3 py-1 text-[9px] font-semibold uppercase tracking-wide text-placeholder">
              应用技能（14）
            </div>
            {CANVAS_SKILLS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-11 text-secondary hover:bg-layer-transparent-hover"
                onClick={() => {
                  onAction(`skill:${s.id}`);
                  onClose();
                }}
              >
                {s.coverSrc ? (
                  <img src={s.coverSrc} alt="" className="size-3.5 shrink-0 rounded-sm object-cover" />
                ) : (
                  <span
                    className="size-3.5 shrink-0 rounded-sm"
                    style={{ background: `linear-gradient(135deg, ${s.colors.join(",")})` }}
                  />
                )}
                <span className="min-w-0 truncate">{s.name}</span>
              </button>
            ))}
          </>
        )}

        {!hasNode && (
          <>
            <div className="my-1 border-t border-subtle" />
            <div className="px-3 py-1 text-[9px] font-semibold uppercase tracking-wide text-placeholder">
              快捷技能
            </div>
            {CANVAS_SKILLS.filter((s) => s.popular)
              .slice(0, 6)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-11 text-secondary hover:bg-layer-transparent-hover"
                  onClick={() => {
                    onAction(`place-skill:${s.id}`);
                    onClose();
                  }}
                >
                  <Sparkles className="size-3.5 shrink-0 text-accent-primary" />
                  {s.name}
                </button>
              ))}
          </>
        )}
      </div>
    </>
  );
}

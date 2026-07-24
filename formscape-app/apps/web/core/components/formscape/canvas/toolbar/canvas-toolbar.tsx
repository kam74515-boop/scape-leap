import { useEffect, useRef, useState } from "react";
import {
  Frame,
  Hand,
  ImageIcon,
  Library,
  MessageCircle,
  MousePointer2,
  Plus,
  Settings,
  Sparkles,
  Square,
  StickyNote,
  Type,
  Upload,
  Video,
} from "lucide-react";
import { cn } from "@plane/utils";
import type { CanvasTool } from "../types";

type Props = {
  tool: CanvasTool;
  onToolChange: (t: CanvasTool) => void;
  libraryOpen: boolean;
  skillsOpen: boolean;
  onToggleLibrary: () => void;
  onToggleSkills: () => void;
  onAddImageGen: () => void;
  onAddVideoGen: () => void;
  onUpload: () => void;
  onOpenSettings: () => void;
  /**
   * 显示技能入口等扩展项。生成器始终可用。
   * （历史字段；节点模式 UI 隐藏后默认仍展示生成/技能）
   */
  nodeMode?: boolean;
};

/**
 * 底栏：上传 · 图库 · 技能库 · 选择/平移 · 画板/形状/文字/评论/便签 · 设置
 * + 菜单内图片/视频生成器（A / ⌘E 武装后点画布）
 */
export function CanvasToolbar({
  tool,
  onToolChange,
  libraryOpen,
  skillsOpen,
  onToggleLibrary,
  onToggleSkills,
  onAddImageGen,
  onAddVideoGen,
  onUpload,
  onOpenSettings,
  nodeMode = true,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!addOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!addRef.current?.contains(e.target as Node)) setAddOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAddOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [addOpen]);

  return (
    <div
      className="fs-canvas-toolbar"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="fs-tool-add-wrap" ref={addRef}>
        <button
          type="button"
          className={cn("fs-tool fs-tool-add", addOpen && "is-active")}
          title="添加 · A 图片生成（再点画布）"
          aria-expanded={addOpen}
          aria-haspopup="menu"
          onClick={() => setAddOpen((v) => !v)}
        >
          <Plus className="size-4" strokeWidth={2.2} />
        </button>
        {addOpen && (
          <div className="fs-tool-add-pop" role="menu">
            <button
              type="button"
              className="fs-tool-add-row"
              role="menuitem"
              onClick={() => {
                onAddImageGen();
                setAddOpen(false);
              }}
            >
              <ImageIcon className="size-3.5 shrink-0 text-tertiary" />
              图片生成器
              <span className="muted">A → 点画布</span>
            </button>
            <button
              type="button"
              className="fs-tool-add-row"
              role="menuitem"
              onClick={() => {
                onAddVideoGen();
                setAddOpen(false);
              }}
            >
              <Video className="size-3.5 shrink-0 text-tertiary" />
              视频生成器
              <span className="muted">⌘E → 点画布</span>
            </button>
            <button
              type="button"
              className="fs-tool-add-row"
              role="menuitem"
              onClick={() => {
                onUpload();
                setAddOpen(false);
              }}
            >
              <Upload className="size-3.5 shrink-0 text-tertiary" />
              上传图片
              <span className="muted">⌘⇧K</span>
            </button>
          </div>
        )}
      </div>

      {nodeMode && (
        <button
          type="button"
          className={cn("fs-tool fs-tool-pill", skillsOpen && "is-active is-accent")}
          title="技能库 S · AIGC 工作流 / 提示词"
          onClick={onToggleSkills}
        >
          <Sparkles className="size-3.5" />
          技能库
          <span className="fs-tool-kbd">S</span>
        </button>
      )}
      <button
        type="button"
        className={cn("fs-tool fs-tool-pill", libraryOpen && "is-active is-accent")}
        title="图库 L · 上传与生成图像"
        onClick={onToggleLibrary}
      >
        <Library className="size-3.5" />
        图库
        <span className="fs-tool-kbd">L</span>
      </button>

      <span className="fs-tool-sep" />

      <Tool icon={MousePointer2} kbd="V" tip="选择 V / Esc" active={tool === "select"} onClick={() => onToolChange("select")} />
      <Tool icon={Hand} kbd="H" tip="平移 H · 空格临时" active={tool === "pan"} onClick={() => onToolChange("pan")} />

      <span className="fs-tool-sep" />

      <Tool icon={Frame} kbd="F" tip="画板 F" active={tool === "frame"} onClick={() => onToolChange("frame")} />
      <Tool icon={Square} kbd="R" tip="形状 R" active={tool === "shape"} onClick={() => onToolChange("shape")} />
      <Tool icon={Type} kbd="T" tip="文字 T" active={tool === "text"} onClick={() => onToolChange("text")} />
      <Tool icon={MessageCircle} kbd="C" tip="评论 C" active={tool === "comment"} onClick={() => onToolChange("comment")} />
      <Tool icon={StickyNote} kbd="N" tip="便签 N" active={tool === "sticky"} onClick={() => onToolChange("sticky")} />

      <span className="fs-tool-sep" />

      <Tool icon={Settings} tip="设置" onClick={onOpenSettings} />
    </div>
  );
}

function Tool({
  icon: Icon,
  kbd,
  tip,
  active,
  onClick,
}: {
  icon: typeof Plus;
  kbd?: string;
  tip: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={cn("fs-tool", active && "is-active")} title={tip} onClick={onClick}>
      <Icon className="size-4" strokeWidth={1.85} />
      {kbd && <span className="fs-tool-kbd">{kbd}</span>}
    </button>
  );
}

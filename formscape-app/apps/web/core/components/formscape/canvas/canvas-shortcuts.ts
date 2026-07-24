/**
 * 画布快捷键 — 1:1 对齐 Lovspark KeyboardManager + defaultShortcutConfig + ViewportManager
 * （仅行为/键位，不含 UI）
 *
 * 来源：
 * - lovspark-fornt/src/views/agent/tool/KeyboardManager.ts
 * - lovspark-fornt/src/store/module/useCanvasSettings.ts → defaultShortcutConfig
 * - lovspark-fornt/src/views/agent/tool/ViewportManager.ts（Space 临时平移）
 */

export const CANVAS_SHORTCUTS = {
  /** V / Esc → 选择工具 */
  select: ["v", "Escape"],
  /** H → 平移工具（注意：P 不是平移，Lovspark 里 P=钢笔） */
  pan: ["h"],
  /** F → 立即创建 Frame（非进入放置模式） */
  frame: ["f"],
  /** R → 形状工具 */
  shape: ["r"],
  /** T → 文本工具 */
  text: ["t"],
  /** C → 评论工具 */
  comment: ["c"],
  /** N → 便签（Formscape 扩展；Lovspark 走 note 工具入口） */
  sticky: ["n"],
  /** B → 画笔（Formscape 暂无，占位） */
  brush: ["b"],
  /** P → 钢笔（Formscape 暂无，占位；切勿绑平移） */
  pen: ["p"],
  /** A → 落图片生成节点（Lovspark GeneratorImageTool） */
  addImageGen: ["a"],
  /** ⌘/Ctrl+E → 落视频生成节点 */
  addVideoGen: "mod+e",
  /** S → 技能库（L2 · AIGC 工作流 / 提示词） */
  skillsPanel: ["s"],
  /** L → 图库（L2 · 上传 + 生成图像） */
  assetsPanel: ["l"],
  /** Tab → Ask AI */
  askAi: ["Tab"],
  /** ⌘/Ctrl+Shift+K → 上传媒体 */
  uploadMedia: "mod+shift+k",
  /** Delete / Backspace → 删除 */
  delete: ["Delete", "Backspace"],
  /** ⌘/Ctrl+Z 撤销 · ⇧⌘Z / ⌘Y 重做 */
  undo: "mod+z",
  redo: "mod+shift+z | mod+y",
  /** ⌘/Ctrl+C/V/D 复制粘贴复制 */
  copy: "mod+c",
  paste: "mod+v",
  duplicate: "mod+d",
  /** ⌘/Ctrl+A 全选 */
  selectAll: "mod+a",
  /** ] 置顶 · [ 置底 · ⌘] 上移一层 · ⌘[ 下移一层 */
  bringToFront: ["]"],
  sendToBack: ["["],
  bringForward: "mod+]",
  sendBackward: "mod+[",
  /** ⌘+/⌘= 放大 · ⌘- 缩小 · ⌘1 适应内容 · ⌘0 100% */
  zoomIn: "mod+= | mod++",
  zoomOut: "mod+-",
  fitView: "mod+1",
  zoomReset: "mod+0",
  /** Space 按住临时平移（ViewportManager） */
  spacePan: "Space",
  /**
   * stickyKeys：放置类工具用完是否保持。
   * Formscape：一点即落、落完回选择（底栏 / A / ⌘E 均为 one-shot）。
   */
  stickyKeys: false,
} as const;

/** 判断是否在可编辑输入中（对齐 Lovspark hotkeys filter） */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  if (target.closest?.(".el-input, .el-textarea, .el-select, [contenteditable='true']")) return true;
  return false;
}

export function isMod(e: KeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey;
}

/**
 * 节点选中 / 缩放把手统一样式
 * - 隐藏 NodeResizer 直角边线（否则圆角节点会出现方形高亮框）
 * - 选中环用 box-shadow，跟随 border-radius
 */

/** 完全隐藏 resizer 边线 */
export const RESIZER_LINE = "!border-0 !opacity-0 !pointer-events-none";

/** 圆角把手，贴在节点外角 */
export const RESIZER_HANDLE =
  "!h-2 !w-2 !rounded-full !border !border-accent-primary !bg-surface-1 !shadow-sm";

/**
 * 选中环：2px 品牌色外扩（图片节点为直角，无圆角）
 */
export const SELECTED_RING =
  "border-accent-primary shadow-[0_0_0_2px_color-mix(in_srgb,var(--bg-accent-primary)_40%,transparent)]";

export const SELECTED_RING_SOFT =
  "border-accent-primary/50 shadow-[0_0_0_2px_color-mix(in_srgb,var(--bg-accent-primary)_28%,transparent)]";

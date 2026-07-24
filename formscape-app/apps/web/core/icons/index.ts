/**
 * 构境全局 UI 图标库
 *
 * **唯一入口**：业务与壳层 UI 一律 `import { … } from "@/icons"`
 * **底层**：lucide-react（与 Plane Propel 设计体系一致，stroke 1.5）
 *
 * 例外（请勿扩散）：
 * - `@plane/propel/icons`：仅保留 Plane 域专用图形（WorkItems / Cycle / Module 状态等）
 * - 第三方库内部自带图标：不替换
 *
 * 尺寸约定（className）：
 * - 树/侧栏行：`size-3.5` 或 `size-4`
 * - L1 rail：`size-5`
 * - 顶栏按钮：`size-4`
 */
export {
  // re-export 全量，避免漏导
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

// 显式 re-export 常用名，便于 tree-shake 与 IDE 补全（仍可用 `import { AnyIcon } from "@/icons"`）
export * from "lucide-react";

/** 默认 stroke，与 Plane / lucide 推荐一致 */
export const ICON_STROKE = 1.5 as const;

/** 语义尺寸 token（用于 className） */
export const ICON_SIZE = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
  xl: "size-6",
} as const;

export { UiIcon } from "./ui-icon";
export { L1Icons, ProjectNavIcons } from "./product";

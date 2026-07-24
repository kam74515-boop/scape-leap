/**
 * 画布 Agent 桥注册表 — harness 工具只读此处，不依赖 React
 * 全局 Agent 未做；仅画布页 register
 */
import type { CanvasAiBridge } from "../ai-context";

let bridge: CanvasAiBridge | null = null;

export function setCanvasAiBridge(b: CanvasAiBridge | null) {
  bridge = b;
}

export function getCanvasAiBridge(): CanvasAiBridge | null {
  return bridge;
}

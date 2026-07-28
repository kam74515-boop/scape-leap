/**
 * 项目图板 → 画布节点
 * 打开工作画布时把图板 pin 铺在画布左侧，供技能「从画布选择」
 */
import type { ImageNodeData } from "./types";
import type { FsCanvasNode } from "./use-canvas-document";
import {
  listAllStylePins,
  stylePinNodeId,
  type StylePin,
} from "../style-boards-store";

const COLS = 3;
const CELL_W = 168;
const CELL_H = 140;
const GAP = 14;
const ORIGIN_X = 48;
const ORIGIN_Y = 72;

export function isStyleboardNode(n: FsCanvasNode): boolean {
  if (n.type !== "image") return false;
  const d = n.data as ImageNodeData;
  return d.source === "styleboard" || !!d.stylePinId || n.id.startsWith("stylepin-");
}

export function buildStyleboardNodes(projectId: string): FsCanvasNode[] {
  const pins = listAllStylePins(projectId);
  if (!pins.length) return [];

  const frameW = COLS * CELL_W + (COLS - 1) * GAP + 48;
  const rows = Math.ceil(pins.length / COLS);
  const frameH = rows * CELL_H + (rows - 1) * GAP + 56;

  const frame: FsCanvasNode = {
    id: `styleboard-frame-${projectId}`,
    type: "frame",
    position: { x: ORIGIN_X - 24, y: ORIGIN_Y - 40 },
    data: {
      kind: "frame",
      label: "项目图板 · 技能素材",
      tint: "rgba(99,102,241,0.07)",
    },
    style: { width: frameW, height: frameH },
    zIndex: -2,
    draggable: true,
  };

  const images: FsCanvasNode[] = pins.map((pin, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return {
      id: stylePinNodeId(pin.id),
      type: "image" as const,
      position: {
        x: ORIGIN_X + col * (CELL_W + GAP),
        y: ORIGIN_Y + row * (CELL_H + GAP),
      },
      data: {
        kind: "image",
        title: pin.title,
        tags: [
          "图板",
          pin.boardName,
          pin.kind,
          ...(pin.tags ?? []),
        ].filter(Boolean),
        colors: pin.colors?.length ? pin.colors : ["#F5F0E8", "#D4C4B0", "#8B7355"],
        src: pin.src,
        source: "styleboard",
        stylePinId: pin.id,
        styleBoardId: pin.boardId,
      } satisfies ImageNodeData,
      style: { width: CELL_W, height: CELL_H },
    };
  });

  return [frame, ...images];
}

/**
 * 合并图板节点到画布：
 * - 移除旧 styleboard 节点
 * - 保留用户位置：若已有同 pin 节点则沿用 position
 */
export function mergeStyleboardIntoNodes(
  projectId: string,
  current: FsCanvasNode[]
): FsCanvasNode[] {
  const fresh = buildStyleboardNodes(projectId);
  const posMap = new Map<string, { x: number; y: number }>();
  for (const n of current) {
    if (isStyleboardNode(n) || n.id.startsWith("styleboard-frame-")) {
      posMap.set(n.id, n.position);
    }
  }
  const placed = fresh.map((n) => {
    const prev = posMap.get(n.id);
    return prev ? { ...n, position: prev } : n;
  });
  const rest = current.filter(
    (n) => !isStyleboardNode(n) && !n.id.startsWith("styleboard-frame-")
  );
  return [...placed, ...rest];
}

/** 从画布节点取技能槽可用 src */
export function imageSrcFromCanvasNode(n: FsCanvasNode): { src: string; title: string } | null {
  if (n.type === "image") {
    const d = n.data as ImageNodeData;
    if (d.src) return { src: d.src, title: d.title || "画布图" };
  }
  if (n.type === "imagegen") {
    const d = n.data as { results?: { src?: string; title?: string }[]; selectedResultIndex?: number; prompt?: string };
    const r = d.results?.[d.selectedResultIndex ?? 0];
    if (r?.src) return { src: r.src, title: r.title || d.prompt || "生成图" };
  }
  return null;
}

export type { StylePin };

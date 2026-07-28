/**
 * 画布文档持久化回归测试（SQLite 真源）。
 * 驱动真实 use-canvas-document 的 persist 纯函数路径（hook 内 persist 委托同一实现）：
 * - 写入经 fs-data-client → /api/fs/canvas_docs → SQLite；读回保真
 * - board 之间隔离；projectId 不符不读
 * - localStorage 不再出现画布文档（仅留 UI 偏好）
 */
import { beforeEach, describe, expect, test } from "vitest";
import {
  canvasDocStorageKey,
  loadCanvasDoc,
  persistCanvasDoc,
  type FsCanvasNode,
} from "../canvas/use-canvas-document";
import { flushFsWrites, resetFsDataForTests } from "../fs-data-client";

const PROJECT = "proj-test";
const BOARD = "board-a";

function imageNode(id: string, x: number, y: number, src: string): FsCanvasNode {
  return {
    id,
    type: "image",
    position: { x, y },
    data: { kind: "image", src, label: "效果图" },
    style: { width: 320, height: 240 },
  } as unknown as FsCanvasNode;
}

beforeEach(async () => {
  await resetFsDataForTests();
});

describe("画布文档持久化（SQLite 单一写入路径）", () => {
  test("persist → load roundtrip：节点 id/类型/位置/数据/尺寸保真", () => {
    const nodes = [imageNode("n-1", 100, 200, "https://img/1.png")];
    persistCanvasDoc(PROJECT, BOARD, nodes, [], { x: 1, y: 2, zoom: 0.8 });

    const doc = loadCanvasDoc(PROJECT, BOARD);
    expect(doc).not.toBeNull();
    expect(doc!.projectId).toBe(PROJECT);
    expect(doc!.boardId).toBe(BOARD);
    expect(doc!.nodes.length).toBe(1);
    expect(doc!.nodes[0].id).toBe("n-1");
    expect(doc!.nodes[0].type).toBe("image");
    expect(doc!.nodes[0].position).toEqual({ x: 100, y: 200 });
    expect((doc!.nodes[0].data as { src?: string }).src).toBe("https://img/1.png");
    expect(doc!.nodes[0].width).toBe(320);
    expect(doc!.viewport).toEqual({ x: 1, y: 2, zoom: 0.8 });
  });

  test("写入落服务端 SQLite（flush 后可经 API 读回），localStorage 零画布文档", async () => {
    persistCanvasDoc(PROJECT, BOARD, [imageNode("n-2", 0, 0, "s")], [], undefined);
    await flushFsWrites();
    const base = (globalThis as { __FS_API_BASE?: string }).__FS_API_BASE!;
    const docs = (await (await fetch(`${base}/api/fs/canvas_docs`)).json()) as { id: string }[];
    expect(docs.some((d) => d.id === canvasDocStorageKey(PROJECT, BOARD))).toBe(true);
    // localStorage 不再承载画布文档
    for (let i = 0; i < localStorage.length; i++) {
      expect(localStorage.key(i)).not.toContain("canvas.doc");
    }
  });

  test("board 之间隔离：A 板写入不影响 B 板；projectId 不符不读", () => {
    persistCanvasDoc(PROJECT, "board-a", [imageNode("n-a", 0, 0, "a")], [], undefined);
    expect(loadCanvasDoc(PROJECT, "board-b")).toBeNull();
    expect(loadCanvasDoc(PROJECT, "board-a")!.nodes.length).toBe(1);
    expect(loadCanvasDoc("proj-other", "board-a")).toBeNull();
  });

  test("编辑后重读不丢：二次 persist 覆盖同档", () => {
    persistCanvasDoc(PROJECT, BOARD, [imageNode("n-3", 10, 10, "a")], [], undefined);
    persistCanvasDoc(
      PROJECT,
      BOARD,
      [imageNode("n-3", 10, 10, "a"), imageNode("n-4", 50, 60, "b")],
      [],
      undefined
    );
    const doc = loadCanvasDoc(PROJECT, BOARD);
    expect(doc!.nodes.map((n) => n.id)).toEqual(["n-3", "n-4"]);
  });
});

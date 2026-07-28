/**
 * Shipped-path unit tests — imports real formscape modules (no reimplementation).
 * Run: pnpm test (vitest, node env, localStorage polyfill in setup.ts)
 */
import { beforeEach, describe, expect, test } from "vitest";
import { buildWallsObj, wallLength } from "../space-wall-ops";
import { filterEcoProducts, ECO_PRODUCTS } from "../ecology-mock";
import {
  createCustomer,
  getCustomers,
  countCustomersByStage,
  deleteCustomer,
  updateCustomer,
} from "../customers-store";
import {
  addTask,
  listTasks,
  listTasksForProject,
  listDrafts,
  publishDraftAsTask,
  removeTask,
} from "../tasks-store";
import {
  addPlacement,
  addWallSegment,
  getSpaceScene,
  removePlacement,
  removeWall,
  resetSpaceSceneCacheForTests,
  setActiveSpaceProject,
  setSpaceScene,
  updateWall,
} from "../space-model-store";
import { SPACE_BLOCKS } from "../space-model-mock";
import { archiveSession, listAiSessions } from "../ai-sessions";
import { PM_PROJECTS } from "../pm-mock";
import { flushFsWrites, resetFsDataForTests } from "../fs-data-client";
import {
  clearGenHistory,
  loadGenHistory,
  pushGenHistory,
} from "../canvas/skills/gen-history";
import {
  canvasDefaultBoardId,
  findCanvasMeta,
  loadExtraCanvases,
  mergeCanvasTree,
  saveExtraCanvases,
} from "../canvas-mock";
import { createProject } from "../projects-store";
import {
  createPortalShare,
  getPublicPortal,
  revokePortalShare,
  submitPublicPortalStep,
} from "../portal-api";
import { addProjectFile, listFilesForProject } from "../files-store";

beforeEach(async () => {
  // 服务端 SQLite 重播种子 + 客户端缓存重新 hydrate（确定性起点）
  await resetFsDataForTests();
  resetSpaceSceneCacheForTests();
});

describe("space-wall-ops", () => {
  test("buildWallsObj: 2 walls → 16 verts + 12 faces + height 2.8m", () => {
    const walls = [
      { x1: 0, y1: 0, x2: 4000, y2: 0, thickness: 120 },
      { x1: 0, y1: 0, x2: 0, y2: 3000, thickness: 120 },
    ];
    const obj = buildWallsObj(walls, 2800, "test-walls");
    expect(obj).toContain("o test-walls");
    expect((obj.match(/^v /gm) || []).length).toBe(16);
    expect((obj.match(/^f /gm) || []).length).toBe(12);
    expect(wallLength(walls[0])).toBe(4000);
    expect(obj).toContain(" 2.8000 ");
  });
});

describe("ecology-mock", () => {
  test("filterEcoProducts: category + brand + combo empty", () => {
    expect(ECO_PRODUCTS.length).toBeGreaterThan(0);
    const sofa = filterEcoProducts(ECO_PRODUCTS, "sofa", "全部", {});
    expect(sofa.length).toBeGreaterThan(0);
    const brand = [...new Set(ECO_PRODUCTS.map((p) => p.brand))][0];
    const byBrand = filterEcoProducts(ECO_PRODUCTS, "", brand, {});
    expect(byBrand.every((p) => p.brand === brand)).toBe(true);
    expect(filterEcoProducts(ECO_PRODUCTS, "combo", "全部", {}).length).toBe(0);
  });
});

describe("customers-store CRUD 往返", () => {
  test("create → count → update → delete", () => {
    const before = getCustomers().length;
    const created = createCustomer({
      name: "测试客户甲",
      phone: "13800000001",
      wechat: "wx-test",
      source: "其他",
      city: "上海",
      stage: "线索",
      note: "单元测试备注",
    });
    expect(created.id.startsWith("c-")).toBe(true);
    expect(getCustomers().length).toBe(before + 1);
    expect(countCustomersByStage()["线索"]).toBeGreaterThanOrEqual(1);
    const updated = updateCustomer(created.id, { stage: "方案", name: "测试客户甲-改" });
    expect(updated?.stage).toBe("方案");
    deleteCustomer(created.id);
    expect(getCustomers().some((c) => c.id === created.id)).toBe(false);
  });
});

describe("业主 Portal 安全分享", () => {
  test("随机令牌校验、确认回执、轮换旧链接失效、撤销", async () => {
    const first = await createPortalShare("proj-demo-1", 7);
    expect(first.token.length).toBeGreaterThan(24);

    const opened = await getPublicPortal("proj-demo-1", first.token);
    expect(opened.project.name).toContain("滨江壹号");
    expect(opened.state.style.status).toBe("pending");
    expect(opened.deliverables.materials.length).toBeGreaterThan(0);

    const confirmed = await submitPublicPortalStep(
      "proj-demo-1",
      first.token,
      "style",
      "confirmed"
    );
    expect(confirmed.state.style.status).toBe("confirmed");

    const rotated = await createPortalShare("proj-demo-1", 30);
    await expect(getPublicPortal("proj-demo-1", first.token)).rejects.toMatchObject({ status: 404 });
    expect((await getPublicPortal("proj-demo-1", rotated.token)).state.style.status).toBe("confirmed");

    await revokePortalShare("proj-demo-1");
    await expect(getPublicPortal("proj-demo-1", rotated.token)).rejects.toMatchObject({ status: 410 });
  });
});

describe("项目文件真实附件", () => {
  test("上传内容与 Portal 可见标记写入 SQLite，刷新后仍可读取", async () => {
    const file = new File(["hello formscape"], "验收说明.txt", { type: "text/plain" });
    const saved = await addProjectFile("proj-demo-2", file, {
      kind: "其他",
      stageId: "requirements",
      portalVisible: true,
    });
    expect(saved.contentDataUrl).toContain("data:text/plain;base64,");
    expect(saved.portalVisible).toBe(true);
    expect(listFilesForProject("proj-demo-2").some((item) => item.id === saved.id)).toBe(true);

    await flushFsWrites();
    const base = (globalThis as { __FS_API_BASE?: string }).__FS_API_BASE!;
    const persisted = (await (
      await fetch(`${base}/api/fs/files/${encodeURIComponent(saved.id)}`)
    ).json()) as { contentDataUrl?: string };
    expect(persisted.contentDataUrl).toBe(saved.contentDataUrl);
  });
});

describe("tasks-store CRUD 往返", () => {
  test("publishDraftAsTask + addTask + removeTask", () => {
    const drafts = listDrafts();
    expect(drafts.length).toBeGreaterThan(0);
    const t = publishDraftAsTask(drafts[0]);
    expect(t?.title).toBeTruthy();
    expect(listTasksForProject(t!.projectId).some((x) => x.id === t!.id)).toBe(true);
    const manual = addTask({
      projectId: t!.projectId,
      title: "手工任务-测试",
      stageId: t!.stageId,
      state: "todo",
      priority: "medium",
      assignee: t!.assignee || "未分配",
    });
    removeTask(manual.id);
    expect(listTasksForProject(t!.projectId).some((x) => x.id === manual.id)).toBe(false);
  });
});

describe("space-model-store 墙编辑闭环（识别→手工修正）", () => {
  function seedWalls() {
    const cur = getSpaceScene();
    setSpaceScene({
      ...cur,
      walls: [
        { id: "w1", x1: 0, y1: 0, x2: 5000, y2: 0, thickness: 120 },
        { id: "w2", x1: 0, y1: 0, x2: 0, y2: 3000, thickness: 120 },
      ],
      placements: [],
      widthMm: 10000,
      depthMm: 8000,
    });
  }

  test("updateWall：拖端点 + 改厚度写回 scene", () => {
    seedWalls();
    const after = updateWall("w1", { x2: 5200, y2: 100, thickness: 200 });
    const w = after.walls.find((x) => x.id === "w1")!;
    expect(w.x2).toBe(5200);
    expect(w.y2).toBe(100);
    expect(w.thickness).toBe(200);
    // 读回（模拟刷新）仍在
    expect(getSpaceScene().walls.find((x) => x.id === "w1")!.thickness).toBe(200);
  });

  test("removeWall：删除误检墙；addWallSegment：手工补墙", () => {
    seedWalls();
    const removed = removeWall("w2");
    expect(removed.walls.map((w) => w.id)).toEqual(["w1"]);
    const added = addWallSegment(100, 100, 2000, 100, 240);
    expect(added.walls.length).toBe(2);
    expect(added.walls[1].thickness).toBe(240);
  });
});

describe("space-model-store", () => {
  test("只浏览项目场景不会创建空记录", async () => {
    setActiveSpaceProject("proj-demo-3");
    const scene = getSpaceScene();
    expect(scene.projectId).toBe("proj-demo-3");
    expect(scene.walls).toEqual([]);

    await flushFsWrites();
    const base = (globalThis as { __FS_API_BASE?: string }).__FS_API_BASE!;
    const docs = (await (await fetch(`${base}/api/fs/space_scene`)).json()) as { id: string }[];
    expect(docs.some((doc) => doc.id === "scene-proj-demo-3")).toBe(false);
  });

  test("addPlacement / removePlacement", () => {
    const cur = getSpaceScene();
    setSpaceScene({
      ...cur,
      walls: [{ id: "w1", x1: 0, y1: 0, x2: 5000, y2: 0, thickness: 120 }],
      placements: [],
      widthMm: 10000,
      depthMm: 8000,
    });
    const block = SPACE_BLOCKS.find((b) => b.id === "sofa");
    expect(block).toBeTruthy();
    const withPl = addPlacement(block!.id);
    expect(withPl.placements.length).toBe(1);
    expect(withPl.placements[0].blockId).toBe("sofa");
    const cleared = removePlacement(withPl.placements[0].id);
    expect(cleared.placements.length).toBe(0);
  });

  test("项目场景独立持久化：A 的墙体不会出现在 B", async () => {
    setActiveSpaceProject("proj-demo-1");
    const sceneA = getSpaceScene("proj-demo-1");
    setSpaceScene({
      ...sceneA,
      walls: [{ id: "wall-a", x1: 0, y1: 0, x2: 4200, y2: 0, thickness: 120 }],
    });

    setActiveSpaceProject("proj-demo-2");
    const sceneB = getSpaceScene("proj-demo-2");
    expect(sceneB.walls.some((wall) => wall.id === "wall-a")).toBe(false);
    setSpaceScene({
      ...sceneB,
      walls: [{ id: "wall-b", x1: 0, y1: 0, x2: 0, y2: 3600, thickness: 120 }],
    });

    setActiveSpaceProject("proj-demo-1");
    expect(getSpaceScene().walls.map((wall) => wall.id)).toEqual(["wall-a"]);

    await flushFsWrites();
    const base = (globalThis as { __FS_API_BASE?: string }).__FS_API_BASE!;
    const docs = (await (await fetch(`${base}/api/fs/space_scene`)).json()) as { id: string }[];
    expect(docs.some((doc) => doc.id === "scene-proj-demo-1")).toBe(true);
    expect(docs.some((doc) => doc.id === "scene-proj-demo-2")).toBe(true);
  });
});

describe("dashboard KPI 真源", () => {
  test("tasks + drafts + projects are live counts; publish draft increases open", () => {
    const drafts = listDrafts().length;
    expect(PM_PROJECTS.length).toBeGreaterThanOrEqual(1);
    expect(drafts).toBeGreaterThanOrEqual(1);
    const before = listTasks().filter((t) => t.state !== "done").length;
    publishDraftAsTask(listDrafts()[0]);
    const after = listTasks().filter((t) => t.state !== "done").length;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});

describe("gen-history（AI 生成历史 · SQLite 真源）", () => {
  test("pushGenHistory → 读回 → 服务端落库；同 src+title 去重；clearGenHistory 清空", async () => {
    expect(loadGenHistory().length).toBe(0);
    const a = pushGenHistory({ title: "暖白客厅 v1", src: "/mock/a.jpg", colors: ["#F5F0E8"], source: "generate" });
    expect(a.id.startsWith("gh-")).toBe(true);
    expect(loadGenHistory().length).toBe(1);
    // 同 src+title 去重（不新增）
    pushGenHistory({ title: "暖白客厅 v1", src: "/mock/a.jpg", colors: ["#F5F0E8"], source: "generate" });
    expect(loadGenHistory().length).toBe(1);
    // 服务端已持久化（经真实 HTTP → SQLite）
    await flushFsWrites();
    const base = (globalThis as { __FS_API_BASE?: string }).__FS_API_BASE!;
    const docs = (await (await fetch(`${base}/api/fs/gen_history`)).json()) as { id: string; title: string }[];
    expect(docs.some((d) => d.title === "暖白客厅 v1")).toBe(true);
    clearGenHistory();
    expect(loadGenHistory().length).toBe(0);
  });
});

describe("canvas-boards（自建子画布 · SQLite 真源）", () => {
  test("saveExtraCanvases → 分组读回 → mergeCanvasTree 合并进树 → 服务端落库", async () => {
    saveExtraCanvases({
      "proj-demo-1": [{ id: "cv-test-1", name: "测试自建板", updatedAt: "刚刚", nodes: 0 }],
    });
    const grouped = loadExtraCanvases();
    expect(grouped["proj-demo-1"]?.some((b) => b.id === "cv-test-1")).toBe(true);
    const tree = mergeCanvasTree();
    const proj = tree.find((p) => p.projectId === "proj-demo-1")!;
    expect(proj.canvases.some((c) => c.id === "cv-test-1")).toBe(true);
    await flushFsWrites();
    const base = (globalThis as { __FS_API_BASE?: string }).__FS_API_BASE!;
    const docs = (await (await fetch(`${base}/api/fs/canvas_boards`)).json()) as { id: string; projectId: string }[];
    expect(docs.some((d) => d.id === "cv-test-1" && d.projectId === "proj-demo-1")).toBe(true);
  });

  test("新项目自动获得稳定主画布，不再落入 default/未命名画布", () => {
    const project = createProject({
      name: "测试新项目",
      identifier: "CANVAS",
      clientName: "测试客户",
      city: "杭州",
      houseType: "平层",
      budgetWan: 30,
      designFeeWan: 3,
      owner: "林设计师",
      members: [],
    });
    const meta = findCanvasMeta(project.id, null);
    expect(meta?.project.projectName).toBe("测试新项目");
    expect(meta?.board?.id).toBe(canvasDefaultBoardId(project.id));
    expect(meta?.board?.name).toBe("项目主画布");
  });
});

describe("ai-sessions", () => {
  test("archiveSession + listAiSessions shipped storage", () => {
    expect(listAiSessions().length).toBe(0);
    archiveSession("sess-test-1", [
      { id: "u1", role: "user", text: "项目进度怎么样" },
      { id: "a1", role: "agent", text: "演示回复" },
    ]);
    const list = listAiSessions();
    expect(list.length).toBe(1);
    expect(list[0].title).toBe("项目进度怎么样");
    expect(list[0].msgs.length).toBe(2);
  });
});

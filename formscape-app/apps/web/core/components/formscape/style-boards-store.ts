/**
 * 项目风格图板（Pin Board）· Demo localStorage
 *
 * 定位（产品）：
 * - 用户逛生态库 → 产品/材质加入「项目图板」
 * - 后续：Pinterest 等外站收藏、SU/建模镜头设定 → 同一套图板
 * - 画布侧持续展示为参考内容（可落到工作画布作参考图）
 *
 * 与「工作画布」区分：图板 = 项目级灵感/参考容器；画布 = 方案编排与生成
 */
import type { EcoProduct } from "./ecology-mock";
import { ensureFsHydrated, isFsHydrated, readFsCache, registerFsEntity, replaceFsDocs } from "./fs-data-client";

export type StylePinKind = "product" | "material" | "reference" | "camera" | "link";

export type StyleBoardCategory = "style" | "product" | "material" | "camera" | "mixed";

export type StyleCameraMeta = {
  software?: "sketchup" | "rhino" | "3dsmax" | "other";
  fov?: number;
  /** 简单位姿占位，后续对接插件 */
  eye?: [number, number, number];
  target?: [number, number, number];
  note?: string;
};

export type StylePin = {
  id: string;
  kind: StylePinKind;
  title: string;
  src?: string;
  colors?: string[];
  tags?: string[];
  productId?: string;
  brand?: string;
  price?: number;
  material?: string;
  camera?: StyleCameraMeta;
  /** 外站链接（Pinterest 等，后续） */
  externalUrl?: string;
  sourceLabel?: string;
  addedAt: string;
};

export type StyleBoard = {
  id: string;
  projectId: string;
  name: string;
  category: StyleBoardCategory;
  pins: StylePin[];
  updatedAt: string;
};

export const STYLE_BOARDS_CHANGE_EVENT = "fs-style-boards-change";

registerFsEntity("style_boards", STYLE_BOARDS_CHANGE_EVENT);
ensureFsHydrated(["style_boards"]);

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadAll(): Record<string, StyleBoard[]> {
  const map: Record<string, StyleBoard[]> = {};
  for (const b of readFsCache<StyleBoard>("style_boards")) {
    (map[b.projectId] ??= []).push(b);
  }
  return map;
}

function saveAll(map: Record<string, StyleBoard[]>) {
  replaceFsDocs("style_boards", Object.values(map).flat());
}

/** 新项目默认分类图板（带 Demo 种子，打开画布即可选） */
export function defaultBoardsForProject(projectId: string): StyleBoard[] {
  const now = new Date().toISOString();
  // 轻量种子图：内嵌 skill mock + 公共 crawled 占位路径
  const stylePins: StylePin[] = [
    {
      id: uid("pin"),
      kind: "reference",
      title: "风格参考 · 暖白客厅",
      src: "/formscape-skill-mocks/unfurnished-space-generation/case-01/out0.jpg",
      colors: ["#F5F0E8", "#D4C4B0", "#8B7355"],
      tags: ["风格", "客厅"],
      sourceLabel: "图板种子",
      addedAt: now,
    },
    {
      id: uid("pin"),
      kind: "reference",
      title: "风格参考 · 氛围光影",
      src: "/formscape-skill-mocks/space-atmosphere-transformation/case-01/out0.jpg",
      colors: ["#EDE9FE", "#C4B5FD", "#7C3AED"],
      tags: ["风格", "氛围"],
      sourceLabel: "图板种子",
      addedAt: now,
    },
  ];
  const productPins: StylePin[] = [
    {
      id: uid("pin"),
      kind: "product",
      title: "产品 · 灵感延展",
      src: "/formscape-skill-mocks/product-inspiration-expansion/case-01/out0.jpg",
      colors: ["#F0EDE6", "#B8A890", "#6A6050"],
      tags: ["产品"],
      sourceLabel: "图板种子",
      addedAt: now,
    },
    {
      id: uid("pin"),
      kind: "product",
      title: "产品 · 家具手绘参考",
      src: "/formscape-skill-mocks/furniture-sketches/case-01/out0.jpg",
      colors: ["#F3F4F6", "#D1D5DB", "#6B7280"],
      tags: ["产品", "家具"],
      sourceLabel: "图板种子",
      addedAt: now,
    },
  ];
  const materialPins: StylePin[] = [
    {
      id: uid("pin"),
      kind: "material",
      title: "材质 · 提取分析",
      src: "/formscape-skill-mocks/material-extraction-analysis/case-01/out0.jpg",
      colors: ["#E8E4DC", "#C9B8A0", "#5C5346"],
      tags: ["材质"],
      sourceLabel: "图板种子",
      addedAt: now,
    },
    {
      id: uid("pin"),
      kind: "material",
      title: "材质 · 替换参考",
      src: "/formscape-skill-mocks/material-replacement/case-01/out0.jpg",
      colors: ["#E8E4DC", "#C9B8A0", "#5C5346"],
      tags: ["材质"],
      sourceLabel: "图板种子",
      addedAt: now,
    },
  ];
  const cameraPins: StylePin[] = [
    {
      id: uid("pin"),
      kind: "camera",
      title: "SU 镜头 · 客厅主视",
      src: "/formscape-skill-mocks/architectural-multi-angle/case-01/out0.jpg",
      tags: ["镜头", "sketchup"],
      camera: {
        software: "sketchup",
        fov: 35,
        eye: [4.2, 1.6, 3.1],
        target: [0, 1.2, 0],
        note: "Demo 镜头，后续对接插件",
      },
      sourceLabel: "SketchUp",
      addedAt: now,
    },
  ];
  return [
    {
      id: uid("sb"),
      projectId,
      name: "风格参考",
      category: "style",
      pins: stylePins,
      updatedAt: now,
    },
    {
      id: uid("sb"),
      projectId,
      name: "产品选品",
      category: "product",
      pins: productPins,
      updatedAt: now,
    },
    {
      id: uid("sb"),
      projectId,
      name: "材质样板",
      category: "material",
      pins: materialPins,
      updatedAt: now,
    },
    {
      id: uid("sb"),
      projectId,
      name: "镜头设定",
      category: "camera",
      pins: cameraPins,
      updatedAt: now,
    },
  ];
}

/**
 * 若项目图板全空，写入 Demo 种子（旧 localStorage 空板也会补一次）
 * 这样打开画布立刻有可点选素材
 */
export function ensureStyleBoardsSeeded(projectId: string): StyleBoard[] {
  const boards = listStyleBoards(projectId);
  const total = boards.reduce((s, b) => s + b.pins.length, 0);
  if (total > 0) return boards;
  const seeded = defaultBoardsForProject(projectId);
  if (isFsHydrated("style_boards")) {
    const all = loadAll();
    all[projectId] = seeded;
    saveAll(all);
  }
  return seeded;
}

/** 汇总项目所有 pin（画布展示 / 技能点选） */
export function listAllStylePins(projectId: string): Array<StylePin & { boardId: string; boardName: string }> {
  const boards = ensureStyleBoardsSeeded(projectId);
  const out: Array<StylePin & { boardId: string; boardName: string }> = [];
  for (const b of boards) {
    for (const p of b.pins) {
      out.push({ ...p, boardId: b.id, boardName: b.name });
    }
  }
  return out;
}

export function stylePinNodeId(pinId: string) {
  return `stylepin-${pinId}`;
}

export function listStyleBoards(projectId: string): StyleBoard[] {
  const all = loadAll();
  if (!all[projectId]?.length) {
    const seeded = defaultBoardsForProject(projectId);
    // seed-on-miss 守卫：未 hydrate 前只在内存给种子，不写服务端
    if (isFsHydrated("style_boards")) {
      all[projectId] = seeded;
      saveAll(all);
    }
    return seeded;
  }
  return all[projectId];
}

export function getStyleBoard(projectId: string, boardId: string): StyleBoard | null {
  return listStyleBoards(projectId).find((b) => b.id === boardId) ?? null;
}

export function createStyleBoard(
  projectId: string,
  name: string,
  category: StyleBoardCategory = "mixed"
): StyleBoard {
  const all = loadAll();
  const boards = all[projectId]?.length ? [...all[projectId]] : defaultBoardsForProject(projectId);
  const board: StyleBoard = {
    id: uid("sb"),
    projectId,
    name: name.trim() || "未命名图板",
    category,
    pins: [],
    updatedAt: new Date().toISOString(),
  };
  boards.unshift(board);
  all[projectId] = boards;
  saveAll(all);
  return board;
}

function updateBoard(projectId: string, boardId: string, fn: (b: StyleBoard) => StyleBoard): StyleBoard | null {
  const all = loadAll();
  let boards = all[projectId];
  if (!boards?.length) boards = defaultBoardsForProject(projectId);
  const idx = boards.findIndex((b) => b.id === boardId);
  if (idx < 0) return null;
  const next = fn({ ...boards[idx], pins: [...boards[idx].pins] });
  next.updatedAt = new Date().toISOString();
  boards = [...boards];
  boards[idx] = next;
  all[projectId] = boards;
  saveAll(all);
  return next;
}

export function renameStyleBoard(projectId: string, boardId: string, name: string) {
  return updateBoard(projectId, boardId, (b) => ({ ...b, name: name.trim() || b.name }));
}

export function deleteStyleBoard(projectId: string, boardId: string) {
  const all = loadAll();
  const boards = (all[projectId] ?? []).filter((b) => b.id !== boardId);
  all[projectId] = boards.length ? boards : defaultBoardsForProject(projectId);
  saveAll(all);
}

export function addPinToBoard(projectId: string, boardId: string, pin: Omit<StylePin, "id" | "addedAt">): StylePin | null {
  let created: StylePin | null = null;
  updateBoard(projectId, boardId, (b) => {
    // 同 product 不重复
    if (pin.productId && b.pins.some((p) => p.productId === pin.productId)) {
      return b;
    }
    created = {
      ...pin,
      id: uid("pin"),
      addedAt: new Date().toISOString(),
    };
    return { ...b, pins: [created, ...b.pins] };
  });
  return created;
}

export function removePin(projectId: string, boardId: string, pinId: string) {
  updateBoard(projectId, boardId, (b) => ({
    ...b,
    pins: b.pins.filter((p) => p.id !== pinId),
  }));
}

/** 生态产品 → 图板 pin */
export function pinFromEcoProduct(p: EcoProduct, asMaterial = false): Omit<StylePin, "id" | "addedAt"> {
  return {
    kind: asMaterial ? "material" : "product",
    title: p.name,
    src: p.image,
    colors: p.colors,
    tags: [p.category, p.style, p.material].filter(Boolean),
    productId: p.id,
    brand: p.brand,
    price: p.price,
    material: p.material,
    sourceLabel: "生态库",
  };
}

/** 参考图 / 生成图 → pin */
export function pinFromReference(opts: {
  title: string;
  src?: string;
  colors?: string[];
  tags?: string[];
  sourceLabel?: string;
}): Omit<StylePin, "id" | "addedAt"> {
  return {
    kind: "reference",
    title: opts.title,
    src: opts.src,
    colors: opts.colors,
    tags: opts.tags,
    sourceLabel: opts.sourceLabel ?? "参考",
  };
}

/** SU 等镜头设定占位 */
export function pinFromCamera(opts: {
  title: string;
  camera?: StyleCameraMeta;
  src?: string;
}): Omit<StylePin, "id" | "addedAt"> {
  return {
    kind: "camera",
    title: opts.title,
    src: opts.src,
    tags: ["镜头", opts.camera?.software ?? "sketchup"],
    camera: {
      software: "sketchup",
      fov: 35,
      ...opts.camera,
    },
    sourceLabel: opts.camera?.software === "rhino" ? "Rhino" : "SketchUp",
  };
}

/** 外站收藏占位（Pinterest 等） */
export function pinFromExternalLink(opts: {
  title: string;
  url: string;
  src?: string;
  sourceLabel?: string;
}): Omit<StylePin, "id" | "addedAt"> {
  return {
    kind: "link",
    title: opts.title,
    src: opts.src,
    externalUrl: opts.url,
    sourceLabel: opts.sourceLabel ?? "外站",
    tags: ["收藏"],
  };
}

export function preferBoardIdForProduct(projectId: string, asMaterial: boolean): string {
  const boards = listStyleBoards(projectId);
  const cat = asMaterial ? "material" : "product";
  const hit = boards.find((b) => b.category === cat) ?? boards[0];
  return hit.id;
}

export const STYLE_BOARD_CAT_LABEL: Record<StyleBoardCategory, string> = {
  style: "风格",
  product: "产品",
  material: "材质",
  camera: "镜头",
  mixed: "综合",
};

export const STYLE_PIN_KIND_LABEL: Record<StylePinKind, string> = {
  product: "产品",
  material: "材质",
  reference: "参考图",
  camera: "镜头",
  link: "外链",
};

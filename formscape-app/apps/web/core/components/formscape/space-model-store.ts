/**
 * 3D 空间场景状态（Demo · localStorage）
 * L2 上传建筑平面（图/PDF）→ L3 生成与调整墙体/图块
 */
import { blockById, ROOM_TEMPLATES, type RoomTemplateId } from "./space-model-mock";
import { confFromStrictness } from "./space-detect-params";
import { getProjectById, listProjects } from "./projects-store";
import {
  createWall,
  moveWallEndpoint,
  rectFromCenterline,
  type WallEnd,
} from "./space-wall-ops";
import {
  ensureFsHydrated,
  putFsDoc,
  readFsCache,
  registerFsEntity,
  replaceFsDocs,
} from "./fs-data-client";

export type SpaceWall = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  /** YOLO 检测置信度 0–1；手工修正过的墙置 1（不再被严格度过滤掉） */
  conf?: number;
};

export type SpacePlacement = {
  id: string;
  blockId: string;
  label: string;
  x: number;
  y: number;
  rot: number;
  wMm: number;
  dMm: number;
  color: string;
};

export type SpaceSource = "empty" | "import_plan" | "import_pdf" | "generated";

export type SpaceUploadKind = "image" | "pdf";

export type SpaceDetectMethod =
  | "pdf-vector"
  | "image-scan"
  | "pdf-raster-fallback"
  /** YOLO 三模型融合（"route-a" 命名仅作 API 兼容残留） */
  | "ml-route-a"
  | "template"
  | null;

/** L2 上传记录 */
export type SpaceUploadItem = {
  id: string;
  name: string;
  kind: SpaceUploadKind;
  /** 图片底图；PDF 矢量模式通常为 null */
  previewUrl: string | null;
  createdAt: string;
  lastMethod?: SpaceDetectMethod;
};

/** 识别结果多边形（canvas 512 letterbox 或原图像素坐标） */
export type F23dRingPoly = {
  outer: [number, number][] | number[][];
  holes: ([number, number][] | number[][])[];
  /** solid=承重/实心 · hollow=非承重/双线 */
  kind?: "solid" | "hollow" | "unknown" | string;
  /** 检测置信度；前端拖滑条即时过滤，不重跑模型 */
  conf?: number;
  leaf?: number[][];
  symbol?: string;
  /** 稳定 id：墙多边形与 SpaceWall 共用同一 id，供手工修正（删除/拖端点）定位 */
  id?: string;
};

export type F23dPlan = {
  canvas_size: [number, number] | number[];
  content_rect: [number, number, number, number] | number[];
  /** 原图像素尺寸 [w,h]，与 source_polygons / preview_full 对齐 */
  source_size?: [number, number] | number[] | null;
  polygons: {
    wall?: F23dRingPoly[];
    door?: F23dRingPoly[];
    window?: F23dRingPoly[];
  };
  /** 原图像素坐标系多边形（2D 清晰底图叠层用） */
  source_polygons?: {
    wall?: F23dRingPoly[];
    door?: F23dRingPoly[];
    window?: F23dRingPoly[];
  } | null;
  input_image_b64?: string | null;
  /** 原图清晰 PNG（优先底图，非 512 推理图） */
  preview_full_b64?: string | null;
  mask_image_b64?: string | null;
  wall_thickness_mm?: number;
  scale?: {
    mm_per_px?: number;
    source?: string;
    width_mm?: number;
    depth_mm?: number;
    [key: string]: unknown;
  };
  /** 历史字段：服务端导出已弃用（恒 null）；OBJ 由前端墙体生成，见 buildWallsObj */
  glb_b64?: string | null;
  obj_b64?: string | null;
  wall_height_mm?: number;
  pipeline?: string;
  rooms?: F23dRingPoly[];
};

export type SpaceScene = {
  id: string;
  name: string;
  projectId: string | null;
  projectName: string | null;
  source: SpaceSource;
  floorPlanDataUrl: string | null;
  sourceFileName: string | null;
  sourceKind: SpaceUploadKind | null;
  walls: SpaceWall[];
  placements: SpacePlacement[];
  widthMm: number;
  depthMm: number;
  /** 墙高 mm — L3 可调 */
  wallHeightMm: number;
  /** 墙厚 mm — L3 可调（统一改写 walls.thickness） */
  wallThicknessMm: number;
  /** 最近一次识墙方式 */
  detectMethod: SpaceDetectMethod;
  detectMessage: string | null;
  /** 上次识墙严格度 0–100 */
  detectStrictness: number;
  /** 识别多边形预览/挤出（优先于 walls 中心线）— 当前严格度过滤后的可见结果 */
  f23dPlan: F23dPlan | null;
  /**
   * 一次推理的全量结果（含低 conf）。拖置信度只过滤此缓存，不请求后端。
   */
  detectFull?: {
    walls: SpaceWall[];
    f23dPlan: F23dPlan;
  } | null;
  updatedAt: string;
};

const LEGACY_SCENE_DOC_ID = "scene-default";
const UNBOUND_SCENE_DOC_ID = "scene-unbound";
export const SPACE_CHANGE_EVENT = "fs-space-scene-change";

type SpaceSceneDoc = SpaceScene & { id: string };

registerFsEntity("space_scene", SPACE_CHANGE_EVENT);
registerFsEntity("space_uploads", SPACE_CHANGE_EVENT);
ensureFsHydrated(["space_scene", "space_uploads"]);

/** 当前路由绑定的项目；所有编辑函数都只修改这个项目的场景。 */
let activeSpaceProjectId: string | null = null;

/** 当前会话内存场景（含大图）；按项目隔离，服务端只存瘦身后的副本。 */
const liveScenes = new Map<string, SpaceScene>();

function sceneDocId(projectId: string | null) {
  return projectId ? `scene-${projectId}` : UNBOUND_SCENE_DOC_ID;
}

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SPACE_CHANGE_EVENT));
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** 去掉大 base64，避免 localStorage 配额把「新平面」静默写失败 */
function slimF23dPlan(plan: F23dPlan | null | undefined): F23dPlan | null {
  if (!plan) return null;
  return {
    ...plan,
    input_image_b64: null,
    preview_full_b64: null,
    mask_image_b64: null,
    // GLB/OBJ 可能很大，不落盘；会话内 liveScene 仍保留
    glb_b64: null,
    obj_b64: null,
  };
}

function slimSceneForStorage(scene: SpaceScene): SpaceScene {
  const url = scene.floorPlanDataUrl;
  // dataURL 过长（整图）不落盘；会话内仍用 liveScene 显示
  const keepUrl =
    url && url.length <= 350_000 ? url : url && url.startsWith("data:") ? null : url;
  return {
    ...scene,
    floorPlanDataUrl: keepUrl,
    f23dPlan: slimF23dPlan(scene.f23dPlan),
    // 全量缓存只在 liveScene；落盘去掉大图字段
    detectFull: scene.detectFull
      ? {
          walls: scene.detectFull.walls,
          f23dPlan: slimF23dPlan(scene.detectFull.f23dPlan)!,
        }
      : null,
  };
}

/** 持久化到服务端 SQLite（瘦身副本；大图仅留会话内存 liveScenes） */
function tryPersistScene(scene: SpaceScene, projectId: string | null): boolean {
  if (typeof window === "undefined") return true;
  putFsDoc("space_scene", { ...slimSceneForStorage(scene), id: sceneDocId(projectId) });
  return true;
}

export function wallsFromRect(
  widthMm: number,
  depthMm: number,
  template: RoomTemplateId,
  thickness = 120
): SpaceWall[] {
  const t = thickness;
  const outer: SpaceWall[] = [
    { id: uid("w"), x1: 0, y1: 0, x2: widthMm, y2: 0, thickness: t },
    { id: uid("w"), x1: widthMm, y1: 0, x2: widthMm, y2: depthMm, thickness: t },
    { id: uid("w"), x1: widthMm, y1: depthMm, x2: 0, y2: depthMm, thickness: t },
    { id: uid("w"), x1: 0, y1: depthMm, x2: 0, y2: 0, thickness: t },
  ];
  if (template === "studio" || template === "empty") return outer;
  if (template === "1br") {
    const x = Math.round(widthMm * 0.55);
    outer.push({ id: uid("w"), x1: x, y1: 0, x2: x, y2: depthMm * 0.62, thickness: t });
    outer.push({
      id: uid("w"),
      x1: x,
      y1: depthMm * 0.62,
      x2: widthMm,
      y2: depthMm * 0.62,
      thickness: t,
    });
  }
  if (template === "2br") {
    const x = Math.round(widthMm * 0.48);
    const y = Math.round(depthMm * 0.55);
    outer.push({ id: uid("w"), x1: x, y1: 0, x2: x, y2: depthMm, thickness: t });
    outer.push({ id: uid("w"), x1: 0, y1: y, x2: x, y2: y, thickness: t });
    outer.push({
      id: uid("w"),
      x1: x,
      y1: Math.round(depthMm * 0.45),
      x2: widthMm,
      y2: Math.round(depthMm * 0.45),
      thickness: t,
    });
  }
  return outer;
}

function placeAt(blockId: string, x: number, y: number, rot: number): SpacePlacement {
  const def = blockById(blockId)!;
  return {
    id: uid("pl"),
    blockId,
    label: def.label,
    x,
    y,
    rot,
    wMm: def.wMm,
    dMm: def.dMm,
    color: def.color,
  };
}

function seedScene(projectId: string | null = activeSpaceProjectId): SpaceScene {
  const tpl = ROOM_TEMPLATES.find((r) => r.id === "2br")!;
  const p = projectId ? getProjectById(projectId) : listProjects()[0];
  const wallThicknessMm = 120;
  if (projectId) {
    return {
      id: sceneDocId(projectId),
      name: `${p?.name?.split("·")[0]?.trim() ?? "项目"} · 空间模型`,
      projectId,
      projectName: p?.name ?? projectId,
      source: "empty",
      floorPlanDataUrl: null,
      sourceFileName: null,
      sourceKind: null,
      walls: [],
      placements: [],
      widthMm: tpl.widthMm,
      depthMm: tpl.depthMm,
      wallHeightMm: 2800,
      wallThicknessMm,
      detectMethod: null,
      detectMessage: "尚未导入平面图",
      detectStrictness: 50,
      f23dPlan: null,
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    id: "scene-demo-1",
    name: "滨江 · 两居白模",
    projectId: p?.id ?? null,
    projectName: p?.name ?? null,
    source: "generated",
    floorPlanDataUrl: null,
    sourceFileName: null,
    sourceKind: null,
    walls: wallsFromRect(tpl.widthMm, tpl.depthMm, "2br", wallThicknessMm),
    placements: [
      placeAt("sofa", 1800, 2200, 0),
      placeAt("table", 4200, 2800, 0),
      placeAt("bed", 7200, 1200, 0),
      placeAt("tv", 2000, 800, 0),
    ],
    widthMm: tpl.widthMm,
    depthMm: tpl.depthMm,
    wallHeightMm: 2800,
    wallThicknessMm,
    detectMethod: "template",
    detectMessage: "示例模板墙体（上传平面后将替换为真实识墙）",
    detectStrictness: 50,
    f23dPlan: null,
    updatedAt: new Date().toISOString(),
  };
}

function migrateScene(
  raw: Partial<SpaceScene> & { modelFileName?: string },
  projectId: string | null
): SpaceScene {
  const base = seedScene(projectId);
  const project = projectId ? getProjectById(projectId) : null;
  return {
    ...base,
    ...raw,
    projectId: projectId ?? raw.projectId ?? null,
    projectName: project?.name ?? raw.projectName ?? null,
    sourceFileName: raw.sourceFileName ?? raw.modelFileName ?? null,
    sourceKind: raw.sourceKind ?? null,
    wallHeightMm: raw.wallHeightMm ?? 2800,
    wallThicknessMm: raw.wallThicknessMm ?? 120,
    walls: raw.walls ?? base.walls,
    placements: raw.placements ?? [],
    detectMethod: raw.detectMethod ?? null,
    detectMessage: raw.detectMessage ?? null,
    detectStrictness: raw.detectStrictness ?? 50,
    f23dPlan: (raw as SpaceScene).f23dPlan ?? null,
  };
}

function load(projectId: string | null = activeSpaceProjectId): SpaceScene {
  const key = sceneDocId(projectId);
  // 优先会话内存（含完整底图 / 刚检测完的结果）
  const live = liveScenes.get(key);
  if (live) return live;

  const docs = readFsCache<SpaceSceneDoc>("space_scene");
  const exact = docs.find((d) => d.id === key);
  // 兼容旧库：scene-default 只允许迁移给它明确绑定的同一项目，绝不借给别的项目。
  const legacy = docs.find((d) => d.id === LEGACY_SCENE_DOC_ID);
  const doc =
    exact ??
    (projectId && legacy?.projectId === projectId
      ? legacy
      : !projectId
        ? legacy
        : undefined);
  if (doc) {
    const s = migrateScene(doc, projectId);
    liveScenes.set(key, s);
    return s;
  }
  const s = seedScene(projectId);
  // 浏览/切换项目只创建会话内空场景；首次真实编辑时才持久化，避免页面访问改业务数据。
  liveScenes.set(key, s);
  return s;
}

function save(
  scene: SpaceScene,
  notify = true,
  projectId: string | null = activeSpaceProjectId
) {
  const project = projectId ? getProjectById(projectId) : null;
  const next = {
    ...scene,
    projectId: projectId ?? scene.projectId ?? null,
    projectName: project?.name ?? (projectId ? scene.projectName ?? projectId : scene.projectName),
    updatedAt: new Date().toISOString(),
  };
  liveScenes.set(sceneDocId(projectId), next);
  tryPersistScene(next, projectId);
  if (notify) emit();
  return next;
}

export function setActiveSpaceProject(projectId: string | null | undefined) {
  activeSpaceProjectId = projectId || null;
}

export function getSpaceScene(projectId?: string | null): SpaceScene {
  return load(projectId === undefined ? activeSpaceProjectId : projectId);
}

export function setSpaceScene(scene: SpaceScene): SpaceScene {
  return save(scene);
}

/** 测试与热重载清理：不改服务端数据。 */
export function resetSpaceSceneCacheForTests() {
  activeSpaceProjectId = null;
  liveScenes.clear();
}

// ─── 上传列表（L2） ─────────────────────────────────────────

function loadUploads(): SpaceUploadItem[] {
  return readFsCache<SpaceUploadItem>("space_uploads");
}

function saveUploads(list: SpaceUploadItem[]) {
  // 列表不存大图，只留文件名
  const slim = list.slice(0, 12).map((u) => ({
    ...u,
    previewUrl:
      u.previewUrl && u.previewUrl.length > 80_000 ? null : u.previewUrl,
  }));
  replaceFsDocs("space_uploads", slim);
}

export function getSpaceUploads(): SpaceUploadItem[] {
  return loadUploads();
}

export function addSpaceUpload(item: Omit<SpaceUploadItem, "id" | "createdAt">): SpaceUploadItem[] {
  const row: SpaceUploadItem = {
    ...item,
    // 列表不存整图 dataURL
    previewUrl:
      item.previewUrl && item.previewUrl.length > 80_000 ? null : item.previewUrl,
    id: uid("up"),
    createdAt: new Date().toISOString(),
  };
  const next = [row, ...loadUploads()].slice(0, 12);
  saveUploads(next);
  return next;
}

export function removeSpaceUpload(id: string): SpaceUploadItem[] {
  const next = loadUploads().filter((u) => u.id !== id);
  saveUploads(next);
  return next;
}

/**
 * 按 conf 阈值过滤墙/门/窗（纯内存，即时；与朋友项目一致）
 */
export function filterDetectByConf(
  full: { walls: SpaceWall[]; f23dPlan: F23dPlan },
  confMin: number
): { walls: SpaceWall[]; f23dPlan: F23dPlan } {
  const keep = (c?: number) => (c == null ? true : c >= confMin);
  const walls = full.walls.filter((w) => keep(w.conf));
  const filt = (list?: F23dRingPoly[]) => (list ?? []).filter((p) => keep(p.conf));
  const src = full.f23dPlan.source_polygons;
  const poly = full.f23dPlan.polygons;
  const f23dPlan: F23dPlan = {
    ...full.f23dPlan,
    polygons: {
      wall: filt(poly?.wall),
      door: filt(poly?.door),
      window: filt(poly?.window),
    },
    source_polygons: src
      ? {
          wall: filt(src.wall),
          door: filt(src.door),
          window: filt(src.window),
        }
      : full.f23dPlan.source_polygons,
  };
  return { walls, f23dPlan };
}

/**
 * 应用真实识墙结果（PDF 矢量 / 图片扫描）
 * ML 结果会写入 detectFull 全量缓存；显示层按 strictness→conf 过滤。
 */
export function applyDetectedPlan(opts: {
  name: string;
  kind: SpaceUploadKind;
  previewUrl: string | null;
  walls: SpaceWall[];
  widthMm: number;
  depthMm: number;
  method: SpaceDetectMethod;
  message: string;
  strictness?: number;
  f23dPlan?: F23dPlan | null;
}): SpaceScene {
  const cur = load();
  const baseName = opts.name.replace(/\.(pdf|png|jpe?g|webp)$/i, "");
  const thickness =
    opts.walls[0]?.thickness ?? cur.wallThicknessMm ?? 120;
  const strictness = opts.strictness ?? cur.detectStrictness ?? 50;
  const confMin = confFromStrictness(strictness);

  // 底图优先用户上传原图 dataURL（最清晰）；其次服务端原图 PNG；不用 512 推理图
  let preview = opts.previewUrl;
  if (!preview && opts.f23dPlan?.preview_full_b64) {
    preview = `data:image/png;base64,${opts.f23dPlan.preview_full_b64}`;
  }
  if (!preview && opts.f23dPlan?.input_image_b64) {
    preview = `data:image/png;base64,${opts.f23dPlan.input_image_b64}`;
  }

  addSpaceUpload({
    name: opts.name,
    kind: opts.kind,
    previewUrl: preview,
    lastMethod: opts.method,
  });

  const wallsFull = opts.walls.map((w) => ({
    ...w,
    thickness: w.thickness || thickness,
  }));
  // 给多边形分配稳定 id（墙多边形与 SpaceWall 共 id），供手工修正定位
  const pairedFull = opts.f23dPlan
    ? withPairedIds({ walls: wallsFull, f23dPlan: opts.f23dPlan })
    : null;
  const f23dFull = pairedFull?.f23dPlan ?? null;
  const detectFull =
    f23dFull && opts.method === "ml-route-a"
      ? { walls: wallsFull, f23dPlan: f23dFull }
      : null;

  const filtered =
    detectFull != null
      ? filterDetectByConf(detectFull, confMin)
      : { walls: wallsFull, f23dPlan: f23dFull };

  const wN = filtered.f23dPlan?.source_polygons?.wall?.length ?? filtered.walls.length;
  const dN = filtered.f23dPlan?.source_polygons?.door?.length ?? 0;
  const winN = filtered.f23dPlan?.source_polygons?.window?.length ?? 0;
  const msgBase = opts.message;
  const msgFilter =
    detectFull != null
      ? `${msgBase} · 严格度 ${strictness} → 墙${wN} 门${dN} 窗${winN}`
      : msgBase;

  return save({
    ...cur,
    name: `${baseName} · 识墙`,
    source: opts.kind === "pdf" ? "import_pdf" : "import_plan",
    floorPlanDataUrl: preview,
    sourceFileName: opts.name,
    sourceKind: opts.kind,
    walls: filtered.walls,
    placements: [],
    widthMm: Math.max(1000, opts.widthMm),
    depthMm: Math.max(1000, opts.depthMm),
    wallHeightMm: cur.wallHeightMm || 2800,
    wallThicknessMm: opts.f23dPlan?.wall_thickness_mm ?? thickness,
    detectMethod: opts.method,
    detectMessage: msgFilter,
    detectStrictness: strictness,
    f23dPlan: filtered.f23dPlan,
    detectFull,
  });
}

/**
 * 仅改置信度：用 detectFull 即时过滤，不请求后端。
 * @returns 更新后的场景；无全量缓存时返回 null
 */
export function applyDetectConfFilter(strictness: number): SpaceScene | null {
  const cur = load();
  if (!cur.detectFull?.f23dPlan) return null;
  const confMin = confFromStrictness(strictness);
  const { walls, f23dPlan } = filterDetectByConf(cur.detectFull, confMin);
  const wN = f23dPlan.source_polygons?.wall?.length ?? walls.length;
  const dN = f23dPlan.source_polygons?.door?.length ?? 0;
  const winN = f23dPlan.source_polygons?.window?.length ?? 0;
  return save({
    ...cur,
    walls,
    f23dPlan,
    detectStrictness: strictness,
    detectMessage: `严格度 ${strictness} · 墙${wN} 门${dN} 窗${winN}（即时更新，无需等待）`,
  });
}

// ─── 识别 → 手工修正闭环 ─────────────────────────────────────

export type DetectKind = "wall" | "door" | "window";

/** 给识别多边形补稳定 id（墙多边形与 SpaceWall 共 id）；已有 id 的不动 */
function withPairedIds(pair: { walls: SpaceWall[]; f23dPlan: F23dPlan }): {
  walls: SpaceWall[];
  f23dPlan: F23dPlan;
} {
  const plan = pair.f23dPlan;
  const src = plan.source_polygons ?? null;
  const pairKind = (kind: DetectKind) => {
    const cList = [...(plan.polygons[kind] ?? [])];
    const sList = src ? [...(src[kind] ?? [])] : null;
    const primaryLen = sList?.length ?? cList.length;
    const wallAligned = kind === "wall" && pair.walls.length === primaryLen;
    const len = Math.max(cList.length, sList?.length ?? 0);
    for (let i = 0; i < len; i++) {
      const existing = sList?.[i]?.id ?? cList[i]?.id;
      const id = existing ?? (wallAligned ? pair.walls[i]?.id : undefined) ?? uid(`det-${kind}`);
      if (cList[i] && !cList[i].id) cList[i] = { ...cList[i], id };
      if (sList?.[i] && !sList[i].id) sList[i] = { ...sList[i], id };
    }
    return { cList, sList };
  };
  const w = pairKind("wall");
  const d = pairKind("door");
  const win = pairKind("window");
  return {
    walls: pair.walls,
    f23dPlan: {
      ...plan,
      polygons: { wall: w.cList, door: d.cList, window: win.cList },
      source_polygons: src
        ? { wall: w.sList ?? [], door: d.sList ?? [], window: win.sList ?? [] }
        : plan.source_polygons,
    },
  };
}

/** 原图像素/毫米换算：优先服务端 scale，缺省由 source_size 与场景宽推回 */
export function planPxPerMm(plan: F23dPlan, widthMm: number): number {
  const mmPerPx = Number(plan.scale?.mm_per_px) || 0;
  if (mmPerPx > 0) return 1 / mmPerPx;
  const srcW = Number(plan.source_size?.[0]) || 0;
  if (srcW > 0 && widthMm > 0) return srcW / widthMm;
  return 0;
}

/** 手工修正统一入口：编辑作用在全量缓存（detectFull），显示层按当前严格度重新过滤 */
function applyDetectEdit(
  mutate: (pair: { walls: SpaceWall[]; f23dPlan: F23dPlan }) => {
    walls: SpaceWall[];
    f23dPlan: F23dPlan;
  },
  message: string
): SpaceScene {
  const cur = load();
  if (cur.detectFull?.f23dPlan) {
    const full = withPairedIds(cur.detectFull);
    const next = mutate(full);
    const filtered = filterDetectByConf(next, confFromStrictness(cur.detectStrictness));
    return save({
      ...cur,
      walls: filtered.walls,
      f23dPlan: filtered.f23dPlan,
      detectFull: next,
      detectMessage: message,
    });
  }
  if (cur.f23dPlan) {
    const next = mutate(withPairedIds({ walls: cur.walls, f23dPlan: cur.f23dPlan }));
    return save({ ...cur, walls: next.walls, f23dPlan: next.f23dPlan, detectMessage: message });
  }
  return cur;
}

/** 修正模式前调用：确保多边形已有 id（旧数据补齐并落盘） */
export function ensureDetectIds(): SpaceScene {
  const cur = load();
  if (!cur.f23dPlan && !cur.detectFull?.f23dPlan) return cur;
  return applyDetectEdit((pair) => pair, cur.detectMessage ?? "修正模式");
}

/** 点选删除误检的墙 / 门 / 窗（同步全量缓存 + 当前显示 + 统计徽标） */
export function removeDetectedItem(kind: DetectKind, id: string): SpaceScene {
  const label = kind === "wall" ? "墙段" : kind === "door" ? "门" : "窗";
  return applyDetectEdit(
    (pair) => {
      const drop = (list?: F23dRingPoly[]) => (list ?? []).filter((p) => p.id !== id);
      const plan = pair.f23dPlan;
      return {
        walls: kind === "wall" ? pair.walls.filter((w) => w.id !== id) : pair.walls,
        f23dPlan: {
          ...plan,
          polygons: { ...plan.polygons, [kind]: drop(plan.polygons[kind]) },
          source_polygons: plan.source_polygons
            ? { ...plan.source_polygons, [kind]: drop(plan.source_polygons[kind]) }
            : plan.source_polygons,
        },
      };
    },
    `已删除误检${label}（手工修正）`
  );
}

/** 由墙中心线（mm）重建对应多边形（原图像素 + canvas letterbox 两套坐标） */
function regenWallPolys(
  prevWalls: SpaceWall[],
  nextWalls: SpaceWall[],
  plan: F23dPlan,
  widthMm: number
): F23dPlan {
  const pxPerMm = planPxPerMm(plan, widthMm);
  if (!pxPerMm) return plan;
  const srcW = Number(plan.source_size?.[0]) || 0;
  const [L, T, nw] = ((plan.content_rect as number[]) ?? [0, 0, 0, 0]) as number[];
  const cScale = srcW > 0 && nw > 0 ? nw / srcW : 0;

  const before = new Map(prevWalls.map((w) => [w.id, w]));
  const changed = new Map<string, { src: [number, number][]; canvas: [number, number][] }>();
  for (const w of nextWalls) {
    const old = before.get(w.id);
    if (
      old &&
      old.x1 === w.x1 &&
      old.y1 === w.y1 &&
      old.x2 === w.x2 &&
      old.y2 === w.y2 &&
      old.thickness === w.thickness
    )
      continue;
    const srcRect = rectFromCenterline(
      w.x1 * pxPerMm,
      w.y1 * pxPerMm,
      w.x2 * pxPerMm,
      w.y2 * pxPerMm,
      Math.max(2, w.thickness * pxPerMm)
    );
    const canvasRect = cScale
      ? srcRect.map(([x, y]) => [L + x * cScale, T + y * cScale] as [number, number])
      : srcRect;
    changed.set(w.id, { src: srcRect, canvas: canvasRect });
  }
  if (!changed.size) return plan;

  const patch = (list: F23dRingPoly[] | undefined, space: "src" | "canvas") =>
    (list ?? []).map((p) => {
      const hit = p.id ? changed.get(p.id) : undefined;
      if (!hit) return p;
      // 手工修正过的墙视为已确认：conf 置 1，不再被严格度滑杆过滤掉
      return { ...p, outer: space === "src" ? hit.src : hit.canvas, holes: [], conf: 1 };
    });
  return {
    ...plan,
    polygons: { ...plan.polygons, wall: patch(plan.polygons.wall, "canvas") },
    source_polygons: plan.source_polygons
      ? { ...plan.source_polygons, wall: patch(plan.source_polygons.wall, "src") }
      : plan.source_polygons,
  };
}

/** 拖拽墙段端点（mm 坐标；共点墙联动、端点吸附），并同步重建多边形 */
export function moveDetectedWallEndpoint(
  id: string,
  end: WallEnd,
  xMm: number,
  yMm: number
): SpaceScene {
  const widthMm = load().widthMm;
  return applyDetectEdit(
    (pair) => {
      const moved = moveWallEndpoint(pair.walls, id, end, xMm, yMm, {
        linked: true,
        snap: true,
      });
      const walls = moved.map((w) => (w.id === id ? { ...w, conf: 1 } : w));
      return {
        walls,
        f23dPlan: regenWallPolys(pair.walls, walls, pair.f23dPlan, widthMm),
      };
    },
    "已调整墙段端点（手工修正）"
  );
}

/** 修改单段墙厚度（mm），并同步重建多边形 */
export function setDetectedWallThickness(id: string, thicknessMm: number): SpaceScene {
  const widthMm = load().widthMm;
  const t = Math.max(40, Math.min(400, Math.round(thicknessMm)));
  return applyDetectEdit(
    (pair) => {
      const walls = pair.walls.map((w) => (w.id === id ? { ...w, thickness: t, conf: 1 } : w));
      return {
        walls,
        f23dPlan: regenWallPolys(pair.walls, walls, pair.f23dPlan, widthMm),
      };
    },
    `墙厚已改为 ${t}mm（手工修正）`
  );
}

/** 删除单段墙（识墙后用户清理误检） */
export function removeWall(id: string): SpaceScene {
  const cur = load();
  return save({
    ...cur,
    walls: cur.walls.filter((w) => w.id !== id),
    detectMessage: cur.detectMessage
      ? `${cur.detectMessage} · 已删 1 段`
      : "已删除墙段",
  });
}

export function removeWalls(ids: string[]): SpaceScene {
  const set = new Set(ids);
  const cur = load();
  const before = cur.walls.length;
  const walls = cur.walls.filter((w) => !set.has(w.id));
  return save({
    ...cur,
    walls,
    detectMessage: `已删除 ${before - walls.length} 段墙 · 剩余 ${walls.length}`,
  });
}

export function clearWalls(): SpaceScene {
  const cur = load();
  return save({ ...cur, walls: [], detectMessage: "已清空全部墙段" });
}

/** 直接替换墙列表（编辑操作后写回） */
export function setWalls(walls: SpaceWall[], message?: string): SpaceScene {
  const cur = load();
  return save({
    ...cur,
    walls,
    detectMessage: message ?? cur.detectMessage,
  });
}

export function updateWall(
  id: string,
  patch: Partial<Pick<SpaceWall, "x1" | "y1" | "x2" | "y2" | "thickness">>
): SpaceScene {
  const cur = load();
  return save({
    ...cur,
    walls: cur.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)),
  });
}

export function addWallSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness?: number
): SpaceScene {
  const cur = load();
  const t = thickness ?? cur.wallThicknessMm ?? 120;
  const w = createWall(x1, y1, x2, y2, t);
  if (!w) return cur;
  return save({
    ...cur,
    walls: [...cur.walls, w],
    detectMessage: `已画墙 · 共 ${cur.walls.length + 1} 段`,
  });
}

/** @deprecated 模板假识墙；请用 applyDetectedPlan */
export function generateFromUpload(opts: {
  name: string;
  kind: SpaceUploadKind;
  previewUrl: string | null;
  template?: RoomTemplateId;
}): SpaceScene {
  const cur = load();
  const template = opts.template ?? (opts.kind === "pdf" ? "2br" : "1br");
  const tpl = ROOM_TEMPLATES.find((r) => r.id === template) ?? ROOM_TEMPLATES[2];
  const walls = wallsFromRect(
    tpl.widthMm,
    tpl.depthMm,
    template === "empty" ? "1br" : template,
    cur.wallThicknessMm || 120
  );
  return applyDetectedPlan({
    name: opts.name,
    kind: opts.kind,
    previewUrl: opts.previewUrl,
    walls,
    widthMm: tpl.widthMm,
    depthMm: tpl.depthMm,
    method: "template",
    message: "模板生成（未走真实识墙）",
  });
}

export function regenerateWalls(template: RoomTemplateId): SpaceScene {
  const cur = load();
  const tpl = ROOM_TEMPLATES.find((r) => r.id === template) ?? ROOM_TEMPLATES[0];
  const t = cur.wallThicknessMm || 120;
  return save({
    ...cur,
    source: cur.source === "empty" ? "generated" : cur.source,
    walls:
      template === "empty"
        ? []
        : wallsFromRect(tpl.widthMm, tpl.depthMm, template, t),
    widthMm: template === "empty" ? cur.widthMm : tpl.widthMm,
    depthMm: template === "empty" ? cur.depthMm : tpl.depthMm,
    detectMethod: "template",
    detectMessage: `模板重算「${tpl.label}」（覆盖识墙结果）`,
  });
}

export function setWallParams(opts: { wallHeightMm?: number; wallThicknessMm?: number }): SpaceScene {
  const cur = load();
  const wallHeightMm = opts.wallHeightMm ?? cur.wallHeightMm;
  const wallThicknessMm = opts.wallThicknessMm ?? cur.wallThicknessMm;
  // 只有显式改「统一墙厚」时才覆盖每段墙厚（识别结果的逐段厚度不能被改墙高误伤）
  const walls =
    opts.wallThicknessMm != null
      ? cur.walls.map((w) => ({ ...w, thickness: wallThicknessMm }))
      : cur.walls;
  return save({ ...cur, wallHeightMm, wallThicknessMm, walls });
}

export function resetToTemplate(templateId: RoomTemplateId, projectId?: string | null): SpaceScene {
  const tpl = ROOM_TEMPLATES.find((r) => r.id === templateId) ?? ROOM_TEMPLATES[0];
  const cur = load();
  const project =
    projectId !== undefined
      ? projectId
        ? getProjectById(projectId)
        : undefined
      : cur.projectId
        ? getProjectById(cur.projectId)
        : listProjects()[0];
  const t = cur.wallThicknessMm || 120;
  return save({
    ...cur,
    name:
      templateId === "empty"
        ? "未命名空间"
        : `${project?.name?.split("·")[0]?.trim() ?? "空间"} · ${tpl.label}`,
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
    source: templateId === "empty" ? "empty" : "generated",
    floorPlanDataUrl: null,
    sourceFileName: null,
    sourceKind: null,
    walls: templateId === "empty" ? [] : wallsFromRect(tpl.widthMm, tpl.depthMm, templateId, t),
    placements: [],
    widthMm: tpl.widthMm,
    depthMm: tpl.depthMm,
    detectMethod: "template",
    detectMessage: templateId === "empty" ? "空白场景" : `模板「${tpl.label}」`,
  });
}

/** @deprecated 用 generateFromUpload */
export function generateWallsFromPlan(
  dataUrl: string,
  opts?: { widthMm?: number; depthMm?: number }
): SpaceScene {
  return generateFromUpload({
    name: "平面图.png",
    kind: "image",
    previewUrl: dataUrl,
    template: "1br",
  });
}

export function addPlacement(blockId: string, x?: number, y?: number): SpaceScene {
  const cur = load();
  const def = blockById(blockId);
  if (!def) return cur;
  const px = x ?? Math.round(cur.widthMm / 2 - def.wMm / 2);
  const py = y ?? Math.round(cur.depthMm / 2 - def.dMm / 2);
  const pl: SpacePlacement = {
    id: uid("pl"),
    blockId,
    label: def.label,
    x: px,
    y: py,
    rot: 0,
    wMm: def.wMm,
    dMm: def.dMm,
    color: def.color,
  };
  return save({ ...cur, placements: [...cur.placements, pl] });
}

export function updatePlacement(
  id: string,
  patch: Partial<Pick<SpacePlacement, "x" | "y" | "rot">>
): SpaceScene {
  const cur = load();
  return save({
    ...cur,
    placements: cur.placements.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  });
}

export function removePlacement(id: string): SpaceScene {
  const cur = load();
  return save({ ...cur, placements: cur.placements.filter((p) => p.id !== id) });
}

export function clearPlacements(): SpaceScene {
  const cur = load();
  return save({ ...cur, placements: [] });
}

export function bindSceneProject(projectId: string | null): SpaceScene {
  const cur = load();
  const p = projectId ? getProjectById(projectId) : null;
  setActiveSpaceProject(projectId);
  return save(
    {
      ...cur,
      projectId: p?.id ?? null,
      projectName: p?.name ?? null,
    },
    true,
    projectId
  );
}

export function sourceLabel(s: SpaceSource): string {
  if (s === "import_pdf") return "PDF 识墙";
  if (s === "import_plan") return "平面识墙";
  if (s === "generated") return "模板生成";
  return "空白";
}

export function detectMethodLabel(m: SpaceDetectMethod): string {
  if (m === "pdf-vector") return "PDF 矢量";
  if (m === "image-scan") return "图片扫描";
  if (m === "pdf-raster-fallback") return "PDF 栅格";
  if (m === "ml-route-a") return "YOLO 三模型融合";
  if (m === "template") return "模板";
  return "—";
}

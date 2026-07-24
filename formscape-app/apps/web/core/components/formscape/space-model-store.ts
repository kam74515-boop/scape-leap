/**
 * 3D 空间场景状态（Demo · localStorage）
 * L2 上传建筑平面（图/PDF）→ L3 生成与调整墙体/图块
 */
import { blockById, ROOM_TEMPLATES, type RoomTemplateId } from "./space-model-mock";
import { PM_PROJECTS } from "./pm-mock";
import { createWall } from "./space-wall-ops";

export type SpaceWall = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
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
  | "ml-cubicasa"
  | "ml-heuristic"
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
  updatedAt: string;
};

const SCENE_KEY = "fs-space-scene-v2";
const UPLOADS_KEY = "fs-space-uploads-v1";
export const SPACE_CHANGE_EVENT = "fs-space-scene-change";

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SPACE_CHANGE_EVENT));
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
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

function seedScene(): SpaceScene {
  const tpl = ROOM_TEMPLATES.find((r) => r.id === "2br")!;
  const p = PM_PROJECTS[0];
  const wallThicknessMm = 120;
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
    updatedAt: new Date().toISOString(),
  };
}

function migrateScene(raw: Partial<SpaceScene> & { modelFileName?: string }): SpaceScene {
  const base = seedScene();
  return {
    ...base,
    ...raw,
    sourceFileName: raw.sourceFileName ?? raw.modelFileName ?? null,
    sourceKind: raw.sourceKind ?? null,
    wallHeightMm: raw.wallHeightMm ?? 2800,
    wallThicknessMm: raw.wallThicknessMm ?? 120,
    walls: raw.walls ?? base.walls,
    placements: raw.placements ?? [],
    detectMethod: raw.detectMethod ?? null,
    detectMessage: raw.detectMessage ?? null,
    detectStrictness: raw.detectStrictness ?? 50,
  };
}

function load(): SpaceScene {
  try {
    const raw = localStorage.getItem(SCENE_KEY) ?? localStorage.getItem("fs-space-scene-v1");
    if (raw) return migrateScene(JSON.parse(raw) as SpaceScene);
  } catch {
    /* ignore */
  }
  const s = seedScene();
  save(s, false);
  return s;
}

function save(scene: SpaceScene, notify = true) {
  const next = { ...scene, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(SCENE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  if (notify) emit();
  return next;
}

export function getSpaceScene(): SpaceScene {
  return load();
}

export function setSpaceScene(scene: SpaceScene): SpaceScene {
  return save(scene);
}

// ─── 上传列表（L2） ─────────────────────────────────────────

function loadUploads(): SpaceUploadItem[] {
  try {
    const raw = localStorage.getItem(UPLOADS_KEY);
    if (raw) return JSON.parse(raw) as SpaceUploadItem[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveUploads(list: SpaceUploadItem[]) {
  try {
    localStorage.setItem(UPLOADS_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    /* ignore */
  }
  emit();
}

export function getSpaceUploads(): SpaceUploadItem[] {
  return loadUploads();
}

export function addSpaceUpload(item: Omit<SpaceUploadItem, "id" | "createdAt">): SpaceUploadItem[] {
  const row: SpaceUploadItem = {
    ...item,
    id: uid("up"),
    createdAt: new Date().toISOString(),
  };
  const next = [row, ...loadUploads()].slice(0, 20);
  saveUploads(next);
  return next;
}

export function removeSpaceUpload(id: string): SpaceUploadItem[] {
  const next = loadUploads().filter((u) => u.id !== id);
  saveUploads(next);
  return next;
}

/**
 * 应用真实识墙结果（PDF 矢量 / 图片扫描）
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
}): SpaceScene {
  const cur = load();
  const baseName = opts.name.replace(/\.(pdf|png|jpe?g|webp)$/i, "");
  const thickness =
    opts.walls[0]?.thickness ?? cur.wallThicknessMm ?? 120;
  const strictness = opts.strictness ?? cur.detectStrictness ?? 50;

  addSpaceUpload({
    name: opts.name,
    kind: opts.kind,
    previewUrl: opts.previewUrl,
    lastMethod: opts.method,
  });

  return save({
    ...cur,
    name: `${baseName} · 识墙`,
    source: opts.kind === "pdf" ? "import_pdf" : "import_plan",
    floorPlanDataUrl: opts.previewUrl,
    sourceFileName: opts.name,
    sourceKind: opts.kind,
    walls: opts.walls.map((w) => ({ ...w, thickness: w.thickness || thickness })),
    placements: [],
    widthMm: Math.max(1000, opts.widthMm),
    depthMm: Math.max(1000, opts.depthMm),
    wallHeightMm: cur.wallHeightMm || 2800,
    wallThicknessMm: thickness,
    detectMethod: opts.method,
    detectMessage: opts.message,
    detectStrictness: strictness,
  });
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
  const walls = cur.walls.map((w) => ({ ...w, thickness: wallThicknessMm }));
  return save({ ...cur, wallHeightMm, wallThicknessMm, walls });
}

export function resetToTemplate(templateId: RoomTemplateId, projectId?: string | null): SpaceScene {
  const tpl = ROOM_TEMPLATES.find((r) => r.id === templateId) ?? ROOM_TEMPLATES[0];
  const cur = load();
  const project =
    projectId !== undefined
      ? PM_PROJECTS.find((p) => p.id === projectId)
      : cur.projectId
        ? PM_PROJECTS.find((p) => p.id === cur.projectId)
        : PM_PROJECTS[0];
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
  const p = projectId ? PM_PROJECTS.find((x) => x.id === projectId) : null;
  return save({
    ...cur,
    projectId: p?.id ?? null,
    projectName: p?.name ?? null,
  });
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
  if (m === "pdf-raster-fallback") return "PDF 栅格回退";
  if (m === "ml-cubicasa") return "CubiCasa ML";
  if (m === "ml-heuristic") return "ML 后处理";
  if (m === "template") return "模板";
  return "—";
}

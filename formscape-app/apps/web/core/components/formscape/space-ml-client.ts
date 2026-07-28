/**
 * 平面识墙 ML 客户端 — YOLO 三模型融合（sanatladkat + Burrun + Architect）
 * 服务端一次低 conf 全量推理；前端拖严格度纯内存即时过滤，不重跑模型。
 * （engine=route_a 仅作 API 兼容字段，无 U-Net/Trimesh 语义）
 */
import type { F23dPlan, SpaceWall } from "./space-model-store";

export type MlDetectMethod = "ml-route-a" | "ml-unavailable";

export type MlDetectResult = {
  walls: Omit<SpaceWall, "id">[];
  widthMm: number;
  depthMm: number;
  method: MlDetectMethod;
  message: string;
  engine: string;
  meta?: Record<string, unknown>;
  f23dPlan?: F23dPlan | null;
};

export type MlHealth = {
  ok: boolean;
  engines?: { route_a?: boolean };
  /** Architect 权重（CC-BY-NC 非商用）是否启用；商用部署应设 ARCHITECT_ENABLED=0 */
  architect_enabled?: boolean;
  detail?: Record<string, unknown>;
  note?: string;
};

const DEFAULT_URL = "http://127.0.0.1:8090";

export function floorplanMlBaseUrl(): string {
  try {
    const env = (import.meta as { env?: Record<string, string> }).env;
    const u = env?.VITE_FLOORPLAN_ML_URL?.trim();
    if (u) return u.replace(/\/$/, "");
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    try {
      const ls = localStorage.getItem("fs-floorplan-ml-url");
      if (ls?.trim()) return ls.trim().replace(/\/$/, "");
    } catch {
      /* ignore */
    }
  }
  return DEFAULT_URL;
}

export function isMlPreferEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = localStorage.getItem("fs-floorplan-ml-prefer");
    if (v === null) return true;
    return v === "1" || v === "true";
  } catch {
    return true;
  }
}

export function setMlPreferEnabled(on: boolean) {
  try {
    localStorage.setItem("fs-floorplan-ml-prefer", on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function loadDetectStrictnessLocal(): number {
  if (typeof window === "undefined") return 50;
  try {
    const v = localStorage.getItem("fs-space-detect-strictness");
    if (v != null) return Math.max(0, Math.min(100, Number(v) || 50));
  } catch {
    /* ignore */
  }
  return 50;
}

export function saveDetectStrictnessLocal(v: number) {
  try {
    localStorage.setItem(
      "fs-space-detect-strictness",
      String(Math.max(0, Math.min(100, Math.round(v))))
    );
  } catch {
    /* ignore */
  }
}

// ─── 检测进度 / 取消（长任务可取消，页面显示阶段文字） ─────────────

export const SPACE_DETECT_PROGRESS_EVENT = "fs-space-detect-progress";

export type DetectProgress = {
  /** 是否有检测任务进行中 */
  active: boolean;
  /** 阶段文字（结果句，非技术词） */
  stage: string | null;
  /** 文件名（可选） */
  fileName?: string | null;
};

let detectProgress: DetectProgress = { active: false, stage: null, fileName: null };
let activeDetectCtrl: AbortController | null = null;
let activeDetectCancelled = false;

function emitDetectProgress() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SPACE_DETECT_PROGRESS_EVENT));
}

export function getDetectProgress(): DetectProgress {
  return detectProgress;
}

/** 检测任务开始（pipeline 内部调用） */
export function beginDetectTask(fileName?: string | null) {
  activeDetectCancelled = false;
  detectProgress = { active: true, stage: "准备识别…", fileName: fileName ?? null };
  emitDetectProgress();
}

/** 更新阶段文字（pipeline 内部调用） */
export function setDetectStage(stage: string) {
  if (!detectProgress.active) return;
  detectProgress = { ...detectProgress, stage };
  emitDetectProgress();
}

/** 检测任务结束（pipeline 内部调用；成功/失败/取消都要调） */
export function endDetectTask() {
  detectProgress = { active: false, stage: null, fileName: null };
  activeDetectCtrl = null;
  emitDetectProgress();
}

/** 用户点「取消」：中断当前识别请求，保留上一次结果 */
export function cancelActiveDetect() {
  activeDetectCancelled = true;
  try {
    activeDetectCtrl?.abort();
  } catch {
    /* ignore */
  }
  setDetectStage("正在取消…");
}

export function isDetectCancelled(): boolean {
  return activeDetectCancelled;
}

/** 取消产生的错误（页面据此静默处理，不当失败弹提示） */
export const DETECT_CANCELLED_MESSAGE = "已取消本次识别，保留原有结果";

export async function checkFloorplanMlHealth(timeoutMs = 3000): Promise<MlHealth | null> {
  const base = floorplanMlBaseUrl();
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/health`, { signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as MlHealth;
  } catch {
    return null;
  } finally {
    window.clearTimeout(t);
  }
}

export async function detectWallsWithMl(
  source: File | Blob | string,
  opts?: {
    strictness?: number;
    targetLongMm?: number;
    wallHeightMm?: number;
    fileName?: string;
    timeoutMs?: number;
  }
): Promise<MlDetectResult> {
  const base = floorplanMlBaseUrl();
  const strictness = opts?.strictness ?? loadDetectStrictnessLocal();
  const timeoutMs = opts?.timeoutMs ?? 180000;

  let blob: Blob;
  let name = opts?.fileName ?? "plan.png";
  if (typeof source === "string") {
    blob = await (await fetch(source)).blob();
    if (source.startsWith("data:image/jpeg")) name = "plan.jpg";
  } else if (source instanceof File) {
    blob = source;
    name = source.name || name;
  } else {
    blob = source;
  }

  const form = new FormData();
  form.append("file", blob, name);
  form.append("strictness", String(strictness));
  form.append("target_long_mm", String(opts?.targetLongMm ?? 12000));
  form.append("wall_height_mm", String(opts?.wallHeightMm ?? 2800));
  form.append("engine", "route_a");

  const ctrl = new AbortController();
  activeDetectCtrl = ctrl;
  let timedOut = false;
  const t = window.setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);
  try {
    const res = await fetch(`${base}/v1/detect`, {
      method: "POST",
      body: form,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`ML 识墙 HTTP ${res.status}: ${text.slice(0, 240)}`);
    }
    const data = (await res.json()) as {
      walls: { x1: number; y1: number; x2: number; y2: number; thickness: number }[];
      width_mm: number;
      depth_mm: number;
      method: string;
      message: string;
      engine: string;
      meta?: Record<string, unknown>;
      f23d_plan?: F23dPlan | null;
    };
    const f23dPlan =
      data.f23d_plan ?? ((data.meta?.f23d_plan as F23dPlan | undefined) ?? null);
    return {
      walls: (data.walls ?? []).map((w) => ({
        x1: w.x1,
        y1: w.y1,
        x2: w.x2,
        y2: w.y2,
        thickness: w.thickness ?? 120,
        conf:
          typeof (w as { conf?: number }).conf === "number"
            ? (w as { conf?: number }).conf
            : undefined,
      })),
      widthMm: data.width_mm,
      depthMm: data.depth_mm,
      method: "ml-route-a",
      message: data.message,
      engine: data.engine || "route_a",
      meta: data.meta,
      f23dPlan,
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      if (activeDetectCancelled && !timedOut) {
        throw new Error(DETECT_CANCELLED_MESSAGE);
      }
      throw new Error("识别超时，请重试或换一张更小的图");
    }
    throw e;
  } finally {
    window.clearTimeout(t);
    if (activeDetectCtrl === ctrl) activeDetectCtrl = null;
  }
}

/** 下载文本文件（OBJ 导出用：buildWallsObj → downloadTextFile，前端唯一导出路径） */
export function downloadTextFile(text: string, fileName: string, mime = "text/plain") {
  downloadBlob(new Blob([text], { type: mime }), fileName);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

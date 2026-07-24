/**
 * CubiCasa5k 系识墙服务客户端
 * 默认 http://127.0.0.1:8090 ，可用 VITE_FLOORPLAN_ML_URL 覆盖
 */
import type { SpaceWall } from "./space-model-store";

export type MlDetectMethod = "ml-cubicasa" | "ml-heuristic" | "ml-unavailable";

export type MlDetectResult = {
  walls: Omit<SpaceWall, "id">[];
  widthMm: number;
  depthMm: number;
  method: MlDetectMethod;
  message: string;
  backend: string;
  meta?: Record<string, unknown>;
};

export type MlHealth = {
  ok: boolean;
  backends: { heuristic?: boolean; cubicasa?: boolean };
  weights_path?: string | null;
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
    if (v === null) return true; // 默认优先尝试 ML
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

export async function checkFloorplanMlHealth(
  timeoutMs = 2500
): Promise<MlHealth | null> {
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

/**
 * 用平面图 File / Blob / dataURL 调用 ML 识墙
 */
export async function detectWallsWithMl(
  source: File | Blob | string,
  opts?: {
    strictness?: number;
    targetLongMm?: number;
    backend?: "auto" | "cubicasa" | "heuristic";
    fileName?: string;
    timeoutMs?: number;
  }
): Promise<MlDetectResult> {
  const base = floorplanMlBaseUrl();
  const strictness = opts?.strictness ?? 50;
  const backend = opts?.backend ?? "auto";
  const timeoutMs = opts?.timeoutMs ?? 60000;

  let blob: Blob;
  let name = opts?.fileName ?? "plan.png";
  if (typeof source === "string") {
    blob = await dataUrlToBlob(source);
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
  form.append("backend", backend);
  form.append("postprocess", "true");

  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/v1/detect`, {
      method: "POST",
      body: form,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`ML 识墙 HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      walls: { x1: number; y1: number; x2: number; y2: number; thickness: number }[];
      width_mm: number;
      depth_mm: number;
      method: MlDetectMethod;
      message: string;
      backend: string;
      meta?: Record<string, unknown>;
    };
    return {
      walls: (data.walls ?? []).map((w) => ({
        x1: w.x1,
        y1: w.y1,
        x2: w.x2,
        y2: w.y2,
        thickness: w.thickness ?? 120,
      })),
      widthMm: data.width_mm,
      depthMm: data.depth_mm,
      method: data.method,
      message: data.message,
      backend: data.backend,
      meta: data.meta,
    };
  } finally {
    window.clearTimeout(t);
  }
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

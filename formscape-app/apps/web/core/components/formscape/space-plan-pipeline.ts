/**
 * 建筑平面导入
 * ML: YOLO 三模型融合（一次低 conf 推理，前端拖严格度即时过滤）
 * PDF 矢量够用时仍走矢量；图片 ML 失败时本地回退
 * 检测全程发进度事件（可取消，见 space-ml-client）
 */
import { detectWallsFromImageDataUrl } from "./space-image-walls";
import {
  clampStrictness,
  pdfParamsFromStrictness,
  type DetectStrictness,
} from "./space-detect-params";
import type { F23dPlan, SpaceDetectMethod, SpaceWall } from "./space-model-store";
import {
  beginDetectTask,
  checkFloorplanMlHealth,
  DETECT_CANCELLED_MESSAGE,
  detectWallsWithMl,
  endDetectTask,
  isDetectCancelled,
  isMlPreferEnabled,
  loadDetectStrictnessLocal,
  setDetectStage,
} from "./space-ml-client";

export type PlanImportResult = {
  walls: SpaceWall[];
  widthMm: number;
  depthMm: number;
  previewUrl: string | null;
  method: SpaceDetectMethod;
  message: string;
  meta?: Record<string, unknown>;
  strictness: DetectStrictness;
  f23dPlan?: F23dPlan | null;
};

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function withIds(
  walls: { x1: number; y1: number; x2: number; y2: number; thickness: number }[]
): SpaceWall[] {
  return walls.map((w) => ({ ...w, id: uid("w") }));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = String(reader.result || "");
      if (!r) reject(new Error("读取文件为空"));
      else resolve(r);
    };
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (!reader.result) reject(new Error("读取 PDF 为空"));
      else resolve(reader.result as ArrayBuffer);
    };
    reader.onerror = () => reject(new Error("读取 PDF 失败"));
    reader.readAsArrayBuffer(file);
  });
}

let lastMlError: string | null = null;
export function getLastMlError(): string | null {
  return lastMlError;
}

async function tryMl(
  source: File | string,
  s: DetectStrictness,
  fileName: string,
  previewUrl: string | null
): Promise<PlanImportResult | null> {
  lastMlError = null;
  if (!isMlPreferEnabled()) {
    lastMlError = "已关闭增强识别优先";
    return null;
  }
  setDetectStage("连接增强识别…");
  const health = await checkFloorplanMlHealth(2500);
  if (!health?.ok) {
    lastMlError = "增强识别未开启";
    return null;
  }

  try {
    setDetectStage("识别墙、门、窗中…（大图会自动切片，可能需要几十秒）");
    const ml = await detectWallsWithMl(source, {
      strictness: s,
      fileName,
    });
    setDetectStage("整理墙体几何…");
    const polyN = ml.f23dPlan
      ? ["wall", "door", "window"].reduce(
          (n, k) => n + ((ml.f23dPlan!.polygons as Record<string, unknown[]>)[k]?.length ?? 0),
          0
        )
      : 0;
    if (!ml.walls.length && !polyN) {
      lastMlError = "未识别到墙体，可以换一张更清晰的图试试";
      return null;
    }
    let preview = previewUrl;
    if (!preview && ml.f23dPlan?.preview_full_b64) {
      preview = `data:image/png;base64,${ml.f23dPlan.preview_full_b64}`;
    }
    return {
      walls: withIds(ml.walls),
      widthMm: ml.widthMm,
      depthMm: ml.depthMm,
      previewUrl: preview,
      method: "ml-route-a",
      strictness: s,
      message: ml.message,
      meta: { ...ml.meta, engine: "route_a" },
      f23dPlan: ml.f23dPlan ?? null,
    };
  } catch (e) {
    // 用户主动取消：直接向上抛，不落入本地兜底（避免覆盖已有结果）
    if (isDetectCancelled() || (e instanceof Error && e.message === DETECT_CANCELLED_MESSAGE)) {
      throw new Error(DETECT_CANCELLED_MESSAGE);
    }
    lastMlError = e instanceof Error ? e.message : String(e);
    console.warn("[space] ML failed", e);
    return null;
  }
}

export async function importArchitecturalPlan(
  file: File,
  strictness?: DetectStrictness
): Promise<PlanImportResult> {
  const s = clampStrictness(
    strictness ?? (typeof window !== "undefined" ? loadDetectStrictnessLocal() : 50)
  );
  const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
  const isImage =
    /^image\//.test(file.type) || /\.(png|jpe?g|webp|gif|bmp|tif{1,2})$/i.test(file.name);

  if (!isPdf && !isImage) {
    throw new Error("请上传 PNG/JPG 平面图，或建筑平面 PDF");
  }

  beginDetectTask(file.name);
  try {
    if (!isPdf) {
      setDetectStage("读取图片…");
      const dataUrl = await readFileAsDataUrl(file);
      const ml = await tryMl(file, s, file.name, dataUrl);
      if (ml) return ml;
      setDetectStage("识别服务不可用，改用本地快速识墙…");
      const img = await detectWallsFromImageDataUrl(dataUrl, { strictness: s });
      const mlHint = lastMlError ? `（${lastMlError}）` : "";
      if (!img.walls.length) {
        throw new Error(`没识别出墙体${mlHint}。可启动识别服务后重试，或换一张更清晰的平面图`);
      }
      return {
        walls: withIds(img.walls),
        widthMm: img.widthMm,
        depthMm: img.depthMm,
        previewUrl: dataUrl,
        method: "image-scan",
        strictness: s,
        message: `本地识墙 ${img.walls.length} 段${mlHint}`,
        meta: img.debug,
      };
    }

    setDetectStage("读取 PDF…");
    const buf = await readFileAsArrayBuffer(file);
    const pdfP = pdfParamsFromStrictness(s);

    // 矢量 PDF：优先矢量抽取
    try {
      const { extractPdfVectorLines, pdfVectorsToWalls } = await import("./space-pdf-vector");
      const vec = await extractPdfVectorLines(buf, 0);
      const converted = pdfVectorsToWalls(vec, {
        minStrokePt: pdfP.minStrokePt,
        minLenPt: pdfP.minLenPt,
        strokePercentile: pdfP.strokePercentile,
      });
      if (converted.kept >= pdfP.minKeptToAcceptVector) {
        return {
          walls: withIds(converted.walls),
          widthMm: converted.widthMm,
          depthMm: converted.depthMm,
          previewUrl: null,
          method: "pdf-vector",
          strictness: s,
          message: `PDF 矢量 → ${converted.kept} 段墙`,
          meta: { kept: converted.kept, raw: vec.rawSegmentCount },
        };
      }
    } catch {
      /* raster */
    }

    setDetectStage("PDF 转图片…");
    const previewUrl = await rasterizePdfPage(buf, 0);
    const ml = await tryMl(previewUrl, s, file.name, previewUrl);
    if (ml) return { ...ml, message: `PDF 栅格 · ${ml.message}` };

    setDetectStage("识别服务不可用，改用本地快速识墙…");
    const img = await detectWallsFromImageDataUrl(previewUrl, { strictness: s });
    return {
      walls: withIds(img.walls),
      widthMm: img.widthMm,
      depthMm: img.depthMm,
      previewUrl,
      method: "pdf-raster-fallback",
      strictness: s,
      message: `PDF 栅格本地识墙 → ${img.walls.length} 段`,
      meta: img.debug,
    };
  } finally {
    endDetectTask();
  }
}

async function rasterizePdfPage(data: ArrayBuffer, pageIndex = 0): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  try {
    const workerMod = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    const src = typeof workerMod === "string" ? workerMod : (workerMod as { default: string }).default;
    if (src) pdfjs.GlobalWorkerOptions.workerSrc = src;
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = "";
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");
  await page.render({
    canvasContext: ctx,
    viewport,
  } as Parameters<typeof page.render>[0]).promise;
  return canvas.toDataURL("image/png");
}

export async function reimportFromPreview(
  previewUrl: string | null,
  kind: "image" | "pdf",
  fileName: string,
  strictness: DetectStrictness = 50
): Promise<PlanImportResult> {
  const s = clampStrictness(strictness);
  if (!previewUrl) {
    throw new Error("无预览底图，请重新上传");
  }
  beginDetectTask(fileName);
  try {
    const ml = await tryMl(previewUrl, s, fileName, previewUrl);
    if (ml) return { ...ml, message: `重识 · ${ml.message}` };

    setDetectStage("识别服务不可用，改用本地快速识墙…");
    const img = await detectWallsFromImageDataUrl(previewUrl, { strictness: s });
    return {
      walls: withIds(img.walls),
      widthMm: img.widthMm,
      depthMm: img.depthMm,
      previewUrl,
      method: kind === "pdf" ? "pdf-raster-fallback" : "image-scan",
      strictness: s,
      message: `重识本地 → ${img.walls.length} 段`,
      meta: img.debug,
    };
  } finally {
    endDetectTask();
  }
}

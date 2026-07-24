/**
 * 建筑平面导入统一入口
 * - 图片：优先 CubiCasa 系 ML 服务 → 失败回退浏览器位图识墙
 * - PDF：矢量优先；矢量过少才栅格；栅格同样可走 ML
 */
import { detectWallsFromImageDataUrl } from "./space-image-walls";
import {
  clampStrictness,
  pdfParamsFromStrictness,
  type DetectStrictness,
} from "./space-detect-params";
import type { SpaceDetectMethod, SpaceWall } from "./space-model-store";
import {
  checkFloorplanMlHealth,
  detectWallsWithMl,
  isMlPreferEnabled,
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

/** 尝试 ML；服务不可用或失败返回 null */
async function tryMlOnImage(
  source: File | string,
  s: DetectStrictness,
  fileName: string,
  previewUrl: string | null
): Promise<PlanImportResult | null> {
  if (!isMlPreferEnabled()) return null;
  const health = await checkFloorplanMlHealth(2000);
  if (!health?.ok) return null;
  try {
    const ml = await detectWallsWithMl(source, {
      strictness: s,
      backend: "auto",
      fileName,
    });
    if (!ml.walls.length) return null;
    const method: SpaceDetectMethod =
      ml.method === "ml-cubicasa" ? "ml-cubicasa" : "ml-heuristic";
    return {
      walls: withIds(ml.walls),
      widthMm: ml.widthMm,
      depthMm: ml.depthMm,
      previewUrl,
      method,
      strictness: s,
      message: ml.message,
      meta: { ...ml.meta, backend: ml.backend, health },
    };
  } catch (e) {
    console.warn("[space] ML detect failed, fallback local", e);
    return null;
  }
}

export async function importArchitecturalPlan(
  file: File,
  strictness: DetectStrictness = 50
): Promise<PlanImportResult> {
  const s = clampStrictness(strictness);
  const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
  const isImage =
    /^image\//.test(file.type) || /\.(png|jpe?g|webp|gif|bmp|tif{1,2})$/i.test(file.name);

  if (!isPdf && !isImage) {
    throw new Error("请上传 PNG/JPG 平面图，或建筑平面 PDF");
  }

  if (!isPdf) {
    const dataUrl = await readFileAsDataUrl(file);
    const ml = await tryMlOnImage(file, s, file.name, dataUrl);
    if (ml) return ml;

    const img = await detectWallsFromImageDataUrl(dataUrl, { strictness: s });
    const n = img.walls.length;
    return {
      walls: withIds(img.walls),
      widthMm: img.widthMm,
      depthMm: img.depthMm,
      previewUrl: dataUrl,
      method: "image-scan",
      strictness: s,
      message: img.debug?.usedFallback
        ? `图片识墙（严格度 ${s}）：外轮廓兜底 ${n} 段，可调低严格度后重识`
        : `图片识墙成功（严格度 ${s}）：${n} 面墙 · ML 服务未用（未启动或已关闭）`,
      meta: img.debug,
    };
  }

  const buf = await readFileAsArrayBuffer(file);
  const pdfP = pdfParamsFromStrictness(s);

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
        message: `PDF 矢量（严格度 ${s}）：原始 ${vec.rawSegmentCount} 段 → 墙 ${converted.kept}（constructPath×${vec.stats.constructPathOps}）`,
        meta: {
          rawSegmentCount: vec.rawSegmentCount,
          kept: converted.kept,
          dropped: converted.dropped,
          stats: vec.stats,
        },
      };
    }

    if (vec.rawSegmentCount >= 8 && converted.kept < pdfP.minKeptToAcceptVector) {
      const loose = pdfVectorsToWalls(vec, {
        minStrokePt: 0.05,
        minLenPt: 2,
        strokePercentile: 0.2,
      });
      if (loose.kept >= 4) {
        return {
          walls: withIds(loose.walls),
          widthMm: loose.widthMm,
          depthMm: loose.depthMm,
          previewUrl: null,
          method: "pdf-vector",
          strictness: s,
          message: `PDF 矢量（自动放宽过滤）：${vec.rawSegmentCount} → ${loose.kept} 面墙`,
          meta: { rawSegmentCount: vec.rawSegmentCount, kept: loose.kept, stats: vec.stats },
        };
      }
    }

    const previewUrl = await rasterizePdfPage(buf, 0);
    const ml = await tryMlOnImage(previewUrl, s, file.name, previewUrl);
    if (ml) {
      return {
        ...ml,
        message: `PDF 矢量不足 → ${ml.message}`,
      };
    }
    const img = await detectWallsFromImageDataUrl(previewUrl, { strictness: s });
    return {
      walls: withIds(img.walls),
      widthMm: img.widthMm,
      depthMm: img.depthMm,
      previewUrl,
      method: "pdf-raster-fallback",
      strictness: s,
      message: `PDF 矢量不足（原始 ${vec.rawSegmentCount} 段 / constructPath×${vec.stats.constructPathOps}），栅格识墙 → ${img.walls.length} 面墙`,
      meta: { rawSegmentCount: vec.rawSegmentCount, stats: vec.stats, ...img.debug },
    };
  } catch (e) {
    try {
      const previewUrl = await rasterizePdfPage(buf, 0);
      const ml = await tryMlOnImage(previewUrl, s, file.name, previewUrl);
      if (ml) return ml;
      const img = await detectWallsFromImageDataUrl(previewUrl, { strictness: s });
      return {
        walls: withIds(img.walls),
        widthMm: img.widthMm,
        depthMm: img.depthMm,
        previewUrl,
        method: "pdf-raster-fallback",
        strictness: s,
        message: `PDF 矢量失败，栅格识墙（严格度 ${s}）→ ${img.walls.length} 面墙`,
        meta: img.debug,
      };
    } catch (e2) {
      throw new Error(
        `PDF 识墙失败：${e2 instanceof Error ? e2.message : String(e2)} / ${e instanceof Error ? e.message : String(e)}`
      );
    }
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

/** 用当前底图 + 严格度重识（图片 / 栅格 PDF） */
export async function reimportFromPreview(
  previewUrl: string | null,
  kind: "image" | "pdf",
  fileName: string,
  strictness: DetectStrictness = 50
): Promise<PlanImportResult> {
  const s = clampStrictness(strictness);
  if (!previewUrl) {
    throw new Error(
      kind === "pdf"
        ? "该 PDF 为矢量结果、无预览图，请重新上传 PDF 并调节严格度"
        : "无预览数据，请重新上传"
    );
  }

  const ml = await tryMlOnImage(previewUrl, s, fileName, previewUrl);
  if (ml) {
    return {
      ...ml,
      message: `重识「${fileName}」· ${ml.message}`,
    };
  }

  const img = await detectWallsFromImageDataUrl(previewUrl, { strictness: s });
  return {
    walls: withIds(img.walls),
    widthMm: img.widthMm,
    depthMm: img.depthMm,
    previewUrl,
    method: kind === "pdf" ? "pdf-raster-fallback" : "image-scan",
    strictness: s,
    message: `重识「${fileName}」（严格度 ${s}）→ ${img.walls.length} 面墙`,
    meta: img.debug,
  };
}

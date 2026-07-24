/**
 * 平面图位图 → 墙段（图片主路径 + PDF 栅格回退）
 * 多阈值 + 轴对齐厚线扫描，纯 canvas
 * 严格度 0–100 用户可调
 */
import {
  clampStrictness,
  imageParamsFromStrictness,
  type DetectStrictness,
} from "./space-detect-params";

export type ImageWallResult = {
  walls: { x1: number; y1: number; x2: number; y2: number; thickness: number }[];
  widthMm: number;
  depthMm: number;
  method: "image-scan";
  debug?: {
    darkRatio: number;
    lineCount: number;
    mean: number;
    thr: number;
    invert: boolean;
    widthPx: number;
    heightPx: number;
    strictness: number;
    usedFallback: boolean;
  };
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // dataURL 不需要 crossOrigin；乱设可能导致 taint
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败，请换 PNG/JPG 再试"));
    img.src = src;
  });
}

/** 从 dataURL / blob URL 识墙 */
export async function detectWallsFromImageDataUrl(
  dataUrl: string,
  opts?: { targetLongMm?: number; maxSide?: number; strictness?: DetectStrictness }
): Promise<ImageWallResult> {
  if (!dataUrl || dataUrl.length < 32) {
    throw new Error("图片数据为空");
  }
  const targetLongMm = opts?.targetLongMm ?? 12000;
  const maxSide = opts?.maxSide ?? 1600;
  const strictness = clampStrictness(opts?.strictness ?? 50);
  const img = await loadImage(dataUrl);

  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error("无法读取图片尺寸");

  const scaleDown = Math.min(1, maxSide / Math.max(w, h));
  w = Math.max(1, Math.round(w * scaleDown));
  h = Math.max(1, Math.round(h * scaleDown));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 不可用");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(0, 0, w, h);
  } catch {
    throw new Error("无法读取像素（跨域图片被浏览器拦截）");
  }

  return detectWallsFromRgba(imageData.data, w, h, targetLongMm, strictness);
}

/** 纯算法：RGBA → 墙（便于自测） */
export function detectWallsFromRgba(
  data: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  targetLongMm = 12000,
  strictness: DetectStrictness = 50
): ImageWallResult {
  const params = imageParamsFromStrictness(strictness);
  const n = w * h;
  const gray = new Float32Array(n);
  let sum = 0;
  let minG = 255;
  let maxG = 0;
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[p] = g;
    sum += g;
    if (g < minG) minG = g;
    if (g > maxG) maxG = g;
  }
  const mean = sum / n;
  const invert = mean < 118; // 深色底

  // Otsu 近似：分 64 桶
  const bins = new Array(64).fill(0);
  for (let p = 0; p < n; p++) {
    const b = Math.min(63, (gray[p] / 256) * 64 | 0);
    bins[b]++;
  }
  let otsu = mean;
  {
    let wB = 0;
    let sumB = 0;
    const total = n;
    let sumAll = 0;
    for (let i = 0; i < 64; i++) sumAll += i * bins[i];
    let best = -1;
    for (let t = 0; t < 63; t++) {
      wB += bins[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * bins[t];
      const mB = sumB / wB;
      const mF = (sumAll - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) {
        best = between;
        otsu = ((t + 0.5) / 64) * 256;
      }
    }
  }

  const bias = params.meanBias;
  const thrInk = invert
    ? Math.min(255, Math.max(otsu, mean + bias * 0.5))
    : Math.max(0, Math.min(otsu, mean - bias * 0.7));

  const tryThresholds = invert
    ? [thrInk, mean + bias * 0.35, mean + bias * 0.9, (mean + maxG) / 2]
    : [thrInk, mean - bias * 0.4, mean - bias * 0.9, mean - bias * 1.3, (mean + minG) / 2];

  let bestSegs: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    lenPx: number;
    thicknessPx: number;
  }[] = [];
  let bestThr = thrInk;
  let bestDark = 0;

  const scanOpts = {
    minLenRatio: params.minLenRatio,
    minLenPxAbs: params.minLenPxAbs,
    thickMin: params.thickMin,
    thickMax: params.thickMax,
  };

  for (const thr of tryThresholds) {
    const wall = new Uint8Array(n);
    let dark = 0;
    for (let p = 0; p < n; p++) {
      const isWall = invert ? gray[p] > thr : gray[p] < thr;
      if (isWall) {
        wall[p] = 1;
        dark++;
      }
    }
    const ratio = dark / n;
    if (ratio < params.ratioMin || ratio > params.ratioMax) continue;

    dilate(wall, w, h, 1);
    dilate(wall, w, h, 1);

    const segs = [
      ...scanAxisAligned(wall, w, h, true, scanOpts),
      ...scanAxisAligned(wall, w, h, false, scanOpts),
    ];
    if (segs.length > bestSegs.length) {
      bestSegs = segs;
      bestThr = thr;
      bestDark = dark;
    }
  }

  if (bestSegs.length < 4) {
    const edge = gradientEdges(gray, w, h, params.edgeMul);
    dilate(edge, w, h, 1);
    const segs = [
      ...scanAxisAligned(edge, w, h, true, scanOpts),
      ...scanAxisAligned(edge, w, h, false, scanOpts),
    ];
    if (segs.length > bestSegs.length) {
      bestSegs = segs;
      bestDark = segs.length;
    }
  }

  const long = Math.max(w, h);
  const pxToMm = targetLongMm / long;
  const widthMm = Math.round(w * pxToMm);
  const depthMm = Math.round(h * pxToMm);

  const minLen = Math.max(params.minLenPxAbs, Math.min(w, h) * params.minLenRatio);
  let segs = bestSegs.filter((s) => s.lenPx >= minLen);

  segs = [
    ...mergeRuns(
      segs.filter((s) => Math.abs(s.y2 - s.y1) <= Math.abs(s.x2 - s.x1)),
      true
    ),
    ...mergeRuns(
      segs.filter((s) => Math.abs(s.y2 - s.y1) > Math.abs(s.x2 - s.x1)),
      false
    ),
  ];

  const avgThickPx =
    segs.reduce((s, g) => s + g.thicknessPx, 0) / Math.max(1, segs.length) || 4;
  const thickness = Math.max(80, Math.min(280, Math.round(avgThickPx * pxToMm)));

  let walls = segs.map((s) => ({
    x1: Math.round(s.x1 * pxToMm),
    y1: Math.round(s.y1 * pxToMm),
    x2: Math.round(s.x2 * pxToMm),
    y2: Math.round(s.y2 * pxToMm),
    thickness,
  }));

  let usedFallback = false;
  if (walls.length < 3 && params.allowOuterFallback) {
    usedFallback = true;
    const pad = Math.round(Math.min(widthMm, depthMm) * 0.05);
    const t = Math.max(100, thickness);
    walls = [
      { x1: pad, y1: pad, x2: widthMm - pad, y2: pad, thickness: t },
      { x1: widthMm - pad, y1: pad, x2: widthMm - pad, y2: depthMm - pad, thickness: t },
      { x1: widthMm - pad, y1: depthMm - pad, x2: pad, y2: depthMm - pad, thickness: t },
      { x1: pad, y1: depthMm - pad, x2: pad, y2: pad, thickness: t },
    ];
  }

  return {
    walls,
    widthMm,
    depthMm,
    method: "image-scan",
    debug: {
      darkRatio: bestDark / n,
      lineCount: walls.length,
      mean,
      thr: bestThr,
      invert,
      widthPx: w,
      heightPx: h,
      strictness: clampStrictness(strictness),
      usedFallback,
    },
  };
}

function gradientEdges(gray: Float32Array, w: number, h: number, edgeMul: number): Uint8Array {
  const out = new Uint8Array(w * h);
  let sum = 0;
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = gray[i + 1] - gray[i - 1];
      const gy = gray[i + w] - gray[i - w];
      const m = Math.hypot(gx, gy);
      mag[i] = m;
      sum += m;
    }
  }
  const thr = (sum / (w * h)) * edgeMul + 12;
  for (let i = 0; i < mag.length; i++) {
    out[i] = mag[i] > thr ? 1 : 0;
  }
  return out;
}

function dilate(bin: Uint8Array, w: number, h: number, r: number) {
  const copy = bin.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (copy[y * w + x]) continue;
      let hit = false;
      for (let dy = -r; dy <= r && !hit; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (copy[ny * w + nx]) {
            hit = true;
            break;
          }
        }
      }
      if (hit) bin[y * w + x] = 1;
    }
  }
}

function scanAxisAligned(
  wall: Uint8Array,
  w: number,
  h: number,
  horizontal: boolean,
  opts: { minLenRatio: number; minLenPxAbs: number; thickMin: number; thickMax: number }
): { x1: number; y1: number; x2: number; y2: number; lenPx: number; thicknessPx: number }[] {
  const out: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    lenPx: number;
    thicknessPx: number;
  }[] = [];
  const primary = horizontal ? h : w;
  const secondary = horizontal ? w : h;
  const minLen = Math.max(opts.minLenPxAbs, Math.min(w, h) * opts.minLenRatio);

  for (let p = 0; p < primary; p++) {
    let runStart = -1;
    for (let s = 0; s <= secondary; s++) {
      const on =
        s < secondary && (horizontal ? wall[p * w + s] : wall[s * w + p]);
      if (on && runStart < 0) runStart = s;
      if ((!on || s === secondary) && runStart >= 0) {
        const runEnd = s - 1;
        const len = runEnd - runStart + 1;
        if (len >= minLen) {
          const mid = (runStart + runEnd) >> 1;
          let thick = 1;
          for (let t = 1; t < 48; t++) {
            let ok = false;
            if (horizontal) {
              const y0 = p - t;
              const y1 = p + t;
              if (y0 >= 0 && wall[y0 * w + mid]) ok = true;
              if (y1 < h && wall[y1 * w + mid]) ok = true;
            } else {
              const x0 = p - t;
              const x1 = p + t;
              if (x0 >= 0 && wall[mid * w + x0]) ok = true;
              if (x1 < w && wall[mid * w + x1]) ok = true;
            }
            if (ok) thick = t * 2 + 1;
            else break;
          }
          if (thick >= opts.thickMin && thick <= opts.thickMax) {
            if (horizontal) {
              out.push({
                x1: runStart,
                y1: p,
                x2: runEnd,
                y2: p,
                lenPx: len,
                thicknessPx: Math.max(2, thick),
              });
            } else {
              out.push({
                x1: p,
                y1: runStart,
                x2: p,
                y2: runEnd,
                lenPx: len,
                thicknessPx: Math.max(2, thick),
              });
            }
          }
        }
        runStart = -1;
      }
    }
  }
  return mergeRuns(out, horizontal);
}

function mergeRuns(
  segs: { x1: number; y1: number; x2: number; y2: number; lenPx: number; thicknessPx: number }[],
  horizontal: boolean
) {
  if (segs.length === 0) return segs;
  const sorted = [...segs].sort((a, b) =>
    horizontal ? a.y1 - b.y1 || a.x1 - b.x1 : a.x1 - b.x1 || a.y1 - b.y1
  );
  const out: typeof segs = [];
  let cur = { ...sorted[0] };
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i];
    if (horizontal) {
      if (Math.abs(s.y1 - cur.y1) <= 4 && s.x1 <= cur.x2 + 14) {
        cur.x2 = Math.max(cur.x2, s.x2);
        cur.lenPx = cur.x2 - cur.x1;
        cur.thicknessPx = Math.max(cur.thicknessPx, s.thicknessPx);
        continue;
      }
    } else {
      if (Math.abs(s.x1 - cur.x1) <= 4 && s.y1 <= cur.y2 + 14) {
        cur.y2 = Math.max(cur.y2, s.y2);
        cur.lenPx = cur.y2 - cur.y1;
        cur.thicknessPx = Math.max(cur.thicknessPx, s.thicknessPx);
        continue;
      }
    }
    out.push(cur);
    cur = { ...s };
  }
  out.push(cur);
  return out;
}

/**
 * 建筑平面 PDF → 直接抽取矢量线段（不栅格化）
 *
 * 关键：CAD 导出 PDF 在 pdf.js 里大量走 OPS.constructPath，
 * 旧解析只认 moveTo/lineTo 会得到 0 段 → 误判「识别失败」。
 */
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export type PdfVecLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth: number;
};

export type PdfVectorResult = {
  lines: PdfVecLine[];
  pageWidth: number;
  pageHeight: number;
  pageCount: number;
  rawSegmentCount: number;
  method: "pdf-vector";
  /** 调试：constructPath 次数等 */
  stats: {
    constructPathOps: number;
    legacyPathOps: number;
    strokeOps: number;
  };
};

type Mat = [number, number, number, number, number, number];
type PathItem = { op: "M" | "L" | "C" | "Z"; pts: number[] };

const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

function mul(m1: Mat, m2: Mat): Mat {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

function apply(m: Mat, x: number, y: number): [number, number] {
  const [a, b, c, d, e, f] = m;
  return [a * x + c * y + e, b * x + d * y + f];
}

function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** 把 constructPath 的 ops/args 展开成 path items */
function constructPathToItems(ops: number[], args: number[], OPS: typeof pdfjs.OPS): PathItem[] {
  const path: PathItem[] = [];
  let j = 0;
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i] | 0;
    switch (op) {
      case OPS.moveTo:
        path.push({ op: "M", pts: [args[j++], args[j++]] });
        break;
      case OPS.lineTo:
        path.push({ op: "L", pts: [args[j++], args[j++]] });
        break;
      case OPS.curveTo:
        path.push({
          op: "C",
          pts: [args[j], args[j + 1], args[j + 2], args[j + 3], args[j + 4], args[j + 5]],
        });
        j += 6;
        break;
      case OPS.curveTo2:
        // 当前点作第一控制点：用 pts 约定 [x2,y2,x3,y3] 并在 flush 时处理 — 简化为 lineTo 终点
        path.push({ op: "L", pts: [args[j + 2], args[j + 3]] });
        j += 4;
        break;
      case OPS.curveTo3:
        path.push({
          op: "C",
          pts: [args[j], args[j + 1], args[j + 2], args[j + 3], args[j + 2], args[j + 3]],
        });
        j += 4;
        break;
      case OPS.rectangle: {
        const x = args[j++];
        const y = args[j++];
        const w = args[j++];
        const h = args[j++];
        path.push({ op: "M", pts: [x, y] });
        path.push({ op: "L", pts: [x + w, y] });
        path.push({ op: "L", pts: [x + w, y + h] });
        path.push({ op: "L", pts: [x, y + h] });
        path.push({ op: "Z", pts: [] });
        break;
      }
      case OPS.closePath:
        path.push({ op: "Z", pts: [] });
        break;
      default:
        break;
    }
  }
  return path;
}

function flushPath(
  path: PathItem[],
  ctm: Mat,
  pageHeight: number,
  lineWidth: number,
  segments: PdfVecLine[]
) {
  if (path.length === 0) return;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const w = Math.max(0.05, lineWidth);

  const emit = (x1: number, y1: number, x2: number, y2: number) => {
    const [X1, Y1] = apply(ctm, x1, y1);
    const [X2, Y2] = apply(ctm, x2, y2);
    const y1t = pageHeight - Y1;
    const y2t = pageHeight - Y2;
    if (dist(X1, y1t, X2, y2t) < 0.2) return;
    segments.push({ x1: X1, y1: y1t, x2: X2, y2: y2t, strokeWidth: w });
  };

  for (const item of path) {
    if (item.op === "M") {
      cx = item.pts[0];
      cy = item.pts[1];
      sx = cx;
      sy = cy;
    } else if (item.op === "L") {
      const nx = item.pts[0];
      const ny = item.pts[1];
      emit(cx, cy, nx, ny);
      cx = nx;
      cy = ny;
    } else if (item.op === "C") {
      const [x1, y1, x2, y2, x3, y3] = item.pts;
      const steps = 6;
      let px = cx;
      let py = cy;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        const bx = u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
        const by = u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
        emit(px, py, bx, by);
        px = bx;
        py = by;
      }
      cx = x3;
      cy = y3;
    } else if (item.op === "Z") {
      emit(cx, cy, sx, sy);
      cx = sx;
      cy = sy;
    }
  }
}

/**
 * 从 PDF 第 pageIndex 页抽取描边/填充轮廓矢量线段
 */
export async function extractPdfVectorLines(
  data: ArrayBuffer,
  pageIndex = 0
): Promise<PdfVectorResult> {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;
  const pageCount = doc.numPages;
  const page = await doc.getPage(Math.min(pageIndex + 1, pageCount));
  const viewport = page.getViewport({ scale: 1 });
  const pageWidth = viewport.width;
  const pageHeight = viewport.height;

  const opList = await page.getOperatorList();
  const { fnArray, argsArray } = opList;
  const OPS = pdfjs.OPS;

  const ctmStack: Mat[] = [IDENTITY];
  let lineWidth = 1;
  let path: PathItem[] = [];
  const segments: PdfVecLine[] = [];
  let constructPathOps = 0;
  let legacyPathOps = 0;
  let strokeOps = 0;

  const currentCtm = () => ctmStack[ctmStack.length - 1] ?? IDENTITY;

  const doFlush = () => {
    flushPath(path, currentCtm(), pageHeight, lineWidth, segments);
    path = [];
  };

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i] as unknown[];

    switch (fn) {
      case OPS.save:
        ctmStack.push(currentCtm());
        break;
      case OPS.restore:
        if (ctmStack.length > 1) ctmStack.pop();
        break;
      case OPS.transform: {
        const [a, b, c, d, e, f] = args as number[];
        ctmStack[ctmStack.length - 1] = mul(currentCtm(), [a, b, c, d, e, f]);
        break;
      }
      case OPS.setLineWidth:
        lineWidth = Number(args[0]) || 1;
        break;

      // ── pdf.js 现代路径：几乎所有 CAD 图都走这里 ──
      case OPS.constructPath: {
        constructPathOps++;
        // args: [ops: number[], pathArgs: number[], minMax?]
        const ops = (args[0] as number[]) || [];
        const pathArgs = (args[1] as number[]) || [];
        path = path.concat(constructPathToItems(ops, pathArgs, OPS));
        break;
      }

      // ── 旧式分散算子（仍兼容） ──
      case OPS.moveTo:
        legacyPathOps++;
        path.push({ op: "M", pts: [Number(args[0]), Number(args[1])] });
        break;
      case OPS.lineTo:
        legacyPathOps++;
        path.push({ op: "L", pts: [Number(args[0]), Number(args[1])] });
        break;
      case OPS.curveTo:
        legacyPathOps++;
        path.push({ op: "C", pts: (args as number[]).slice(0, 6).map(Number) });
        break;
      case OPS.curveTo2: {
        legacyPathOps++;
        const [x2, y2, x3, y3] = (args as number[]).map(Number);
        path.push({ op: "L", pts: [x3, y3] });
        void x2;
        void y2;
        break;
      }
      case OPS.curveTo3: {
        legacyPathOps++;
        const [x1, y1, x3, y3] = (args as number[]).map(Number);
        path.push({ op: "C", pts: [x1, y1, x3, y3, x3, y3] });
        break;
      }
      case OPS.rectangle: {
        legacyPathOps++;
        const [x, y, w, h] = (args as number[]).map(Number);
        path.push({ op: "M", pts: [x, y] });
        path.push({ op: "L", pts: [x + w, y] });
        path.push({ op: "L", pts: [x + w, y + h] });
        path.push({ op: "L", pts: [x, y + h] });
        path.push({ op: "Z", pts: [] });
        break;
      }
      case OPS.closePath:
        path.push({ op: "Z", pts: [] });
        break;

      case OPS.stroke:
      case OPS.closeStroke:
      case OPS.fillStroke:
      case OPS.eoFillStroke:
      case OPS.closeFillStroke:
      case OPS.closeEOFillStroke:
        strokeOps++;
        if (
          fn === OPS.closeStroke ||
          fn === OPS.closeFillStroke ||
          fn === OPS.closeEOFillStroke
        ) {
          path.push({ op: "Z", pts: [] });
        }
        doFlush();
        break;
      case OPS.fill:
      case OPS.eoFill:
        // 填充路径轮廓也收（墙常以填充矩形出现）
        strokeOps++;
        doFlush();
        break;
      case OPS.endPath:
        path = [];
        break;
      default:
        break;
    }
  }

  // 未 stroke 的残留路径也尝试收（部分导出不规范）
  if (path.length) doFlush();

  return {
    lines: segments,
    pageWidth,
    pageHeight,
    pageCount,
    rawSegmentCount: segments.length,
    method: "pdf-vector",
    stats: { constructPathOps, legacyPathOps, strokeOps },
  };
}

/**
 * 矢量线段 → 墙段（mm）
 */
export function pdfVectorsToWalls(
  result: PdfVectorResult,
  opts?: {
    targetLongMm?: number;
    minStrokePt?: number;
    minLenPt?: number;
    strokePercentile?: number;
  }
): {
  walls: { x1: number; y1: number; x2: number; y2: number; thickness: number }[];
  widthMm: number;
  depthMm: number;
  scale: number;
  kept: number;
  dropped: number;
} {
  const targetLongMm = opts?.targetLongMm ?? 12000;
  const minStroke = opts?.minStrokePt ?? 0.15;
  const minLen = opts?.minLenPt ?? 4;
  const strokePercentile = opts?.strokePercentile ?? 0.45;

  if (!result.lines.length) {
    return {
      walls: [],
      widthMm: Math.round(targetLongMm),
      depthMm: Math.round(targetLongMm * 0.75),
      scale: 1,
      kept: 0,
      dropped: 0,
    };
  }

  const strokes = result.lines.map((l) => l.strokeWidth).sort((a, b) => a - b);
  const pCut = strokes[Math.floor(strokes.length * strokePercentile)] ?? 1;
  const strokeCut = Math.max(minStroke, pCut * 0.7);

  let candidates = result.lines.filter(
    (l) => l.strokeWidth >= strokeCut && dist(l.x1, l.y1, l.x2, l.y2) >= minLen
  );

  // 过严则逐步放宽
  if (candidates.length < 6) {
    candidates = result.lines.filter(
      (l) => l.strokeWidth >= minStroke * 0.5 && dist(l.x1, l.y1, l.x2, l.y2) >= minLen * 0.4
    );
  }
  if (candidates.length < 4) {
    candidates = result.lines.filter((l) => dist(l.x1, l.y1, l.x2, l.y2) >= minLen * 0.25);
  }

  const snapped = candidates.map((l) => {
    let { x1, y1, x2, y2, strokeWidth } = l;
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    if (dx > dy && dy / (dx || 1) < 0.1) {
      const y = (y1 + y2) / 2;
      y1 = y2 = y;
    } else if (dy > dx && dx / (dy || 1) < 0.1) {
      const x = (x1 + x2) / 2;
      x1 = x2 = x;
    }
    return { x1, y1, x2, y2, strokeWidth };
  });

  const merged = mergeCollinear(snapped, 6, 10);

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const l of merged) {
    minX = Math.min(minX, l.x1, l.x2);
    minY = Math.min(minY, l.y1, l.y2);
    maxX = Math.max(maxX, l.x1, l.x2);
    maxY = Math.max(maxY, l.y1, l.y2);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = result.pageWidth;
    maxY = result.pageHeight;
  }

  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const long = Math.max(spanX, spanY);
  const scale = targetLongMm / long;
  const widthMm = Math.round(spanX * scale);
  const depthMm = Math.round(spanY * scale);

  const avgStroke =
    merged.reduce((s, l) => s + l.strokeWidth, 0) / Math.max(1, merged.length);
  const thickness = Math.max(80, Math.min(300, Math.round(avgStroke * scale * 0.35 || 120)));

  const walls = merged.map((l) => ({
    x1: Math.round((l.x1 - minX) * scale),
    y1: Math.round((l.y1 - minY) * scale),
    x2: Math.round((l.x2 - minX) * scale),
    y2: Math.round((l.y2 - minY) * scale),
    thickness,
  }));

  return {
    walls,
    widthMm,
    depthMm,
    scale,
    kept: walls.length,
    dropped: result.rawSegmentCount - walls.length,
  };
}

function mergeCollinear(
  lines: { x1: number; y1: number; x2: number; y2: number; strokeWidth: number }[],
  gap: number,
  alignTol: number
) {
  type L = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    strokeWidth: number;
    horiz: boolean;
  };
  const items: L[] = lines.map((l) => {
    const horiz = Math.abs(l.y2 - l.y1) <= Math.abs(l.x2 - l.x1);
    let { x1, y1, x2, y2 } = l;
    if (horiz && x1 > x2) [x1, y1, x2, y2] = [x2, y2, x1, y1];
    if (!horiz && y1 > y2) [x1, y1, x2, y2] = [x2, y2, x1, y1];
    return { x1, y1, x2, y2, strokeWidth: l.strokeWidth, horiz };
  });

  const used = new Set<number>();
  const out: typeof lines = [];

  for (let i = 0; i < items.length; i++) {
    if (used.has(i)) continue;
    let cur = { ...items[i] };
    used.add(i);
    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < items.length; j++) {
        if (used.has(j)) continue;
        const o = items[j];
        if (o.horiz !== cur.horiz) continue;
        if (cur.horiz) {
          if (Math.abs(o.y1 - cur.y1) > alignTol) continue;
          if (o.x1 <= cur.x2 + gap && o.x2 >= cur.x1 - gap) {
            cur.x1 = Math.min(cur.x1, o.x1);
            cur.x2 = Math.max(cur.x2, o.x2);
            cur.y1 = cur.y2 = (cur.y1 + o.y1) / 2;
            cur.strokeWidth = Math.max(cur.strokeWidth, o.strokeWidth);
            used.add(j);
            changed = true;
          }
        } else {
          if (Math.abs(o.x1 - cur.x1) > alignTol) continue;
          if (o.y1 <= cur.y2 + gap && o.y2 >= cur.y1 - gap) {
            cur.y1 = Math.min(cur.y1, o.y1);
            cur.y2 = Math.max(cur.y2, o.y2);
            cur.x1 = cur.x2 = (cur.x1 + o.x1) / 2;
            cur.strokeWidth = Math.max(cur.strokeWidth, o.strokeWidth);
            used.add(j);
            changed = true;
          }
        }
      }
    }
    out.push({
      x1: cur.x1,
      y1: cur.y1,
      x2: cur.x2,
      y2: cur.y2,
      strokeWidth: cur.strokeWidth,
    });
  }
  return out;
}

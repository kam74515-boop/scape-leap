/**
 * 识墙严格度 0–100
 * 0 宽松（多收线、短段也保留）· 50 默认 · 100 严格（只留长/粗墙）
 */

export type DetectStrictness = number; // 0-100

const STORAGE_KEY = "fs-space-detect-strictness";

export function clampStrictness(v: number): DetectStrictness {
  if (!Number.isFinite(v)) return 50;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function loadDetectStrictness(): DetectStrictness {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw != null) return clampStrictness(Number(raw));
  } catch {
    /* ignore */
  }
  return 50;
}

export function saveDetectStrictness(v: DetectStrictness) {
  try {
    localStorage.setItem(STORAGE_KEY, String(clampStrictness(v)));
  } catch {
    /* ignore */
  }
}

export function strictnessLabel(v: DetectStrictness): string {
  // 映射到 YOLO 置信度语义：低=多检出，高=更严
  if (v <= 25) return "低置信·多检出";
  if (v <= 60) return "中置信·标准";
  if (v <= 85) return "高置信·偏严";
  return "最高置信";
}

/** 与后端 conf_from_strictness 一致：0→0.08 … 100→0.42（偏低 conf 减漏检） */
export function confFromStrictness(v: DetectStrictness): number {
  const t = clampStrictness(v) / 100;
  return Math.round((0.08 + t * 0.34) * 100) / 100;
}

/**
 * 图片算法参数（默认偏严，少收家具线/细标注）
 * 注意：此函数只能定义一次，重复 export 会导致路由 SyntaxError 白屏
 */
export function imageParamsFromStrictness(s: DetectStrictness) {
  const t = clampStrictness(s) / 100;
  return {
    /** 最短墙段占图短边比例 */
    minLenRatio: 0.028 + t * 0.06,
    minLenPxAbs: Math.round(14 + t * 22),
    /** 厚度范围 px */
    thickMin: Math.round(2 + t * 2),
    thickMax: Math.round(28 - t * 8),
    /** 墨迹占比允许区间 */
    ratioMin: 0.004 + t * 0.008,
    ratioMax: 0.42 - t * 0.12,
    /** 是否启用外轮廓兜底 */
    allowOuterFallback: t < 0.55,
    /** 梯度边缘回退阈值倍率 */
    edgeMul: 1.4 + t * 0.9,
    /** mean 偏置（墨侧更强 = 更严） */
    meanBias: 16 + t * 32,
  };
}

/** PDF 矢量过滤参数（偏墙体、压标注线） */
export function pdfParamsFromStrictness(s: DetectStrictness) {
  const t = clampStrictness(s) / 100;
  return {
    /** 线宽下限（pt）：标注线通常更细 */
    minStrokePt: 0.35 + t * 1.4,
    /** 绝对最短段（pt） */
    minLenPt: 12 + t * 28,
    /** 相对页对角线最短占比：滤掉尺寸界线短 tick */
    minLenPageRatio: 0.035 + t * 0.06,
    /** 相对「粗线中位」：低于此倍率视为标注 */
    strokeVsMedian: 0.55 + t * 0.35,
    minKeptToAcceptVector: Math.round(4 + t * 4),
    strokePercentile: 0.5 + t * 0.35,
  };
}

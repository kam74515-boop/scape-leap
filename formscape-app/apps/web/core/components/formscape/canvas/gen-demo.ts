/**
 * 全部生成结果使用模拟数据
 * - 有 skillId：从 lovspark-skill-library-cases 对应目录取图
 * - 无 skillId：从通用 mock 池取图
 * - 仍附带 colors 作为无 src 时的兜底渐变
 */
import type { ImageGenResult } from "./types";
import { newId } from "./use-canvas-document";
import { pickMockResultSrcs } from "./skills/mock-skill-assets";
import { SKILLS_BY_ID } from "./skills/registry";

const PALETTES = [
  ["#EDE6D9", "#C4A574", "#6B5B4F"],
  ["#E8EEF5", "#A8C0D8", "#5A7A9A"],
  ["#EDE9FE", "#C4B5FD", "#7C3AED"],
  ["#ECFDF5", "#6EE7B7", "#059669"],
  ["#FEF3C7", "#FBBF24", "#B45309"],
  ["#FEE2E2", "#F87171", "#B91C1C"],
  ["#FCE7F3", "#F9A8D4", "#BE185D"],
  ["#DBEAFE", "#60A5FA", "#1E40AF"],
];

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function paletteAt(seed: number, offset: number): string[] {
  const base = PALETTES[(seed + offset) % PALETTES.length];
  if (offset === 0) return base;
  const shift = PALETTES[(seed + offset * 3) % PALETTES.length];
  return [base[0], shift[1], base[2]];
}

export function buildDemoImageResults(opts: {
  prompt: string;
  count: number;
  skillId?: string | null;
  skillColors?: string[];
  seed?: number;
}): { results: ImageGenResult[]; seed: number } {
  const skill = opts.skillId ? SKILLS_BY_ID[opts.skillId] : undefined;
  const seed =
    opts.seed ??
    (hashSeed(`${opts.skillId || ""}|${opts.prompt || "fs"}`) ^ (Date.now() & 0xffff));
  const count = Math.min(4, Math.max(1, opts.count || 1));
  const label =
    (skill?.name || opts.prompt || "生成图").trim().slice(0, 18) || "生成图";
  const srcs = pickMockResultSrcs({
    skillId: opts.skillId,
    count,
    seed,
  });
  const baseColors = opts.skillColors ?? skill?.colors;

  const results: ImageGenResult[] = Array.from({ length: count }, (_, i) => ({
    id: newId("res"),
    title: count > 1 ? `${label} ·${i + 1}` : label,
    colors: baseColors && i === 0 ? baseColors : paletteAt(seed, i),
    seed: (seed + i * 9973) >>> 0,
    src: srcs[i],
  }));
  return { results, seed };
}

export function pickResultColors(
  results: ImageGenResult[] | undefined,
  index = 0
): { colors: string[]; title: string; src?: string } | null {
  if (!results?.length) return null;
  const r = results[Math.min(Math.max(0, index), results.length - 1)];
  return { colors: r.colors, title: r.title, src: r.src };
}

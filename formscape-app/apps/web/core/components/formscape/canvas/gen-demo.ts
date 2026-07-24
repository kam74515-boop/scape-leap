/**
 * Demo 生成结果模拟 — 可替换为真实 API
 */
import type { ImageGenResult } from "./types";
import { newId } from "./use-canvas-document";

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
  // 轻微扰动第二色，模拟多图差异
  if (offset === 0) return base;
  const shift = PALETTES[(seed + offset * 3) % PALETTES.length];
  return [base[0], shift[1], base[2]];
}

export function buildDemoImageResults(opts: {
  prompt: string;
  count: number;
  skillColors?: string[];
  seed?: number;
}): { results: ImageGenResult[]; seed: number } {
  const seed = opts.seed ?? (hashSeed(opts.prompt || "fs") ^ (Date.now() & 0xffff));
  const count = Math.min(4, Math.max(1, opts.count || 1));
  const label = (opts.prompt || "生成图").trim().slice(0, 18) || "生成图";
  const results: ImageGenResult[] = Array.from({ length: count }, (_, i) => ({
    id: newId("res"),
    title: count > 1 ? `${label} ·${i + 1}` : label,
    colors: opts.skillColors && i === 0 ? opts.skillColors : paletteAt(seed, i),
    seed: (seed + i * 9973) >>> 0,
  }));
  return { results, seed };
}

export function pickResultColors(
  results: ImageGenResult[] | undefined,
  index = 0
): { colors: string[]; title: string } | null {
  if (!results?.length) return null;
  const r = results[Math.min(Math.max(0, index), results.length - 1)];
  return { colors: r.colors, title: r.title };
}

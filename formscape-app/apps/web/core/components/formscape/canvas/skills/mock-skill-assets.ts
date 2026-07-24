/**
 * 构境 AI · 技能模拟资产（可移植）
 * public/formscape-skill-mocks — 约 8MB JPEG，不依赖本机 symlink
 */
import catalog from "./mock-skill-assets.generated.json";

export type MockSkillCase = {
  case: string;
  inputs: string[];
  outputs: string[];
};

export type MockSkillBundle = {
  cases: MockSkillCase[];
  outputs: string[];
  inputs: string[];
  outputCount: number;
  inputCount: number;
};

/** 静态资源 URL 前缀（产品名 formscape） */
export const MOCK_SKILLS_PUBLIC_PREFIX = "/formscape-skill-mocks";

export const MOCK_SKILL_CATALOG = catalog as Record<string, MockSkillBundle>;

/** 14 个技能 id = case 目录名 */
export const MOCK_SKILL_IDS = Object.keys(MOCK_SKILL_CATALOG) as string[];

/** 通用出图池（无 skillId 时） */
const FALLBACK_POOL: string[] = (() => {
  const prefer = [
    "unfurnished-space-generation",
    "space-atmosphere-transformation",
    "product-inspiration-expansion",
    "white-model-rendering",
  ];
  const urls: string[] = [];
  for (const id of prefer) {
    const b = MOCK_SKILL_CATALOG[id];
    if (b?.outputs?.length) urls.push(...b.outputs);
  }
  if (!urls.length) {
    for (const b of Object.values(MOCK_SKILL_CATALOG)) {
      urls.push(...(b.outputs ?? []));
    }
  }
  return urls;
})();

export function getMockSkillBundle(skillId?: string | null): MockSkillBundle | null {
  if (!skillId) return null;
  return MOCK_SKILL_CATALOG[skillId] ?? null;
}

/** 技能库卡片封面 */
export function getMockSkillCovers(skillId: string): { cover?: string; hover?: string } {
  const b = MOCK_SKILL_CATALOG[skillId];
  if (!b) return {};
  const cover = b.outputs[0] ?? b.inputs[0];
  const hover = b.outputs[1] ?? b.inputs[0] ?? b.outputs[0];
  return { cover, hover: hover !== cover ? hover : b.outputs[2] ?? hover };
}

/** 按技能取 count 张模拟结果图 */
export function pickMockResultSrcs(opts: {
  skillId?: string | null;
  count: number;
  seed?: number;
}): string[] {
  const count = Math.min(4, Math.max(1, opts.count || 1));
  const bundle = getMockSkillBundle(opts.skillId);
  const pool = bundle?.outputs?.length ? bundle.outputs : FALLBACK_POOL;
  if (!pool.length) return [];
  const start = (opts.seed ?? Date.now()) % pool.length;
  return Array.from({ length: count }, (_, i) => pool[(start + i) % pool.length]);
}

/** 技能轨示例图 */
export function pickMockSampleUploads(skillId: string): Record<string, string[]> {
  const b = MOCK_SKILL_CATALOG[skillId];
  if (!b) return {};
  const input = b.inputs[0] ?? b.outputs[0];
  if (!input) return {};
  return { __sample: [input], space: [input], reference: [b.inputs[1] ?? input] };
}

export type MockGallerySample = {
  id: string;
  skillId: string;
  title: string;
  src: string;
  colors: string[];
};

export function listMockGallerySamples(): MockGallerySample[] {
  const samples: MockGallerySample[] = [];
  for (const skillId of MOCK_SKILL_IDS) {
    const b = MOCK_SKILL_CATALOG[skillId];
    const src = b?.outputs?.[0] ?? b?.inputs?.[0];
    if (!src) continue;
    samples.push({
      id: `mock-${skillId}`,
      skillId,
      title: skillId,
      src,
      colors: ["#E8E4DC", "#C9B8A0", "#5C5346"],
    });
  }
  return samples;
}

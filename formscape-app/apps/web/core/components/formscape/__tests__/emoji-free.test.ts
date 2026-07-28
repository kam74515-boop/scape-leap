/**
 * 零 emoji 回归闸门（产品红线：构境源码与种子/mock 数据不得含 emoji）。
 * 扫描范围 = 验收口径：apps/web/app、apps/web/core/components/formscape、
 * apps/web/core/components/workspace、scripts（mock-api 与 SQLite 数据层、种子）。
 * emoji 区间与验证计划一致：\u{1F000}-\u{1FAFF} \u{2600}-\u{27BF} \u{FE0F}
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOTS = [
  path.resolve(__dirname, "../../../../app"),
  path.resolve(__dirname, ".."),
  path.resolve(__dirname, "../../workspace"),
  path.resolve(__dirname, "../../../../../../scripts"),
];

const EXTS = new Set([".ts", ".tsx", ".mjs", ".js", ".json", ".css"]);
// eslint-disable-next-line no-control-regex
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;

function* walk(dir: string): Generator<string> {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (EXTS.has(path.extname(p))) yield p;
  }
}

describe("零 emoji 红线", () => {
  test("构境源码与种子数据无 emoji 字符", () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const text = readFileSync(file, "utf-8");
        const lines = text.split("\n");
        lines.forEach((line, i) => {
          EMOJI.lastIndex = 0;
          if (EMOJI.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim().slice(0, 80)}`);
        });
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});

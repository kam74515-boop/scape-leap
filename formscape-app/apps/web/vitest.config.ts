import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * 构境 formscape 最小测试配置（设计：纯逻辑 store/管线在 node 环境直测，无 DOM 依赖）
 * 仅收集 formscape 业务测试，不扫 Plane 上游测试。
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "node",
    include: ["core/components/formscape/__tests__/**/*.test.ts"],
    setupFiles: ["core/components/formscape/__tests__/setup.ts"],
    testTimeout: 15000,
  },
});

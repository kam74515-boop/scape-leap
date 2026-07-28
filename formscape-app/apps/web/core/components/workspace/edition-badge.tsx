/**
 * 构境AI 品牌徽标 — 取代 Plane「Community」版本徽标（去 Plane 影子）。
 * 原版会打开 Plane Cloud 付费升级弹窗（Plane 计费残留），构境 demo 无此概念；
 * 此处仅展示品牌与演示标注，不可点击。
 */
import packageJson from "package.json";

export function WorkspaceEditionBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-accent-subtle px-2.5 py-1 text-11 font-medium text-accent-secondary"
      title={`构境AI · v${packageJson.version}`}
    >
      构境AI · 演示版
    </span>
  );
}

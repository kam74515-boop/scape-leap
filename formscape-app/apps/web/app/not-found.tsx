/**
 * 构境AI 根 404 — 取代 Plane 版（404.svg + 英文文案，去 Plane 影子）。
 * 视觉契约 = 设计规范 v3 空态：FsEmpty 线条插画 + 结果导向文案 + 主 CTA。
 */
import { Link } from "react-router";
import { FsEmpty, FsButton } from "@/components/formscape/ui";
import type { Route } from "./+types/not-found";

export const meta: Route.MetaFunction = () => [
  { title: "页面不存在 · 构境AI" },
  { name: "robots", content: "noindex, nofollow" },
];

function PageNotFound() {
  return (
    <div className="grid h-screen w-full place-items-center overflow-hidden bg-surface-1 p-6">
      <FsEmpty
        className="max-w-md"
        title="这个页面不存在"
        body="链接可能已过期或地址有误。回到仪表盘，继续推进在手项目。"
        action={
          <Link to="/">
            <FsButton>回到工作室仪表盘</FsButton>
          </Link>
        }
      />
    </div>
  );
}

export default PageNotFound;

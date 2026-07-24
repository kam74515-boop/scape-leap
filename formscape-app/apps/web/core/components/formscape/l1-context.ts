/**
 * 从路径解析当前 L1 模块 — 用于切换 L2 侧栏
 */
export type FormscapeL1 =
  | "projects"
  | "canvas"
  | "space"
  | "customers"
  | "library"
  | "users"
  | "settings";

export function getFormscapeL1(pathname: string, workspaceSlug: string): FormscapeL1 {
  const ws = workspaceSlug || "formscape";
  const base = `/${ws}`;
  const p = pathname.replace(/\/$/, "") || base;

  if (p.includes(`${base}/canvas`)) return "canvas";
  if (p.includes(`${base}/space`)) return "space";
  if (p.includes(`${base}/customers`)) return "customers";
  if (p.includes(`${base}/library`)) return "library";
  // 用户管理（含原团队 /team 兼容）
  if (p.includes(`${base}/users`) || p.includes(`${base}/team`)) return "users";
  if (p.includes(`${base}/studio-settings`)) return "settings";
  // 首页 / 我的工作 / 草稿 / 项目详情… 都归项目 L1
  return "projects";
}

export const L1_L2_TITLE: Record<FormscapeL1, string> = {
  projects: "项目",
  canvas: "画布",
  space: "3D模型",
  customers: "客户",
  library: "生态库",
  users: "用户管理",
  settings: "设置",
};

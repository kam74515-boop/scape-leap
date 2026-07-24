/**
 * 构境产品语义图标 — L1 / L2 固定映射，避免各处自选不同 icon
 */
import {
  BookOpen,
  Box,
  FileText,
  FolderKanban,
  Hammer,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  ListTodo,
  Palette,
  Presentation,
  Settings,
  UserSquare2,
  Users,
} from "lucide-react";

/** L1 App Rail */
export const L1Icons = {
  projects: LayoutGrid,
  canvas: Layers,
  /** 3D 空间模型 · 平面墙体 · 图块布局 */
  space: Box,
  customers: UserSquare2,
  /** 生态库（原资源） */
  library: BookOpen,
  ecology: BookOpen,
  team: Users,
  /** 用户管理（含团队成员 / 席位） */
  users: Users,
  settings: Settings,
  /** 预留：施工落地 L1 */
  delivery: Hammer,
} as const;

/** 项目树二级 */
export const ProjectNavIcons = {
  overview: LayoutDashboard,
  stages: Palette,
  tasks: ListTodo,
  ppt: Presentation,
  files: FileText,
  project: FolderKanban,
} as const;

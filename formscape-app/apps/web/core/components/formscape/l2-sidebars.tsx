/**
 * 各 L1 的 L2 侧栏 — 项目树 ≠ 画布树
 *
 * 项目 L1：首页/我的工作/草稿 + 项目列表树（可新建项目）
 * 画布 L1：顶栏横排（画布 | 图库 | 生态库 | 技能库）+ 对应内容
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { observer } from "mobx-react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Box,
  FileImage,
  FolderTree,
  ImagePlus,
  Layers,
  Package,
  Plus,
  ProjectNavIcons,
  Settings2,
  ShoppingCart,
  ScanSearch,
  Upload,
  UserSquare2,
  Users,
} from "@/icons";
import { cn } from "@plane/utils";
import { ScrollArea } from "@plane/propel/scrollarea";
import { WorkspaceEditionBadge } from "@/components/workspace/edition-badge";
import { SidebarWrapper } from "@/components/sidebar/sidebar-wrapper";
import { AppSidebarToggleButton } from "@/components/sidebar/sidebar-toggle-button";
import { SidebarMenuItems } from "@/components/workspace/sidebar/sidebar-menu-items";
import { CreateProjectModal } from "@/components/project/create-project-modal";
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { CUSTOMERS, TEAM, WORKSPACE_META } from "./workspace-mock";
import { ECO_CATEGORIES, ECO_MODES, ECO_PRODUCTS, ECO_COMBOS, ECO_CASES, ECO_SPACES } from "./ecology-mock";
import { getPurchaseCount, PURCHASE_CHANGE_EVENT } from "./purchase-store";
import {
  applyDetectedPlan,
  getSpaceScene,
  SPACE_CHANGE_EVENT,
  type SpaceScene,
} from "./space-model-store";
import { importArchitecturalPlan, reimportFromPreview } from "./space-plan-pipeline";
import {
  checkFloorplanMlHealth,
  downloadPlanExport,
  getMlEngine,
  loadDetectStrictnessLocal,
  saveDetectStrictnessLocal,
  setMlEngine,
  type MlEngineId,
  type MlHealth,
} from "./space-ml-client";
import {
  PROJECT_CANVAS_TREE,
  canvasHref,
  type CanvasBoard,
  type ProjectCanvasTree,
} from "./canvas-mock";
import { PM_PROJECTS, type PmProject } from "./pm-mock";
import { STAGES } from "./types";
import { getProjectProgress } from "./project-progress-store";
import { useStudioProgressTick } from "./use-project-progress";
import { TreeAddRow, TreeFolder, TreeLeaf, TreeRoot, TreeSectionLabel } from "./tree-nav";
import type { FormscapeL1 } from "./l1-context";
import { Tooltip } from "@plane/propel/tooltip";
import { useCanvasLibraryOptional, type LibSection } from "./canvas/canvas-library-context";
import { LIB_CONTENT_TABS, LibraryBody } from "./canvas/panels/library-body";

function NavLink({
  to,
  active,
  icon: Icon,
  label,
  meta,
}: {
  to: string;
  active?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  meta?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex h-8 items-center gap-2 rounded-md px-1.5 text-13 transition-colors",
        active ? "bg-layer-transparent-active font-medium text-primary" : "text-secondary hover:bg-layer-transparent-hover"
      )}
    >
      <Icon className="size-4 shrink-0 text-tertiary" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta && <span className="text-11 text-placeholder">{meta}</span>}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-7 items-center px-1.5 pt-1 text-11 font-semibold tracking-wide text-placeholder">
      {children}
    </div>
  );
}

// ─── 画布 L1：项目 → 子画布 ───────────────────────────────────────────

const CANVAS_TREE_STORAGE = "fs-canvas-tree-extra";

function loadExtraCanvases(): Record<string, CanvasBoard[]> {
  try {
    const raw = localStorage.getItem(CANVAS_TREE_STORAGE);
    if (raw) return JSON.parse(raw) as Record<string, CanvasBoard[]>;
  } catch {
    /* ignore */
  }
  return {};
}

function saveExtraCanvases(map: Record<string, CanvasBoard[]>) {
  try {
    localStorage.setItem(CANVAS_TREE_STORAGE, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function mergeCanvasTree(extra: Record<string, CanvasBoard[]>): ProjectCanvasTree[] {
  return PROJECT_CANVAS_TREE.map((p) => ({
    ...p,
    canvases: [...p.canvases, ...(extra[p.projectId] ?? [])],
  }));
}

/** 画布 L2：顶栏横排 Tab（画布树 + 原悬浮库分区） */
export const CanvasL2Sidebar = observer(function CanvasL2Sidebar() {
  const { workspaceSlug } = useParams();
  const ws = workspaceSlug?.toString() ?? "formscape";
  const navigate = useNavigate();
  const searchParams = useSearchParams();
  const activeProject = searchParams.get("project");
  const activeBoard = searchParams.get("board");
  const { sidebarCollapsed } = useAppTheme();
  const lib = useCanvasLibraryOptional();

  const section: LibSection = lib?.section ?? "boards";
  const setSection = lib?.setSection ?? (() => undefined);
  const bridge = lib?.bridge ?? null;
  const [extra, setExtra] = useState(loadExtraCanvases);
  const tree = useMemo(() => mergeCanvasTree(extra), [extra]);

  const createCanvasUnder = useCallback(
    (projectId: string, projectName: string) => {
      const name = window.prompt(`在「${projectName}」下新建画布`, "未命名画布");
      if (!name?.trim()) return;
      const board: CanvasBoard = {
        id: `cv-local-${Date.now()}`,
        name: name.trim(),
        updatedAt: "刚刚",
        nodes: 0,
      };
      setExtra((prev) => {
        const next = { ...prev, [projectId]: [...(prev[projectId] ?? []), board] };
        saveExtraCanvases(next);
        return next;
      });
      navigate(canvasHref(ws, projectId, board.id));
    },
    [navigate, ws]
  );

  // 顶栏：画布 | 图库 | 生态库 | 技能库
  const topTabs: { id: LibSection; label: string; icon: typeof Layers; title?: string }[] = [
    { id: "boards", label: "画布", icon: FolderTree, title: "项目子画布树" },
    ...LIB_CONTENT_TABS.map((t) => ({
      id: t.id as LibSection,
      label: t.label,
      icon: t.icon as typeof Layers,
      title: t.hint,
    })),
  ];

  return (
    <div className="flex h-full min-h-0 w-full animate-fade-in flex-col bg-surface-1">
      {/* 顶栏：图标 + 悬浮标签；收起钮固定右侧不占 Tab 位 */}
      <div className="flex h-11 shrink-0 items-center gap-0.5 border-b border-subtle px-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          {topTabs.map((t) => {
            const Icon = t.icon;
            const active = section === t.id;
            const tip = t.title ? `${t.label} · ${t.title}` : t.label;
            return (
              <Tooltip key={t.id} tooltipContent={tip} position="bottom" openDelay={120}>
                <button
                  type="button"
                  aria-label={t.label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setSection(t.id)}
                  className={cn(
                    "inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors",
                    active
                      ? "bg-layer-transparent-selected text-primary"
                      : "text-tertiary hover:bg-layer-transparent-hover hover:text-secondary"
                  )}
                >
                  <Icon className="size-3.5 shrink-0" strokeWidth={1.85} />
                </button>
              </Tooltip>
            );
          })}
        </div>
        {sidebarCollapsed !== true && (
          <div className="ml-0.5 shrink-0">
            <AppSidebarToggleButton />
          </div>
        )}
      </div>

      <ScrollArea
        orientation="vertical"
        scrollType="hover"
        size="sm"
        rootClassName="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
        viewportClassName="flex h-full w-full flex-col gap-2 overflow-x-hidden overflow-y-auto px-2 py-2"
      >
        {section === "boards" && (
          <>
            <TreeRoot>
              <SectionLabel>快捷</SectionLabel>
              <NavLink to={`/${ws}/canvas`} icon={Layers} label="最近打开" />
              <NavLink to={`/${ws}/library`} icon={Package} label="完整生态库" />
            </TreeRoot>

            <TreeRoot>
              <TreeSectionLabel>按项目 · 子画布</TreeSectionLabel>
              {tree.map((proj) => {
                const projActive = activeProject === proj.projectId;
                return (
                  <TreeFolder
                    key={proj.projectId}
                    id={`canvas-proj-${proj.projectId}`}
                    label={proj.projectName}
                    meta={String(proj.canvases.length)}
                    defaultOpen={projActive || proj.projectId === "proj-demo-1"}
                    href={
                      proj.canvases[0]
                        ? canvasHref(ws, proj.projectId, proj.canvases[0].id)
                        : `/${ws}/canvas?project=${proj.projectId}`
                    }
                    active={projActive}
                  >
                    {proj.canvases.map((cv) => (
                      <TreeLeaf
                        key={cv.id}
                        to={canvasHref(ws, proj.projectId, cv.id)}
                        label={cv.name}
                        meta={cv.updatedAt}
                        active={activeBoard === cv.id}
                        icon={FileImage}
                      />
                    ))}
                    <TreeAddRow
                      label="新建画布"
                      onClick={() => createCanvasUnder(proj.projectId, proj.projectName)}
                    />
                  </TreeFolder>
                );
              })}
            </TreeRoot>
          </>
        )}

        {section !== "boards" && bridge && (
          <LibraryBody
            section={section}
            nodes={bridge.nodes}
            selectedIds={bridge.selectedIds}
            onSelectNode={bridge.onSelectNode}
            onAddImage={bridge.onAddImage}
            onAddProduct={bridge.onAddProduct}
            onPickSkill={bridge.onPickSkill}
            onUpload={bridge.onUpload}
            onAddImageGen={bridge.onAddImageGen}
          />
        )}

        {section !== "boards" && !bridge && (
          <div className="px-2 py-10 text-center text-11 text-tertiary">
            {section === "images" && "打开画布后，上传与生成的图像会出现在图库"}
            {section === "ecology" && "打开画布后，可从生态库将产品落到画布"}
            {section === "skills" && "打开画布后，可选用技能库中的 AIGC 工作流"}
          </div>
        )}
      </ScrollArea>

      <div className="flex h-11 shrink-0 items-center border-t border-subtle px-3">
        <WorkspaceEditionBadge />
      </div>
    </div>
  );
});

// ─── 项目 L1：项目 → 管理子页（≠ 画布树；无顶栏 Tab）──────────────────

/**
 * 项目 L2 子项：
 * - 概览：含经营节点（原「项目进度」已合并）
 * - 设计阶段：唯一可展开到第三级（七阶段）
 */
const PROJECT_CHILDREN = [
  { key: "overview", label: "概览", path: "overview", icon: ProjectNavIcons.overview },
  { key: "stages", label: "设计阶段", path: "stages/requirements", icon: ProjectNavIcons.stages, nested: true },
  { key: "work_items", label: "任务", path: "issues", icon: ProjectNavIcons.tasks },
  { key: "ppt", label: "汇报 PPT", path: "ppt", icon: ProjectNavIcons.ppt },
  { key: "files", label: "文件", path: "files", icon: ProjectNavIcons.files },
] as const;

const EXTRA_PROJECTS_KEY = "fs-extra-projects";

function loadExtraProjects(): PmProject[] {
  try {
    const raw = localStorage.getItem(EXTRA_PROJECTS_KEY);
    if (raw) return JSON.parse(raw) as PmProject[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveExtraProjects(list: PmProject[]) {
  try {
    localStorage.setItem(EXTRA_PROJECTS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export const ProjectsL2Sidebar = observer(function ProjectsL2Sidebar() {
  const { workspaceSlug, projectId: routeProjectId } = useParams();
  const ws = workspaceSlug?.toString() ?? "formscape";
  const pathname = usePathname();
  const navigate = useNavigate();
  const activeProjectId = routeProjectId?.toString();
  /** 进度 store 变更时刷新阶段徽标 */
  const progressTick = useStudioProgressTick();

  const [extraProjects, setExtraProjects] = useState(loadExtraProjects);
  const [createOpen, setCreateOpen] = useState(false);
  /** 手风琴：同时只展开一个项目 */
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(
    () => activeProjectId || "proj-demo-1"
  );

  const allProjects = useMemo(() => [...PM_PROJECTS, ...extraProjects], [extraProjects]);

  // 进入某项目路由时，自动展开该项目（并收起其它）
  useEffect(() => {
    if (activeProjectId) setExpandedProjectId(activeProjectId);
  }, [activeProjectId]);

  const addLocalProject = () => {
    const name = window.prompt("新建项目名称", "未命名项目");
    if (!name?.trim()) return;
    const id = `proj-local-${Date.now()}`;
    const p: PmProject = {
      id,
      name: name.trim(),
      identifier: "NEW",
      emoji: "",
      stageLabel: "线索",
      stageId: "requirements",
      clientName: "待填写",
      city: "—",
      houseType: "—",
      progress: 0,
      openTasks: 0,
      overdueTasks: 0,
      budgetWan: 0,
      designFeeWan: 0,
      feeCollectedWan: 0,
      updatedAt: "刚刚",
      risk: "正常",
      owner: "林设计师",
      members: ["林设计师"],
    };
    setExtraProjects((prev) => {
      const next = [...prev, p];
      saveExtraProjects(next);
      return next;
    });
    navigate(`/${ws}/projects/${id}/overview`);
  };

  return (
    <SidebarWrapper title="项目">
      <CreateProjectModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        setToFavorite={false}
        workspaceSlug={ws}
      />

      {/* 首页 / 我的工作 / 草稿 */}
      <TreeRoot>
        <SidebarMenuItems />
      </TreeRoot>

      {/*
        项目
          ├ 概览（含经营节点）
          ├ 设计阶段 → 七阶段
          ├ 任务 / PPT / 文件
      */}
      <TreeRoot>
        <TreeSectionLabel
          action={
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-5 items-center gap-0.5 rounded-sm px-1 text-11 font-medium text-accent-primary hover:bg-accent-subtle"
              title="新建项目"
            >
              <Plus className="size-3.5" />
              新建
            </button>
          }
        >
          项目列表
        </TreeSectionLabel>

        {allProjects.map((p) => {
          const base = `/${ws}/projects/${p.id}`;
          const inProject = activeProjectId === p.id || pathname.includes(`/projects/${p.id}`);
          const inStages = inProject && pathname.includes("/stages");
          const isExpanded = expandedProjectId === p.id;
          return (
            <TreeFolder
              key={p.id}
              id={`proj-nav-${p.id}`}
              label={p.name}
              meta={p.stageLabel}
              open={isExpanded}
              onOpenChange={(next) => {
                setExpandedProjectId(next ? p.id : null);
              }}
              href={`${base}/overview`}
              active={inProject}
            >
              {PROJECT_CHILDREN.map((child) => {
                if (child.key === "stages") {
                  return (
                    <TreeFolder
                      key={child.key}
                      id={`proj-stages-${p.id}`}
                      label={child.label}
                      defaultOpen={inStages}
                      href={`${base}/stages/requirements`}
                      active={inStages}
                    >
                      {STAGES.map((stage) => {
                        const href = `${base}/stages/${stage.id}`;
                        const active = inProject && pathname.includes(`/stages/${stage.id}`);
                        void progressTick;
                        const progress = getProjectProgress(p.id);
                        const st = progress.stageStates[stage.id];
                        const stale = progress.staleStages.includes(stage.id);
                        const meta = stale
                          ? "过期"
                          : st === "confirmed"
                            ? "确认"
                            : st === "in_progress"
                              ? "进行"
                              : undefined;
                        return (
                          <TreeLeaf
                            key={stage.id}
                            to={href}
                            label={stage.label}
                            meta={meta}
                            active={active}
                          />
                        );
                      })}
                    </TreeFolder>
                  );
                }
                const href = `${base}/${child.path}`;
                const active =
                  inProject &&
                  (child.key === "work_items"
                    ? pathname.includes("/issues")
                    : child.key === "overview"
                      ? pathname.includes("/overview")
                      : pathname.includes(`/${child.path}`));
                return (
                  <TreeLeaf
                    key={child.key}
                    to={href}
                    label={child.label}
                    active={!!active}
                    icon={child.icon}
                  />
                );
              })}
            </TreeFolder>
          );
        })}

        <TreeAddRow
          label="新建项目"
          onClick={() => {
            try {
              setCreateOpen(true);
            } catch {
              addLocalProject();
            }
          }}
        />
      </TreeRoot>
    </SidebarWrapper>
  );
});

// ─── 其它 L1 ─────────────────────────────────────────────────────────

export const CustomersL2Sidebar = observer(function CustomersL2Sidebar() {
  const { workspaceSlug } = useParams();
  const ws = workspaceSlug?.toString() ?? "formscape";
  const stages = ["全部", "线索", "量房", "方案", "施工", "已交付"] as const;

  return (
    <SidebarWrapper title="客户">
      <TreeRoot>
        <SectionLabel>筛选</SectionLabel>
        {stages.map((s) => (
          <NavLink
            key={s}
            to={`/${ws}/customers`}
            icon={UserSquare2}
            label={s}
            meta={
              s === "全部"
                ? String(CUSTOMERS.length)
                : String(CUSTOMERS.filter((c) => c.stage === s).length || "")
            }
          />
        ))}
      </TreeRoot>
      <TreeRoot>
        <SectionLabel>最近客户</SectionLabel>
        {CUSTOMERS.map((c) => (
          <NavLink key={c.id} to={`/${ws}/customers`} icon={UserSquare2} label={c.name} meta={c.stage} />
        ))}
      </TreeRoot>
    </SidebarWrapper>
  );
});

/** 生态库 L2 — 模式 / 采购 / 品类 */
export const LibraryL2Sidebar = observer(function LibraryL2Sidebar() {
  const { workspaceSlug } = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ws = workspaceSlug?.toString() ?? "formscape";
  const mode = searchParams.get("mode") ?? searchParams.get("tab") ?? "products";
  const onLibrary = pathname.includes("/library");

  const [purchaseCount, setPurchaseCount] = useState(() =>
    typeof window === "undefined" ? 0 : getPurchaseCount()
  );
  useEffect(() => {
    const bump = () => setPurchaseCount(getPurchaseCount());
    bump();
    window.addEventListener(PURCHASE_CHANGE_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(PURCHASE_CHANGE_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  const modeMeta = (key: string) => {
    if (key === "products") return String(ECO_PRODUCTS.length);
    if (key === "combos") return String(ECO_COMBOS.length);
    if (key === "cases") return String(ECO_CASES.length);
    if (key === "spaces") return String(ECO_SPACES.length);
    if (key === "purchase") return purchaseCount > 0 ? String(purchaseCount) : undefined;
    return undefined;
  };

  return (
    <SidebarWrapper title="生态库">
      <TreeRoot>
        <SectionLabel>浏览</SectionLabel>
        {ECO_MODES.filter((m) => m.key !== "purchase").map((m) => (
          <NavLink
            key={m.key}
            to={`/${ws}/library?mode=${m.key}`}
            icon={m.key === "products" ? Package : BookOpen}
            label={m.label}
            meta={modeMeta(m.key)}
            active={onLibrary && mode === m.key}
          />
        ))}
      </TreeRoot>
      <TreeRoot>
        <SectionLabel>采购</SectionLabel>
        <NavLink
          to={`/${ws}/library?mode=purchase`}
          icon={ShoppingCart}
          label="采购清单"
          meta={purchaseCount > 0 ? String(purchaseCount) : undefined}
          active={onLibrary && mode === "purchase"}
        />
      </TreeRoot>
      <TreeRoot>
        <SectionLabel>品类</SectionLabel>
        {ECO_CATEGORIES.filter((c) => c.key !== "combo").map((cat) => (
          <NavLink
            key={cat.key}
            to={`/${ws}/library?mode=products`}
            icon={Package}
            label={cat.label}
          />
        ))}
      </TreeRoot>
    </SidebarWrapper>
  );
});

/** 用户管理 L2 — 成员 / 席位 / 角色（原「团队」并入） */
export const UsersL2Sidebar = observer(function UsersL2Sidebar() {
  const { workspaceSlug } = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ws = workspaceSlug?.toString() ?? "formscape";
  const onUsers = pathname.includes("/users") || pathname.includes("/team");
  const tab = searchParams.get("tab") ?? "members";

  return (
    <SidebarWrapper title="用户管理">
      <TreeRoot>
        <SectionLabel>管理</SectionLabel>
        <NavLink
          to={`/${ws}/users?tab=members`}
          icon={Users}
          label="团队成员"
          meta={String(TEAM.length)}
          active={onUsers && (tab === "members" || !searchParams.get("tab"))}
        />
        <NavLink
          to={`/${ws}/users?tab=seats`}
          icon={Users}
          label="席位"
          meta={`${WORKSPACE_META.seatsUsed}/${WORKSPACE_META.seatsTotal}`}
          active={onUsers && tab === "seats"}
        />
        <NavLink
          to={`/${ws}/users?tab=roles`}
          icon={Settings2}
          label="角色权限"
          active={onUsers && tab === "roles"}
        />
      </TreeRoot>
      <TreeRoot>
        <SectionLabel>成员</SectionLabel>
        {TEAM.map((m) => (
          <NavLink
            key={m.id}
            to={`/${ws}/users?tab=members`}
            icon={Users}
            label={m.name}
            meta={`${m.load}%`}
          />
        ))}
      </TreeRoot>
    </SidebarWrapper>
  );
});

/** @deprecated 使用 UsersL2Sidebar */
export const TeamL2Sidebar = UsersL2Sidebar;

export const SettingsL2Sidebar = observer(function SettingsL2Sidebar() {
  const { workspaceSlug } = useParams();
  const ws = workspaceSlug?.toString() ?? "formscape";
  const items = [
    { label: "计划与席位", href: `/${ws}/studio-settings` },
    { label: "算力与用量", href: `/${ws}/studio-settings` },
    { label: "集成", href: `/${ws}/studio-settings` },
    { label: "外观", href: `/${ws}/studio-settings` },
  ];

  return (
    <SidebarWrapper title="设置">
      <TreeRoot>
        <SectionLabel>工作室</SectionLabel>
        {items.map((it) => (
          <NavLink key={it.label} to={it.href} icon={Settings2} label={it.label} />
        ))}
      </TreeRoot>
    </SidebarWrapper>
  );
});

/** 3D模型 L2 — 选文件 → 点「检测」识墙（L3 仅视口） */
export const SpaceL2Sidebar = observer(function SpaceL2Sidebar() {
  const { workspaceSlug } = useParams();
  const navigate = useNavigate();
  const ws = workspaceSlug?.toString() ?? "formscape";
  const fileRef = useRef<HTMLInputElement>(null);
  const [scene, setScene] = useState<SpaceScene | null>(() =>
    typeof window === "undefined" ? null : getSpaceScene()
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [strictness, setStrictness] = useState(() =>
    typeof window === "undefined" ? 50 : loadDetectStrictnessLocal()
  );
  const [engine, setEngine] = useState<MlEngineId>(() =>
    typeof window === "undefined" ? "f23d" : getMlEngine()
  );
  const [mlHealth, setMlHealth] = useState<MlHealth | null>(null);

  useEffect(() => {
    const bump = () => setScene(getSpaceScene());
    bump();
    window.addEventListener(SPACE_CHANGE_EVENT, bump);
    return () => window.removeEventListener(SPACE_CHANGE_EVENT, bump);
  }, []);

  useEffect(() => {
    let dead = false;
    const ping = async () => {
      const h = await checkFloorplanMlHealth(2500);
      if (!dead) setMlHealth(h);
    };
    void ping();
    const id = window.setInterval(() => void ping(), 12000);
    return () => {
      dead = true;
      window.clearInterval(id);
    };
  }, []);

  const pickFile = (file: File | null) => {
    if (!file) return;
    const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
    const isImage =
      /^image\//.test(file.type) ||
      /\.(png|jpe?g|webp|gif|bmp|tif{1,2}|heic|heif)$/i.test(file.name);
    if (!isPdf && !isImage) {
      window.alert("请选择 PNG/JPG/WebP 或 PDF 平面图");
      return;
    }
    setPendingFile(file);
    setStatus(`已选择：${file.name} · 点击下方「开始检测」`);
  };

  const runDetect = async () => {
    if (busy) return;
    saveDetectStrictnessLocal(strictness);
    setMlEngine(engine);
    const engLabel = engine === "r2v" ? "栅格矢量化 R2V" : "F23D";

    // 1) 有待检测文件 → 走完整导入
    if (pendingFile) {
      setBusy(true);
      setStatus(`检测中…（${engLabel}）`);
      try {
        const isPdf =
          /\.pdf$/i.test(pendingFile.name) || pendingFile.type === "application/pdf";
        const result = await importArchitecturalPlan(pendingFile, strictness);
        const polyN = result.f23dPlan
          ? ["wall", "door", "window"].reduce(
              (n, k) =>
                n + ((result.f23dPlan!.polygons as Record<string, unknown[]>)[k]?.length ?? 0),
              0
            )
          : 0;
        if (!result.walls.length && !polyN) {
          throw new Error("未检出线段。可换引擎或调低严格度，线稿图更适合 R2V");
        }
        // 必须用返回值，勿再 getSpaceScene()（曾因 localStorage 写失败读到旧场景）
        const next = applyDetectedPlan({
          name: pendingFile.name,
          kind: isPdf ? "pdf" : "image",
          previewUrl: result.previewUrl,
          walls: result.walls,
          widthMm: result.widthMm,
          depthMm: result.depthMm,
          method: result.method,
          message: result.message,
          strictness: result.strictness,
          f23dPlan: result.f23dPlan ?? null,
        });
        setStatus(result.message);
        setPendingFile(null);
        setScene(next);
        navigate(`/${ws}/space`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatus(msg);
        window.alert(`检测失败：${msg}`);
      } finally {
        setBusy(false);
      }
      return;
    }

    // 2) 无新文件但场景有底图 → 重新检测
    if (scene?.floorPlanDataUrl && scene.sourceKind) {
      setBusy(true);
      setStatus(`重新检测中…（${engLabel}）`);
      try {
        const result = await reimportFromPreview(
          scene.floorPlanDataUrl,
          scene.sourceKind,
          scene.sourceFileName ?? "plan.png",
          strictness
        );
        const polyN = result.f23dPlan
          ? ["wall", "door", "window"].reduce(
              (n, k) =>
                n + ((result.f23dPlan!.polygons as Record<string, unknown[]>)[k]?.length ?? 0),
              0
            )
          : 0;
        if (!result.walls.length && !polyN) {
          throw new Error("未检出墙段。可换引擎或调低严格度后重试");
        }
        const next = applyDetectedPlan({
          name: scene.sourceFileName ?? "plan.png",
          kind: scene.sourceKind,
          previewUrl: result.previewUrl,
          walls: result.walls,
          widthMm: result.widthMm,
          depthMm: result.depthMm,
          method: result.method,
          message: result.message,
          strictness: result.strictness,
          f23dPlan: result.f23dPlan ?? null,
        });
        setStatus(result.message);
        setScene(next);
        navigate(`/${ws}/space`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatus(msg);
        window.alert(`检测失败：${msg}`);
      } finally {
        setBusy(false);
      }
      return;
    }

    // 3) 什么都没有 → 引导选文件
    fileRef.current?.click();
    setStatus("请先选择平面图，再点「开始检测」");
  };

  const engMap = mlHealth?.engines ?? mlHealth?.backends ?? {};
  const f23dOk = Boolean(engMap.f23d);
  const r2vOk = Boolean(engMap.r2v);
  const anyMl = Boolean(mlHealth?.ok && (f23dOk || r2vOk));
  const canExport =
    Boolean(scene?.f23dPlan?.svg_b64) || Boolean(scene?.f23dPlan?.dxf_b64);

  return (
    <SidebarWrapper title="3D模型">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-3">
        <SectionLabel>导入平面</SectionLabel>
        <p className="mb-2 px-1.5 text-11 leading-snug text-tertiary">
          F23D 语义 · R2V 栅格描摹（路线 B）
        </p>

        <div className="mx-1 mb-2 rounded-md border border-subtle bg-surface-2/40 px-2 py-2">
          <div className="mb-2 text-11 text-tertiary">识别引擎</div>
          <div className="mb-2 flex flex-col gap-1">
            <label
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 text-11",
                engine === "f23d"
                  ? "border-accent-primary/50 bg-accent-subtle/40"
                  : "border-subtle"
              )}
            >
              <input
                type="radio"
                name="ml-engine"
                className="mt-0.5"
                checked={engine === "f23d"}
                disabled={busy}
                onChange={() => {
                  setEngine("f23d");
                  setMlEngine("f23d");
                }}
              />
              <span>
                <span className="font-medium text-primary">F23D · 墙门窗语义</span>
                <span className="mt-0.5 block text-[10px] text-placeholder">
                  AI 分割 · 适合示意图
                  {f23dOk ? " · 在线" : mlHealth ? " · 离线" : ""}
                </span>
              </span>
            </label>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 text-11",
                engine === "r2v"
                  ? "border-accent-primary/50 bg-accent-subtle/40"
                  : "border-subtle"
              )}
            >
              <input
                type="radio"
                name="ml-engine"
                className="mt-0.5"
                checked={engine === "r2v"}
                disabled={busy}
                onChange={() => {
                  setEngine("r2v");
                  setMlEngine("r2v");
                }}
              />
              <span>
                <span className="font-medium text-primary">R2V · 栅格矢量化</span>
                <span className="mt-0.5 block text-[10px] text-placeholder">
                  描摹线稿 → SVG/DXF · 无门窗语义
                  {r2vOk ? " · 在线" : mlHealth ? " · 离线" : ""}
                </span>
              </span>
            </label>
          </div>

          <div className="mb-1 flex items-center justify-between text-11">
            <span className="text-tertiary">严格度</span>
            <span className="font-medium text-primary">{strictness}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={strictness}
            disabled={busy}
            onChange={(e) => {
              const v = Number(e.target.value);
              setStrictness(v);
              saveDetectStrictnessLocal(v);
            }}
            className="w-full accent-[var(--color-accent-primary,#3b82f6)]"
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-placeholder">
            <span>宽松（更多线）</span>
            <span>严格（更少噪点）</span>
          </div>
          <div className="mt-1.5 text-[10px] leading-snug text-placeholder">
            {anyMl ? (
              <span className="text-accent-primary">
                ML 在线 · 当前 {engine === "r2v" ? "R2V" : "F23D"}
              </span>
            ) : (
              <span>ML 离线 · 启动 services/floorplan-ml :8090</span>
            )}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            pickFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "mx-1 flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-subtle px-2 py-4 text-center transition-colors",
            busy ? "opacity-60" : "hover:border-accent-primary/50 hover:bg-accent-subtle/30"
          )}
        >
          <Upload className="size-5 text-accent-primary" strokeWidth={1.5} />
          <span className="text-12 font-medium text-primary">
            {pendingFile ? "更换文件" : "选择平面图 / PDF"}
          </span>
          <span className="max-w-full truncate px-1 text-[10px] text-tertiary">
            {pendingFile ? pendingFile.name : "PNG · JPG · PDF"}
          </span>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => void runDetect()}
          className={cn(
            "mx-1 mt-2 flex w-[calc(100%-0.5rem)] items-center justify-center gap-1.5 rounded-md bg-accent-primary px-2 py-2.5 text-12 font-semibold text-on-color transition-colors hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
          )}
        >
          <ScanSearch className="size-4" strokeWidth={1.75} />
          {busy
            ? "检测中…"
            : pendingFile
              ? "开始检测"
              : scene?.floorPlanDataUrl
                ? "重新检测"
                : "开始检测"}
        </button>
        <p className="mx-1 mt-1 text-[10px] text-placeholder">
          {pendingFile
            ? `待检测：${pendingFile.name}`
            : scene?.floorPlanDataUrl
              ? "可对当前底图重新检测，或先更换文件"
              : "请先选择平面图，再点检测"}
        </p>
        {status && (
          <p className="mx-1 mt-2 text-[10px] leading-snug text-accent-primary">{status}</p>
        )}

        {canExport && (
          <div className="mx-1 mt-2 flex gap-1.5">
            <button
              type="button"
              className="flex-1 rounded-md border border-subtle px-2 py-1.5 text-11 font-medium text-primary hover:bg-surface-2"
              onClick={() =>
                downloadPlanExport(
                  scene?.f23dPlan,
                  "svg",
                  (scene?.sourceFileName ?? "floorplan").replace(/\.[^.]+$/, "")
                )
              }
            >
              导出 SVG
            </button>
            <button
              type="button"
              className="flex-1 rounded-md border border-subtle px-2 py-1.5 text-11 font-medium text-primary hover:bg-surface-2"
              onClick={() =>
                downloadPlanExport(
                  scene?.f23dPlan,
                  "dxf",
                  (scene?.sourceFileName ?? "floorplan").replace(/\.[^.]+$/, "")
                )
              }
            >
              导出 DXF
            </button>
          </div>
        )}

        <div className="mt-3">
          <SectionLabel>当前场景</SectionLabel>
          <NavLink
            to={`/${ws}/space`}
            icon={Box}
            label={scene?.sourceFileName ?? scene?.name ?? "未命名场景"}
            meta={`墙 ${scene?.walls?.length ?? 0} 段`}
            active
          />
          {scene && scene.widthMm > 0 && (
            <p className="mt-1 px-1.5 text-[10px] text-placeholder">
              {(scene.widthMm / 1000).toFixed(1)}×{(scene.depthMm / 1000).toFixed(1)} m
              {scene.detectMessage ? ` · ${scene.detectMessage.slice(0, 48)}` : ""}
            </p>
          )}
        </div>
      </div>
    </SidebarWrapper>
  );
});

export function FormscapeL2ByModule({ l1 }: { l1: FormscapeL1 }) {
  switch (l1) {
    case "canvas":
      return <CanvasL2Sidebar />;
    case "space":
      return <SpaceL2Sidebar />;
    case "customers":
      return <CustomersL2Sidebar />;
    case "library":
      return <LibraryL2Sidebar />;
    case "users":
      return <UsersL2Sidebar />;
    case "settings":
      return <SettingsL2Sidebar />;
    case "projects":
    default:
      return <ProjectsL2Sidebar />;
  }
}

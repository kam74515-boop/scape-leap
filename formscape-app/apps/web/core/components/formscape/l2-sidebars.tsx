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
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { WorkspaceEditionBadge } from "@/components/workspace/edition-badge";
import { SidebarWrapper } from "@/components/sidebar/sidebar-wrapper";
import { AppSidebarToggleButton } from "@/components/sidebar/sidebar-toggle-button";
import { SidebarMenuItems } from "@/components/workspace/sidebar/sidebar-menu-items";
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { TEAM, WORKSPACE_META } from "./workspace-mock";
import {
  countCustomersByStage,
  CUSTOMERS_CHANGE_EVENT,
  CUSTOMER_STAGES,
  getCustomers,
  type CustomerRecord,
  type CustomerStage,
} from "./customers-store";
import { ECO_CATEGORIES, ECO_MODES, ECO_PRODUCTS, ECO_COMBOS, ECO_CASES, ECO_SPACES } from "./ecology-mock";
import { getPurchaseCount, PURCHASE_CHANGE_EVENT } from "./purchase-store";
import {
  applyDetectConfFilter,
  applyDetectedPlan,
  getSpaceScene,
  setActiveSpaceProject,
  SPACE_CHANGE_EVENT,
  type SpaceScene,
} from "./space-model-store";
import { importArchitecturalPlan, reimportFromPreview } from "./space-plan-pipeline";
import {
  checkFloorplanMlHealth,
  downloadTextFile,
  loadDetectStrictnessLocal,
  saveDetectStrictnessLocal,
  type MlHealth,
} from "./space-ml-client";
import { buildWallsObj } from "./space-wall-ops";
import {
  canvasHref,
  CANVAS_TREE_CHANGE_EVENT,
  loadExtraCanvases,
  mergeCanvasTree,
  saveExtraCanvases,
  type CanvasBoard,
} from "./canvas-mock";
import { useProjects } from "./projects-store";
import { CreateProjectWizard } from "./CreateProjectWizard";
import { STAGES } from "./types";
import { getProjectProgress } from "./project-progress-store";
import { useStudioProgressTick } from "./use-project-progress";
import { TreeAddRow, TreeFolder, TreeLeaf, TreeRoot, TreeSectionLabel } from "./tree-nav";
import { FsButton, FsModal, FsSlider, fsInputClass } from "./ui";
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
        "relative flex h-8 items-center gap-2 rounded-md px-1.5 text-13 transition-colors",
        active
          ? "bg-accent-subtle font-medium text-accent-secondary"
          : "text-secondary hover:bg-layer-transparent-hover"
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-full bg-accent-primary"
        />
      )}
      <Icon className={cn("size-4 shrink-0", active ? "text-accent-primary" : "text-tertiary")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta && (
        <span className={cn("text-11 tabular-nums", active ? "text-accent-primary" : "text-placeholder")}>
          {meta}
        </span>
      )}
    </Link>
  );
}

/** 命名弹窗 — 替代原生 window.prompt（规范 v3 禁用原生弹窗） */
function NamePromptModal({
  open,
  title,
  placeholder,
  defaultValue = "",
  confirmLabel = "创建",
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(defaultValue);
  useEffect(() => {
    if (open) setName(defaultValue);
  }, [open, defaultValue]);

  const submit = () => {
    const v = name.trim();
    if (!v) return;
    onClose();
    onSubmit(v);
  };

  return (
    <FsModal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <FsButton variant="secondary" size="sm" onClick={onClose}>
            取消
          </FsButton>
          <FsButton size="sm" disabled={!name.trim()} onClick={submit}>
            {confirmLabel}
          </FsButton>
        </>
      }
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        className={fsInputClass}
      />
    </FsModal>
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

// 画布树 extra 存于 canvas-mock（与 findCanvasMeta 同源）

/** 画布 L2：顶栏横排 Tab（画布树 + 原悬浮库分区） */
export const CanvasL2Sidebar = observer(function CanvasL2Sidebar() {
  const { workspaceSlug } = useParams();
  const ws = workspaceSlug?.toString() ?? "formscape";
  const navigate = useNavigate();
  const searchParams = useSearchParams();
  const activeProject = searchParams.get("project");
  const activeBoard = searchParams.get("board");
  const { sidebarCollapsed } = useAppTheme();
  const { projects } = useProjects();
  const lib = useCanvasLibraryOptional();

  const section: LibSection = lib?.section ?? "boards";
  const setSection = lib?.setSection ?? (() => undefined);
  const bridge = lib?.bridge ?? null;
  const [extra, setExtra] = useState(loadExtraCanvases);
  // SQLite hydrate / 其它处新建画布后，树数据刷新
  useEffect(() => {
    const onChange = () => setExtra(loadExtraCanvases());
    window.addEventListener(CANVAS_TREE_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CANVAS_TREE_CHANGE_EVENT, onChange);
  }, []);
  const tree = useMemo(() => mergeCanvasTree(extra, projects), [extra, projects]);
  /** 新建画布弹窗目标项目（替代原生 prompt） */
  const [canvasTarget, setCanvasTarget] = useState<{ projectId: string; projectName: string } | null>(
    null
  );

  const createCanvasUnder = useCallback(
    (projectId: string, name: string) => {
      const board: CanvasBoard = {
        id: `cv-local-${Date.now()}`,
        name,
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

  // 顶栏：画布 | 图板 | 图库 | 生态库 | 技能库
  const topTabs: { id: LibSection; label: string; icon: typeof Layers; title?: string }[] = [
    { id: "boards", label: "画布", icon: FolderTree, title: "项目工作画布树" },
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
                      ? "bg-accent-subtle text-accent-primary"
                      : "text-tertiary hover:bg-layer-transparent-hover hover:text-secondary"
                  )}
                >
                  <Icon className="size-3.5 shrink-0" strokeWidth={1.75} />
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
                      onClick={() =>
                        setCanvasTarget({ projectId: proj.projectId, projectName: proj.projectName })
                      }
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
            projectId={bridge.projectId}
            projectName={bridge.projectName}
            onSelectNode={bridge.onSelectNode}
            onAddImage={bridge.onAddImage}
            onAddProduct={bridge.onAddProduct}
            onAddProductToStyleBoard={bridge.onAddProductToStyleBoard}
            onPlaceStylePin={bridge.onPlaceStylePin}
            onPlaceStyleBoard={bridge.onPlaceStyleBoard}
            onPickSkill={bridge.onPickSkill}
            onUpload={bridge.onUpload}
            onAddImageGen={bridge.onAddImageGen}
          />
        )}

        {section !== "boards" && !bridge && (
          <div className="px-2 py-10 text-center text-11 text-tertiary">
            {section === "styleboards" && "打开项目子画布后，可管理项目图板"}
            {section === "images" && "打开画布后，上传与生成的图像会出现在图库"}
            {section === "ecology" && "打开画布后，可将产品加入图板或落到画布"}
            {section === "skills" && "打开画布后，可选用技能库中的 AIGC 工作流"}
          </div>
        )}
      </ScrollArea>

      <div className="flex h-11 shrink-0 items-center border-t border-subtle px-3">
        <WorkspaceEditionBadge />
      </div>

      <NamePromptModal
        open={canvasTarget !== null}
        title={canvasTarget ? `在「${canvasTarget.projectName}」下新建画布` : "新建画布"}
        placeholder="画布名称"
        defaultValue="未命名画布"
        onClose={() => setCanvasTarget(null)}
        onSubmit={(name) => {
          if (canvasTarget) createCanvasUnder(canvasTarget.projectId, name);
        }}
      />
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

export const ProjectsL2Sidebar = observer(function ProjectsL2Sidebar() {
  const { workspaceSlug, projectId: routeProjectId } = useParams();
  const ws = workspaceSlug?.toString() ?? "formscape";
  const pathname = usePathname();
  const navigate = useNavigate();
  const activeProjectId = routeProjectId?.toString();
  /** 进度 store 变更时刷新阶段徽标 */
  const progressTick = useStudioProgressTick();

  const { projects: allProjects } = useProjects();
  const [createOpen, setCreateOpen] = useState(false);
  /** 手风琴：同时只展开一个项目 */
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(
    () => activeProjectId || "proj-demo-1"
  );

  // 进入某项目路由时，自动展开该项目（并收起其它）
  useEffect(() => {
    if (activeProjectId) setExpandedProjectId(activeProjectId);
  }, [activeProjectId]);

  return (
    <SidebarWrapper title="项目">
      <CreateProjectWizard
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(projectId) => {
          setExpandedProjectId(projectId);
          navigate(`/${ws}/projects/${projectId}/overview`);
        }}
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
          onClick={() => setCreateOpen(true)}
        />
      </TreeRoot>
    </SidebarWrapper>
  );
});

// ─── 其它 L1 ─────────────────────────────────────────────────────────

export const CustomersL2Sidebar = observer(function CustomersL2Sidebar() {
  const { workspaceSlug } = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ws = workspaceSlug?.toString() ?? "formscape";
  const onCustomers = pathname.includes("/customers");
  const stageParam = searchParams.get("stage");
  const stages = ["全部", ...CUSTOMER_STAGES] as const;

  // 与 CustomersPage 同源（customers-store），不再读静态 workspace-mock
  const [counts, setCounts] = useState(() =>
    typeof window === "undefined"
      ? ({ 全部: 0 } as Record<CustomerStage | "全部", number>)
      : countCustomersByStage()
  );
  const [recent, setRecent] = useState<CustomerRecord[]>(() =>
    typeof window === "undefined" ? [] : getCustomers().slice(0, 8)
  );
  useEffect(() => {
    const bump = () => {
      setCounts(countCustomersByStage());
      setRecent(getCustomers().slice(0, 8));
    };
    bump();
    window.addEventListener(CUSTOMERS_CHANGE_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(CUSTOMERS_CHANGE_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  return (
    <SidebarWrapper title="客户">
      <TreeRoot>
        <SectionLabel>筛选</SectionLabel>
        {stages.map((s) => (
          <NavLink
            key={s}
            to={s === "全部" ? `/${ws}/customers` : `/${ws}/customers?stage=${encodeURIComponent(s)}`}
            icon={UserSquare2}
            label={s}
            meta={(() => {
              const n = counts[s as CustomerStage | "全部"] ?? 0;
              return n > 0 ? String(n) : s === "全部" ? "0" : "";
            })()}
            active={onCustomers && (s === "全部" ? !stageParam : stageParam === s)}
          />
        ))}
      </TreeRoot>
      <TreeRoot>
        <SectionLabel>最近客户</SectionLabel>
        {recent.length === 0 ? (
          <p className="px-2 py-1 text-11 text-tertiary">暂无客户 · 在客户页新建</p>
        ) : (
          recent.map((c) => (
            <NavLink
              key={c.id}
              to={`/${ws}/customers?stage=${encodeURIComponent(c.stage)}`}
              icon={UserSquare2}
              label={c.name}
              meta={c.stage}
            />
          ))
        )}
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
            to={`/${ws}/library?mode=products&cat=${cat.key}`}
            icon={Package}
            label={cat.label}
            active={onLibrary && mode === "products" && searchParams.get("cat") === cat.key}
          />
        ))}
      </TreeRoot>
    </SidebarWrapper>
  );
});

/** 团队管理 L2 — 成员 / 席位 / 角色 */
export const UsersL2Sidebar = observer(function UsersL2Sidebar() {
  const { workspaceSlug } = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ws = workspaceSlug?.toString() ?? "formscape";
  const onUsers = pathname.includes("/users") || pathname.includes("/team");
  const tab = searchParams.get("tab") ?? "members";

  return (
    <SidebarWrapper title="团队管理">
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
            to={`/${ws}/users?tab=members&member=${m.id}`}
            icon={Users}
            label={m.name}
            meta={`${m.load}%`}
            active={onUsers && searchParams.get("member") === m.id}
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ws = workspaceSlug?.toString() ?? "formscape";
  const onSettings = pathname.includes("/studio-settings");
  const section = searchParams.get("section") ?? "plan";
  const items = [
    { label: "计划与席位", section: "plan" },
    { label: "算力与用量", section: "usage" },
    { label: "集成", section: "integrations" },
    { label: "外观", section: "appearance" },
  ] as const;

  return (
    <SidebarWrapper title="设置">
      <TreeRoot>
        <SectionLabel>工作室</SectionLabel>
        {items.map((it) => (
          <NavLink
            key={it.section}
            to={`/${ws}/studio-settings?section=${it.section}`}
            icon={Settings2}
            label={it.label}
            active={onSettings && section === it.section}
          />
        ))}
      </TreeRoot>
    </SidebarWrapper>
  );
});

/** 3D模型 L2 — 选文件 → 点「检测」识墙（L3 仅视口） */
export const SpaceL2Sidebar = observer(function SpaceL2Sidebar() {
  const { workspaceSlug } = useParams();
  const navigate = useNavigate();
  const searchParams = useSearchParams();
  const ws = workspaceSlug?.toString() ?? "formscape";
  const projectId = searchParams.get("project");
  const { projects } = useProjects();
  const selectedProject = projects.find((project) => project.id === projectId);
  const spaceHref = projectId
    ? `/${ws}/space?project=${encodeURIComponent(projectId)}`
    : `/${ws}/space`;
  const fileRef = useRef<HTMLInputElement>(null);
  const [scene, setScene] = useState<SpaceScene | null>(() =>
    typeof window === "undefined" ? null : getSpaceScene(projectId)
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [strictness, setStrictness] = useState(() =>
    typeof window === "undefined" ? 50 : loadDetectStrictnessLocal()
  );
  const [mlHealth, setMlHealth] = useState<MlHealth | null>(null);
  /** 已成功识别过：拖置信度自动重跑，无需重新上传 */
  const lastPlanRef = useRef<{
    previewUrl: string;
    kind: "image" | "pdf";
    name: string;
  } | null>(null);
  const busyRef = useRef(false);
  const skipConfAutoRef = useRef(true); // 首屏不因 strictness 初值触发

  useEffect(() => {
    setActiveSpaceProject(projectId);
    setPendingFile(null);
    setStatus(null);
    lastPlanRef.current = null;
    const bump = () => setScene(getSpaceScene(projectId));
    bump();
    window.addEventListener(SPACE_CHANGE_EVENT, bump);
    return () => window.removeEventListener(SPACE_CHANGE_EVENT, bump);
  }, [projectId]);

  // 场景已有底图时同步到 lastPlanRef，便于调 conf 重检
  useEffect(() => {
    if (scene?.floorPlanDataUrl && scene.sourceKind) {
      lastPlanRef.current = {
        previewUrl: scene.floorPlanDataUrl,
        kind: scene.sourceKind,
        name: scene.sourceFileName ?? "plan.png",
      };
    }
  }, [scene?.floorPlanDataUrl, scene?.sourceKind, scene?.sourceFileName]);

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
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "暂不支持该文件",
        message: "请选择 PNG/JPG/WebP 或 PDF 平面图",
      });
      return;
    }
    setPendingFile(file);
    setStatus(`已选择：${file.name} · 点击下方「开始检测」`);
  };

  const applyResult = useCallback(
    (
      result: Awaited<ReturnType<typeof importArchitecturalPlan>>,
      name: string,
      kind: "image" | "pdf",
      keepPending: boolean
    ) => {
      const polyN = result.f23dPlan
        ? ["wall", "door", "window"].reduce(
            (n, k) =>
              n + ((result.f23dPlan!.polygons as Record<string, unknown[]>)[k]?.length ?? 0),
            0
          )
        : 0;
      if (!result.walls.length && !polyN) {
        throw new Error("未检出墙体。可调低置信度后重试");
      }
      const preview = result.previewUrl;
      if (preview) {
        lastPlanRef.current = { previewUrl: preview, kind, name };
      }
      const next = applyDetectedPlan({
        name,
        kind,
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
      if (!keepPending) setPendingFile(null);
      setScene(next);
      navigate(spaceHref);
    },
    [navigate, spaceHref]
  );

  const runDetect = useCallback(
    async (sOverride?: number, opts?: { silent?: boolean }) => {
      if (busyRef.current) return;
      if (!selectedProject) {
        setToast({
          type: TOAST_TYPE.WARNING,
          title: "请先选择项目",
          message: "3D 场景按项目独立保存，选择项目后再导入平面图",
        });
        return;
      }
      const s = sOverride ?? strictness;
      saveDetectStrictnessLocal(s);
      const silent = Boolean(opts?.silent);

      // 1) 有待检测文件 → 完整导入
      if (pendingFile) {
        busyRef.current = true;
        setBusy(true);
        setStatus("检测中…");
        try {
          const isPdf =
            /\.pdf$/i.test(pendingFile.name) || pendingFile.type === "application/pdf";
          const result = await importArchitecturalPlan(pendingFile, s);
          applyResult(result, pendingFile.name, isPdf ? "pdf" : "image", false);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setStatus(msg);
          if (!silent) setToast({ type: TOAST_TYPE.ERROR, title: "检测失败", message: msg });
        } finally {
          busyRef.current = false;
          setBusy(false);
        }
        return;
      }

      // 2) 已有底图（场景或上次成功结果）→ 改 conf 即时重检
      const plan =
        lastPlanRef.current ??
        (scene?.floorPlanDataUrl && scene.sourceKind
          ? {
              previewUrl: scene.floorPlanDataUrl,
              kind: scene.sourceKind,
              name: scene.sourceFileName ?? "plan.png",
            }
          : null);

      if (plan) {
        busyRef.current = true;
        setBusy(true);
        setStatus(silent ? `严格度 ${s} · 重检中…` : "重新检测中…");
        try {
          const result = await reimportFromPreview(
            plan.previewUrl,
            plan.kind,
            plan.name,
            s
          );
          applyResult(result, plan.name, plan.kind, true);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setStatus(msg);
          if (!silent) setToast({ type: TOAST_TYPE.ERROR, title: "检测失败", message: msg });
        } finally {
          busyRef.current = false;
          setBusy(false);
        }
        return;
      }

      // 3) 无图 → 选文件
      fileRef.current?.click();
      setStatus("请先选择平面图，再点「开始检测」");
    },
    [strictness, pendingFile, scene, applyResult, selectedProject]
  );

  // 拖动置信度：有全量缓存时瞬时过滤（不请求后端，像朋友项目一样实时）
  useEffect(() => {
    if (skipConfAutoRef.current) {
      skipConfAutoRef.current = false;
      return;
    }
    saveDetectStrictnessLocal(strictness);
    // 优先即时过滤
    const filtered = applyDetectConfFilter(strictness);
    if (filtered) {
      setScene(filtered);
      setStatus(filtered.detectMessage);
      return;
    }
    // 尚无缓存时（未跑过 ML）：不自动请求，等用户点检测
  }, [strictness]);

  const routeAOk = Boolean(mlHealth?.ok && mlHealth?.engines?.route_a);
  const canExportObj = Boolean(scene?.walls?.length);
  const architectOn = mlHealth?.architect_enabled;

  const exportObjFromScene = () => {
    if (!scene?.walls?.length) {
      setToast({
        type: TOAST_TYPE.WARNING,
        title: "没有可导出的墙体",
        message: "先完成识别再导出",
      });
      return;
    }
    const base = (scene.sourceFileName ?? "floorplan").replace(/\.[^.]+$/, "");
    const obj = buildWallsObj(scene.walls, scene.wallHeightMm || 2800, base);
    downloadTextFile(obj, `${base}.obj`, "model/obj");
    setToast({
      type: TOAST_TYPE.SUCCESS,
      title: "OBJ 已导出",
      message: `墙 ${scene.walls.length} 段 · 墙高 ${scene.wallHeightMm || 2800}mm`,
    });
  };

  return (
    <SidebarWrapper title="3D模型">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-3">
        <SectionLabel>项目归属</SectionLabel>
        <div className="mx-1 mb-2">
          <select
            aria-label="选择 3D 场景所属项目"
            className={fsInputClass}
            value={selectedProject?.id ?? ""}
            disabled={busy}
            onChange={(event) => {
              const nextProjectId = event.target.value;
              navigate(
                nextProjectId
                  ? `/${ws}/space?project=${encodeURIComponent(nextProjectId)}`
                  : `/${ws}/space`
              );
            }}
          >
            <option value="">请选择项目</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-10 leading-snug text-placeholder">
            {selectedProject
              ? `独立保存到「${selectedProject.name}」，不会覆盖其他项目`
              : "先选择项目，再导入平面图或编辑墙体"}
          </p>
        </div>

        <SectionLabel>导入平面</SectionLabel>
        <p className="mb-2 px-1.5 text-11 leading-snug text-tertiary">
          上传平面图自动识出墙/门/窗。先检测一次，之后拖严格度就能实时过滤。
        </p>

        <div className="mx-1 mb-2 rounded-md border border-subtle bg-surface-2/40 px-2 py-2">
          <div className="mb-1 flex items-center justify-between text-11">
            <span className="text-tertiary">严格度</span>
            <span className="font-medium text-primary tabular-nums">{strictness}</span>
          </div>
          <FsSlider
            min={0}
            max={100}
            step={5}
            value={strictness}
            disabled={busy || !selectedProject}
            onChange={(e) => {
              const v = Number(e.target.value);
              setStrictness(v);
              saveDetectStrictnessLocal(v);
            }}
            className="w-full"
          />
          <div className="mt-0.5 flex justify-between text-10 text-placeholder">
            <span>低·多检出</span>
            <span>高·更严</span>
          </div>
          <div className="mt-1.5 text-10 leading-snug text-placeholder">
            {routeAOk ? (
              <span className="text-accent-primary">
                增强识别已开启
                {scene?.detectFull ? " · 拖一下就能换严格度" : " · 先检测一次后可实时调严格度"}
                {architectOn === true ? " · 含非商用模型" : ""}
                {architectOn === false ? " · 已关非商用模型" : ""}
              </span>
            ) : (
              <span>增强识别未开启 · 需先启动本地识别服务</span>
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
          disabled={busy || !selectedProject}
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
          <span className="max-w-full truncate px-1 text-10 text-tertiary">
            {pendingFile ? pendingFile.name : "PNG · JPG · PDF"}
          </span>
        </button>

        <FsButton
          disabled={busy || !selectedProject}
          onClick={() => void runDetect()}
          className="mx-1 mt-2 w-[calc(100%-0.5rem)] disabled:cursor-wait"
        >
          <ScanSearch className="size-4" strokeWidth={1.75} />
          {busy
            ? "检测中…"
            : pendingFile
              ? "开始检测"
              : scene?.floorPlanDataUrl
                ? "重新检测"
                : "开始检测"}
        </FsButton>
        <p className="mx-1 mt-1 text-10 text-placeholder">
          {pendingFile
            ? `待检测：${pendingFile.name}`
            : scene?.detectFull
              ? "拖严格度即时过滤，完全不用等待"
              : scene?.floorPlanDataUrl
                ? "点「重新检测」跑一次后，即可实时调严格度"
                : "请先选择平面图，再点检测"}
        </p>
        {status && (
          <p className="mx-1 mt-2 text-10 leading-snug text-accent-primary">{status}</p>
        )}

        {canExportObj && (
          <div className="mx-1 mt-2 flex flex-wrap gap-1.5">
            <FsButton variant="secondary" size="sm" className="flex-1" onClick={exportObjFromScene}>
              导出 OBJ
            </FsButton>
            <FsButton
              variant="ghost"
              size="sm"
              className="flex-1 text-tertiary"
              onClick={() =>
                setToast({
                  type: TOAST_TYPE.INFO,
                  title: "GLB 即将支持",
                  message: "当前请用 OBJ（可由墙体直接生成）",
                })
              }
            >
              GLB · 即将支持
            </FsButton>
          </div>
        )}

        <div className="mt-3">
          <SectionLabel>当前场景</SectionLabel>
          <NavLink
            to={spaceHref}
            icon={Box}
            label={scene?.sourceFileName ?? scene?.name ?? "未命名场景"}
            meta={`墙 ${scene?.walls?.length ?? 0} 段`}
            active
          />
          {scene && scene.widthMm > 0 && (
            <p className="mt-1 px-1.5 text-10 text-placeholder">
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

/**
 * L3 · 3D模型主区
 * 显性步骤流：上传 → 识别 → 调严格度 → 3D 白模
 * 有 f23dPlan 时用识别多边形预览/挤出（含修正模式）；否则回退墙中心线
 */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@plane/utils";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Box, BrickWall, Download, PencilRuler, Trash2 } from "@/icons";
import { PageHead } from "@/components/core/page-title";
import { AppSidebarToggleButton } from "@/components/sidebar/sidebar-toggle-button";
import { useAppTheme } from "@/hooks/store/use-app-theme";
import {
  addPlacement,
  detectMethodLabel,
  ensureDetectIds,
  getSpaceScene,
  removePlacement,
  removeWall,
  setActiveSpaceProject,
  setSpaceScene,
  setWallParams,
  applyDetectConfFilter,
  SPACE_CHANGE_EVENT,
  type SpaceScene,
  type SpaceWall,
} from "./space-model-store";
import {
  cancelActiveDetect,
  checkFloorplanMlHealth,
  downloadTextFile,
  getDetectProgress,
  saveDetectStrictnessLocal,
  SPACE_DETECT_PROGRESS_EVENT,
  type DetectProgress,
  type MlHealth,
} from "./space-ml-client";
import { buildWallsObj, wallLength } from "./space-wall-ops";
import { BLOCK_CATEGORIES, SPACE_BLOCKS } from "./space-model-mock";
import { F23dPlanViewer } from "./F23dPlanViewer";
import { FsButton, FsConfirm, FsModal, FsMuted, FsPageShell, FsProgress, FsSlider, FsSteps, FsTag } from "./ui";

type Props = { workspaceSlug: string };

const EMPTY: SpaceScene = {
  id: "x",
  name: "…",
  projectId: null,
  projectName: null,
  source: "empty",
  floorPlanDataUrl: null,
  sourceFileName: null,
  sourceKind: null,
  walls: [],
  placements: [],
  widthMm: 10000,
  depthMm: 8000,
  wallHeightMm: 2800,
  wallThicknessMm: 120,
  detectMethod: null,
  detectMessage: null,
  detectStrictness: 50,
  f23dPlan: null,
  updatedAt: "",
};

const STEPS = [
  { key: "upload", label: "上传平面图" },
  { key: "detect", label: "识别墙门窗" },
  { key: "tune", label: "调严格度" },
  { key: "3d", label: "3D 白模" },
];

export function FormscapeSpaceModelPage({ workspaceSlug }: Props) {
  const { sidebarCollapsed } = useAppTheme();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const [scene, setScene] = useState<SpaceScene>(EMPTY);
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [blockPanel, setBlockPanel] = useState(false);
  const [blockCat, setBlockCat] = useState<(typeof BLOCK_CATEGORIES)[number]["key"]>("furniture");
  const [confirmClear, setConfirmClear] = useState(false);
  const [mlHelpOpen, setMlHelpOpen] = useState(false);
  const [progress, setProgress] = useState<DetectProgress>(() => getDetectProgress());
  const [mlHealth, setMlHealth] = useState<MlHealth | null>(null);
  void workspaceSlug;

  const refresh = useCallback(() => setScene(getSpaceScene(projectId)), [projectId]);

  useEffect(() => {
    setActiveSpaceProject(projectId);
    refresh();
    const on = () => refresh();
    window.addEventListener(SPACE_CHANGE_EVENT, on);
    // 同页内检测完成后也要立刻反映（避免只靠 localStorage 事件丢更新）
    return () => window.removeEventListener(SPACE_CHANGE_EVENT, on);
  }, [refresh]);

  // 检测进度（阶段文字 + 可取消）
  useEffect(() => {
    const on = () => setProgress({ ...getDetectProgress() });
    window.addEventListener(SPACE_DETECT_PROGRESS_EVENT, on);
    return () => window.removeEventListener(SPACE_DETECT_PROGRESS_EVENT, on);
  }, []);

  // 识别服务健康状态（含非商用权重开关）
  useEffect(() => {
    let dead = false;
    const ping = async () => {
      const h = await checkFloorplanMlHealth(2500);
      if (!dead) setMlHealth(h);
    };
    void ping();
    const id = window.setInterval(() => void ping(), 15000);
    return () => {
      dead = true;
      window.clearInterval(id);
    };
  }, []);

  const plan = scene.f23dPlan;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      // 有识别多边形时删除由修正模式（F23dPlanViewer 内部）接管
      if (plan) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedWallId) {
        e.preventDefault();
        setScene(removeWall(selectedWallId));
        setSelectedWallId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedWallId, plan]);

  const selected = scene.walls.find((w) => w.id === selectedWallId) ?? null;
  const polyCount = plan
    ? (plan.polygons.wall?.length ?? 0) +
      (plan.polygons.door?.length ?? 0) +
      (plan.polygons.window?.length ?? 0)
    : 0;
  const hasGeom = polyCount > 0 || scene.walls.length > 0;
  const hasDetect = Boolean(plan) && scene.detectMethod === "ml-route-a";

  // 统计（2D 优先原图坐标系的数量，与视口一致）
  const statPolys = plan?.source_polygons ?? plan?.polygons ?? null;
  const wallN = statPolys?.wall?.length ?? scene.walls.length;
  const doorN = statPolys?.door?.length ?? 0;
  const winN = statPolys?.window?.length ?? 0;
  const solidN = (statPolys?.wall ?? []).filter((p) => p.kind === "solid").length;
  const hollowN = (statPolys?.wall ?? []).filter((p) => p.kind === "hollow").length;

  // 步骤流：上传 → 识别 → 调严格度 → 3D
  const currentStep = !scene.floorPlanDataUrl && !hasGeom ? 0 : !hasDetect ? 1 : view === "3d" ? 3 : 2;
  const onStepClick = (i: number) => {
    if (i === 0) {
      setToast({
        type: TOAST_TYPE.INFO,
        title: "在左侧栏上传",
        message: "选择平面图（PNG / JPG / PDF）后点「开始检测」",
      });
      return;
    }
    if (i === 3) {
      if (hasGeom) setView("3d");
      return;
    }
    setView("2d");
  };

  const fileBase = (scene.sourceFileName ?? "floorplan").replace(/\.[^.]+$/, "");

  const exportObj = () => {
    if (!scene.walls.length) {
      setToast({
        type: TOAST_TYPE.WARNING,
        title: "没有可导出的墙体",
        message: "先完成识别（或手工修正出墙体）再导出",
      });
      return;
    }
    const obj = buildWallsObj(scene.walls, scene.wallHeightMm || 2800, fileBase);
    downloadTextFile(obj, `${fileBase}.obj`, "model/obj");
    setToast({
      type: TOAST_TYPE.SUCCESS,
      title: "OBJ 已导出",
      message: `墙 ${scene.walls.length} 段 · 墙高 ${scene.wallHeightMm || 2800}mm`,
    });
  };

  const toggleEdit = () => {
    if (!editMode) {
      ensureDetectIds();
      setView("2d");
      setSelectedWallId(null);
    }
    setEditMode((v) => !v);
  };

  const strictness = scene.detectStrictness ?? 50;
  const strictnessHint =
    strictness <= 25 ? "宽松 · 多检出" : strictness <= 60 ? "标准" : strictness <= 85 ? "偏严" : "最严";
  const architectOn = mlHealth?.architect_enabled;

  return (
    <>
      <PageHead title={`${scene.name} · 3D模型`} />
      <FsPageShell>
        {/* 单顶栏（铁律）：文件名 + 识别方式 + 操作 */}
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-subtle bg-surface-1 px-3">
          <div className="flex min-w-0 items-center gap-2">
            {sidebarCollapsed && <AppSidebarToggleButton />}
            <span className="truncate text-13 font-semibold text-primary">
              {scene.sourceFileName ?? scene.name}
            </span>
            <FsTag tone={scene.projectId ? "neutral" : "warning"}>
              {scene.projectName ?? "未绑定项目"}
            </FsTag>
            {scene.detectMethod && (
              <FsTag tone={scene.detectMethod === "ml-route-a" ? "brand" : "neutral"}>
                {detectMethodLabel(scene.detectMethod)}
              </FsTag>
            )}
            {scene.detectMethod === "template" && <FsTag tone="warning">演示数据</FsTag>}
          </div>
          <div className="flex items-center gap-1.5">
            {selected && !plan && (
              <FsButton
                variant="ghost"
                size="sm"
                className="text-danger-primary"
                onClick={() => {
                  setScene(removeWall(selected.id));
                  setSelectedWallId(null);
                }}
              >
                <Trash2 className="size-3" strokeWidth={1.75} />
                删 {(wallLength(selected) / 1000).toFixed(2)}m
              </FsButton>
            )}
            {plan && view === "2d" && (
              <FsButton
                variant={editMode ? "primary" : "secondary"}
                size="sm"
                onClick={toggleEdit}
              >
                <PencilRuler className="size-3.5" strokeWidth={1.75} />
                {editMode ? "完成修正" : "修正模式"}
              </FsButton>
            )}
            {hasGeom && (
              <FsButton
                variant={blockPanel ? "primary" : "secondary"}
                size="sm"
                onClick={() => {
                  setBlockPanel((v) => !v);
                  setView("2d");
                }}
              >
                图块布局
                {scene.placements.length > 0 ? ` · ${scene.placements.length}` : ""}
              </FsButton>
            )}
            {hasGeom && (
              <FsButton variant="secondary" size="sm" onClick={exportObj}>
                <Download className="size-3.5" strokeWidth={1.75} />
                导出 OBJ
              </FsButton>
            )}
            {hasGeom && (
              <FsButton
                variant="ghost"
                size="sm"
                className="text-tertiary hover:text-danger-primary"
                onClick={() => setConfirmClear(true)}
              >
                清空
              </FsButton>
            )}
            <div className="flex rounded-full border border-subtle p-0.5">
              <button
                type="button"
                onClick={() => setView("2d")}
                className={cn(
                  "rounded-full px-2.5 py-1 text-11 font-medium transition-colors",
                  view === "2d" ? "bg-accent-primary text-on-color" : "text-secondary"
                )}
              >
                平面
              </button>
              <button
                type="button"
                onClick={() => {
                  setView("3d");
                  setEditMode(false);
                }}
                className={cn(
                  "rounded-full px-2.5 py-1 text-11 font-medium transition-colors",
                  view === "3d" ? "bg-accent-primary text-on-color" : "text-secondary"
                )}
              >
                3D
              </button>
            </div>
          </div>
        </div>

        {/* 步骤流 + 统计徽标 + 严格度（内容区顶部，非第二条顶栏） */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-subtle bg-surface-1 px-3 py-2">
          <FsSteps steps={STEPS} current={currentStep} onStepClick={onStepClick} />

          {hasGeom && (
            <div className="flex flex-wrap items-center gap-1.5">
              <FsTag tone="brand" className="tabular-nums">墙 {wallN}</FsTag>
              {(solidN > 0 || hollowN > 0) && (
                <FsTag tone="neutral" className="tabular-nums">
                  实心 {solidN} · 空心 {hollowN}
                </FsTag>
              )}
              <FsTag tone="warning" className="tabular-nums">门 {doorN}</FsTag>
              <FsTag tone="success" className="tabular-nums">窗 {winN}</FsTag>
            </div>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
            {hasGeom && (
              <label className="flex items-center gap-1.5 text-11 text-tertiary">
                墙高
                <input
                  type="number"
                  min={2200}
                  max={4000}
                  step={50}
                  key={`h-${scene.wallHeightMm}`}
                  defaultValue={scene.wallHeightMm || 2800}
                  onBlur={(e) => {
                    const v = Math.max(2200, Math.min(4000, Number(e.target.value) || 2800));
                    if (v !== scene.wallHeightMm) setWallParams({ wallHeightMm: v });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  className="w-16 rounded-md border border-subtle bg-surface-1 px-1.5 py-0.5 text-11 text-primary tabular-nums outline-none focus:border-accent-strong"
                />
                mm
              </label>
            )}

            <div className="flex items-center gap-2" title="拖一下就能换严格度，结果即时更新，完全不用等">
              <span className="text-11 text-tertiary">识别严格度</span>
              <FsSlider
                min={0}
                max={100}
                step={5}
                value={strictness}
                disabled={!scene.detectFull}
                className="w-36"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  saveDetectStrictnessLocal(v);
                  applyDetectConfFilter(v);
                }}
              />
              <span className="w-20 text-11 text-secondary tabular-nums">
                {strictness} · {strictnessHint}
              </span>
            </div>

            {mlHealth?.ok ? (
              <span className="flex items-center gap-1.5">
                <FsTag tone="success">增强识别已开启</FsTag>
                {architectOn === false && <FsTag tone="neutral">已关闭非商用模型</FsTag>}
                {architectOn === true && (
                  <span
                    className="cursor-help"
                    title="Architect 模型为 CC-BY-NC 非商用许可；商用部署请以 ARCHITECT_ENABLED=0 启动识别服务"
                  >
                    <FsTag tone="warning">含非商用模型</FsTag>
                  </span>
                )}
              </span>
            ) : (
              <button type="button" onClick={() => setMlHelpOpen(true)}>
                <FsTag tone="neutral" className="cursor-pointer hover:bg-layer-transparent-hover">
                  增强识别未开启 · 点这里看怎么开启
                </FsTag>
              </button>
            )}
          </div>

          {scene.detectMessage && (
            <div className="w-full truncate text-11 text-tertiary">{scene.detectMessage}</div>
          )}
        </div>

        <div className="relative min-h-0 flex-1 bg-surface-2">
          {!hasGeom ? (
            <div className="flex h-full items-center justify-center px-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <BrickWall className="size-10 text-placeholder" strokeWidth={1.75} />
                <div className="text-14 font-semibold text-primary">
                  上传一张户型图，墙、门、窗自动标出来
                </div>
                <FsMuted>
                  在左侧栏选择平面图（PNG / JPG / PDF）并点「开始检测」；识别一次后，拖一下滑杆就能换严格度，完全不用等
                </FsMuted>
              </div>
            </div>
          ) : plan && polyCount > 0 ? (
            <F23dPlanViewer
              plan={plan}
              mode={view}
              originalUrl={scene.floorPlanDataUrl}
              walls={scene.walls}
              widthMm={scene.widthMm}
              wallHeightMm={scene.wallHeightMm}
              editMode={editMode && view === "2d"}
              placements={scene.placements}
              onRemovePlacement={(id) => setScene(removePlacement(id))}
            />
          ) : view === "2d" ? (
            <LegacyPlanView
              scene={scene}
              selectedWallId={selectedWallId}
              onSelect={setSelectedWallId}
              onRemovePlacement={(id) => setScene(removePlacement(id))}
            />
          ) : (
            <LegacyIsoView scene={scene} selectedWallId={selectedWallId} onSelect={setSelectedWallId} />
          )}

          {/* 图块库：点选加入平面布局（与识别墙体同场景） */}
          {hasGeom && blockPanel && view === "2d" && (
            <div className="absolute bottom-10 left-3 z-[5] w-72 max-h-[50%] overflow-hidden rounded-xl border border-subtle bg-surface-1 shadow-overlay-200">
              <div className="flex items-center justify-between border-b border-subtle px-3 py-2">
                <span className="text-12 font-semibold text-primary">图块布局</span>
                <span className="text-10 text-tertiary">演示 · 无真 3D mesh</span>
              </div>
              <div className="flex gap-1 overflow-x-auto border-b border-subtle px-2 py-1.5">
                {BLOCK_CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setBlockCat(c.key)}
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 text-11 font-medium transition-colors",
                      blockCat === c.key
                        ? "bg-accent-primary text-on-color"
                        : "bg-surface-2 text-secondary hover:bg-layer-transparent-hover"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="max-h-48 overflow-y-auto p-2">
                <div className="grid grid-cols-2 gap-1.5">
                  {SPACE_BLOCKS.filter((b) => b.category === blockCat).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        const next = addPlacement(b.id);
                        setScene(next);
                        setToast({
                          type: TOAST_TYPE.SUCCESS,
                          title: `已放入 ${b.label}`,
                          message: "可在平面上点选图块删除",
                        });
                      }}
                      className="flex items-center gap-2 rounded-lg border border-subtle px-2 py-1.5 text-left transition-colors hover:border-accent-primary/40 hover:bg-accent-subtle/30"
                    >
                      <span
                        className="size-3 shrink-0 rounded-sm"
                        style={{ background: b.color }}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-11 font-medium text-primary">{b.label}</span>
                        <span className="block text-10 text-tertiary tabular-nums">
                          {(b.wMm / 1000).toFixed(1)}×{(b.dMm / 1000).toFixed(1)}m
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              {scene.placements.length > 0 && (
                <div className="border-t border-subtle px-2 py-1.5">
                  <div className="mb-1 text-10 text-tertiary">已放置 {scene.placements.length}</div>
                  <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto">
                    {scene.placements.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        title="点击移除"
                        onClick={() => setScene(removePlacement(p.id))}
                        className="rounded-full border border-subtle bg-surface-2 px-2 py-0.5 text-10 text-secondary hover:border-danger-primary hover:text-danger-primary"
                      >
                        {p.label} ×
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 边界声明（红线：内置 UI） */}
          {hasGeom && (
            <div className="pointer-events-none absolute bottom-2 right-3 rounded-md bg-surface-1/80 px-2 py-1 text-10 text-tertiary">
              白模精度用于可视化与布局决策，施工尺寸以实测为准
            </div>
          )}

          {/* 检测进行中：阶段文字 + 细进度条 + 可取消 */}
          {progress.active && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
              <div className="fs-ui-pop w-72 rounded-xl border border-subtle bg-surface-1 p-4 shadow-overlay-200">
                <div className="mb-1 truncate text-13 font-semibold text-primary">
                  正在识别{progress.fileName ? ` · ${progress.fileName}` : ""}
                </div>
                <div className="mb-3 text-11 text-tertiary">{progress.stage ?? "处理中…"}</div>
                <FsProgress ai />
                <div className="mt-3 flex justify-end">
                  <FsButton
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      cancelActiveDetect();
                      setToast({
                        type: TOAST_TYPE.INFO,
                        title: "已取消识别",
                        message: "保留原有结果，随时可以重新检测",
                      });
                    }}
                  >
                    取消
                  </FsButton>
                </div>
              </div>
            </div>
          )}
        </div>

        <FsConfirm
          open={confirmClear}
          danger
          title="清空当前识别结果？"
          body="将移除本场景的全部墙、门、窗，底图与上传记录保留，可重新检测。"
          confirmLabel="清空"
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            const s = getSpaceScene(projectId);
            setScene(
              setSpaceScene({
                ...s,
                walls: [],
                f23dPlan: null,
                detectFull: null,
                detectMessage: "已清空",
              })
            );
            setSelectedWallId(null);
            setEditMode(false);
            setConfirmClear(false);
          }}
        />

        <FsModal open={mlHelpOpen} onClose={() => setMlHelpOpen(false)} title="启动识别服务" width="md">
          <div className="space-y-2">
            <p>识别墙门窗需要本机的识别服务（首次启动会自动下载约 156MB 公开模型）：</p>
            <pre className="rounded-lg bg-surface-2 px-3 py-2 text-12 text-primary">
              {"cd services/floorplan-ml\n./start.sh"}
            </pre>
            <p className="text-12 text-tertiary">
              启动后回到本页即可检测。商用部署请以 ARCHITECT_ENABLED=0 启动（关闭 CC-BY-NC 非商用权重）。
              没有识别服务时也能用「本地快速识墙」，但效果会差一些。
            </p>
          </div>
        </FsModal>
      </FsPageShell>
    </>
  );
}

/** 无识别多边形时的回退平面视图（配色走 --fs-plan-*，dark 自适配） */
function LegacyPlanView({
  scene,
  selectedWallId,
  onSelect,
  onRemovePlacement,
}: {
  scene: SpaceScene;
  selectedWallId: string | null;
  onSelect: (id: string | null) => void;
  onRemovePlacement?: (id: string) => void;
}) {
  const pad = 400;
  const vbW = scene.widthMm + pad * 2;
  const vbH = scene.depthMm + pad * 2;
  return (
    <div className="absolute inset-0" style={{ background: "var(--fs-plan-bg)" }}>
      <svg className="size-full" viewBox={`${-pad} ${-pad} ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet" onClick={() => onSelect(null)}>
        <rect x={-pad} y={-pad} width={vbW} height={vbH} style={{ fill: "var(--fs-plan-bg)" }} />
        <rect x={0} y={0} width={scene.widthMm} height={scene.depthMm} style={{ fill: "var(--fs-plan-surface)", stroke: "var(--fs-plan-grid)" }} strokeWidth={20} />
        {scene.floorPlanDataUrl && (
          <image href={scene.floorPlanDataUrl} x={0} y={0} width={scene.widthMm} height={scene.depthMm} opacity={0.3} preserveAspectRatio="none" />
        )}
        {scene.walls.map((w) => {
          const active = w.id === selectedWallId;
          return (
            <g key={w.id}>
              <line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="transparent" strokeWidth={Math.max(w.thickness * 2.5, 200)} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onSelect(active ? null : w.id); }} />
              <line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} style={{ stroke: active ? "var(--fs-plan-accent)" : "var(--fs-plan-wall)" }} strokeWidth={active ? w.thickness * 1.3 : w.thickness} strokeLinecap="square" className="pointer-events-none" />
            </g>
          );
        })}
        {scene.placements.map((pl) => (
          <g key={pl.id}>
            <rect
              x={pl.x}
              y={pl.y}
              width={pl.wMm}
              height={pl.dMm}
              rx={40}
              fill={pl.color}
              opacity={0.55}
              style={{ stroke: "var(--fs-plan-label)" }}
              strokeWidth={20}
              className={onRemovePlacement ? "cursor-pointer" : undefined}
              onClick={
                onRemovePlacement
                  ? (e) => {
                      e.stopPropagation();
                      onRemovePlacement(pl.id);
                    }
                  : undefined
              }
            />
            <text
              x={pl.x + pl.wMm / 2}
              y={pl.y + pl.dMm / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fill: "var(--fs-plan-label)" }}
              fontSize={180}
              className="pointer-events-none select-none"
            >
              {pl.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** 无识别多边形时的回退等轴测视图（配色走 --fs-plan-*） */
function LegacyIsoView({
  scene,
  selectedWallId,
  onSelect,
}: {
  scene: SpaceScene;
  selectedWallId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const pad = 800;
  const scale = 0.045;
  const h = scene.wallHeightMm * scale;
  const cos = Math.cos(Math.PI / 6);
  const sin = Math.sin(Math.PI / 6);
  const project = (x: number, y: number, z: number) => ({ X: (x - y) * cos, Y: (x + y) * sin - z });
  const pts = scene.walls.flatMap((w) => [w.x1, w.y1, w.x2, w.y2]);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    for (const z of [0, h]) {
      const p = project(pts[i], pts[i + 1], z);
      minX = Math.min(minX, p.X); maxX = Math.max(maxX, p.X);
      minY = Math.min(minY, p.Y); maxY = Math.max(maxY, p.Y);
    }
  }
  if (!Number.isFinite(minX)) { minX = 0; maxX = 1000; minY = 0; maxY = 1000; }
  return (
    <div className="absolute inset-0" style={{ background: "var(--fs-plan-bg)" }}>
      <svg className="size-full" viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`} preserveAspectRatio="xMidYMid meet" onClick={() => onSelect(null)}>
        {scene.walls.map((w: SpaceWall) => {
          const active = w.id === selectedWallId;
          const a0 = project(w.x1, w.y1, 0); const a1 = project(w.x2, w.y2, 0);
          const b0 = project(w.x1, w.y1, h); const b1 = project(w.x2, w.y2, h);
          return (
            <g key={w.id} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onSelect(active ? null : w.id); }}>
              <polygon points={`${a0.X},${a0.Y} ${a1.X},${a1.Y} ${b1.X},${b1.Y} ${b0.X},${b0.Y}`} style={{ fill: active ? "var(--fs-plan-accent)" : "var(--fs-plan-wall-soft)" }} opacity={0.9} />
            </g>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1 text-11 text-tertiary">
        <Box className="size-3.5" strokeWidth={1.75} /> 线段回退预览
      </div>
    </div>
  );
}

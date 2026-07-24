/**
 * L1 · 3D模型
 * L2：建筑平面图 / PDF 上传（侧栏）
 * L3：本页 — 模型生成结果 + 墙体 2D/3D 编辑（参考 blueprint-js / arcada）
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@plane/utils";
import { BrickWall, Layers, Minus, Plus, RotateCw, Scissors, Trash2 } from "@/icons";
import { PageHead } from "@/components/core/page-title";
import { AppSidebarToggleButton } from "@/components/sidebar/sidebar-toggle-button";
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { FormscapeAiHeaderButton } from "./AiDrawer";
import {
  BLOCK_CATEGORIES,
  ROOM_TEMPLATES,
  SPACE_BLOCKS,
  type BlockCategory,
  type RoomTemplateId,
} from "./space-model-mock";
import {
  addPlacement,
  addWallSegment,
  applyDetectedPlan,
  bindSceneProject,
  clearPlacements,
  clearWalls,
  detectMethodLabel,
  getSpaceScene,
  regenerateWalls,
  removePlacement,
  removeWall,
  setSpaceScene,
  setWallParams,
  setWalls,
  sourceLabel,
  SPACE_CHANGE_EVENT,
  updatePlacement,
  type SpacePlacement,
  type SpaceScene,
} from "./space-model-store";
import { reimportFromPreview } from "./space-plan-pipeline";
import {
  loadDetectStrictness,
  saveDetectStrictness,
  strictnessLabel,
} from "./space-detect-params";
import {
  nudgeWallLength,
  setWallLength,
  setWallThickness,
  splitWall,
  wallAngleDeg,
  wallLength,
} from "./space-wall-ops";
import { SpacePlanViewport, type PlanTool } from "./SpacePlanViewport";
import { SpaceWall3DViewport } from "./SpaceWall3DViewport";
import { PM_PROJECTS } from "./pm-mock";
import { FsMuted, FsPageShell, FsTag } from "./ui";

type Props = {
  workspaceSlug: string;
};

/** SSR / 首屏 hydration 共用占位，避免 server/client 初始状态不一致 */
const EMPTY_SCENE: SpaceScene = {
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
  updatedAt: "",
};

export function FormscapeSpaceModelPage({ workspaceSlug }: Props) {
  const { sidebarCollapsed } = useAppTheme();
  // 必须与 SSR 一致：勿在 useState 初值读 localStorage
  const [scene, setScene] = useState<SpaceScene>(EMPTY_SCENE);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<"wall" | "block">("wall");
  const [blockCat, setBlockCat] = useState<BlockCategory | "all">("furniture");
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [planTool, setPlanTool] = useState<PlanTool>("select");
  const [generating, setGenerating] = useState(false);
  const [strictness, setStrictness] = useState(50);
  const [lengthInputM, setLengthInputM] = useState("");
  void workspaceSlug;

  const refresh = useCallback(() => setScene(getSpaceScene()), []);

  useEffect(() => {
    setStrictness(loadDetectStrictness());
    refresh();
    const on = () => refresh();
    window.addEventListener(SPACE_CHANGE_EVENT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(SPACE_CHANGE_EVENT, on);
      window.removeEventListener("storage", on);
    };
  }, [refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        setPlanTool("select");
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedWallId && editTarget === "wall") {
        e.preventDefault();
        setScene(removeWall(selectedWallId));
        setSelectedWallId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedWallId, editTarget]);

  const blocks = useMemo(
    () =>
      blockCat === "all" ? SPACE_BLOCKS : SPACE_BLOCKS.filter((b) => b.category === blockCat),
    [blockCat]
  );
  const selectedPlacement =
    scene.placements.find((p) => p.id === selectedPlacementId) ?? null;
  const selectedWall = scene.walls.find((w) => w.id === selectedWallId) ?? null;

  useEffect(() => {
    if (selectedWall) {
      setLengthInputM((wallLength(selectedWall) / 1000).toFixed(2));
    } else {
      setLengthInputM("");
    }
  }, [selectedWallId, selectedWall?.x1, selectedWall?.y1, selectedWall?.x2, selectedWall?.y2]);

  const onRegenerate = (tpl: RoomTemplateId) => {
    setGenerating(true);
    window.setTimeout(() => {
      setScene(regenerateWalls(tpl));
      setGenerating(false);
      setSelectedWallId(null);
      setView("2d");
    }, 600);
  };

  const onStrictnessChange = (v: number) => {
    setStrictness(v);
    saveDetectStrictness(v);
  };

  const onRedetect = async () => {
    if (!scene.floorPlanDataUrl || !scene.sourceKind || !scene.sourceFileName) {
      window.alert("请先在左侧上传平面图/PDF（需有底图才能调严格度重识）");
      return;
    }
    setGenerating(true);
    try {
      const result = await reimportFromPreview(
        scene.floorPlanDataUrl,
        scene.sourceKind,
        scene.sourceFileName,
        strictness
      );
      setScene(
        applyDetectedPlan({
          name: scene.sourceFileName,
          kind: scene.sourceKind,
          previewUrl: result.previewUrl,
          walls: result.walls,
          widthMm: result.widthMm,
          depthMm: result.depthMm,
          method: result.method,
          message: result.message,
          strictness: result.strictness,
        })
      );
      setSelectedWallId(null);
      setView("2d");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const applyWalls = (walls: SpaceScene["walls"], message?: string) => {
    setScene(setWalls(walls, message));
  };

  const applySelectedLength = () => {
    if (!selectedWall) return;
    const m = Number(lengthInputM);
    if (!Number.isFinite(m) || m <= 0) return;
    applyWalls(setWallLength(scene.walls, selectedWall.id, m * 1000, "center"), "已改墙长");
  };

  return (
    <>
      <PageHead title={`${scene.name} · 3D模型`} />
      <FsPageShell>
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-subtle bg-surface-1 px-3">
          <div className="flex min-w-0 items-center gap-1.5">
            {sidebarCollapsed && <AppSidebarToggleButton />}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-13 font-semibold text-primary">模型调整</span>
                <FsTag>{sourceLabel(scene.source)}</FsTag>
                {scene.detectMethod && <FsTag>{detectMethodLabel(scene.detectMethod)}</FsTag>}
                {generating && <FsTag>生成中…</FsTag>}
              </div>
              <div className="truncate text-11 text-tertiary" title={scene.detectMessage ?? undefined}>
                {scene.detectMessage ??
                  (scene.sourceFileName ? `来源 · ${scene.sourceFileName}` : scene.name)}
                {" · "}
                墙 {scene.walls.length} · H{(scene.wallHeightMm / 1000).toFixed(1)}m · 厚
                {scene.wallThicknessMm}mm
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex rounded-md border border-subtle p-0.5">
              <button
                type="button"
                onClick={() => setView("2d")}
                className={cn(
                  "rounded px-2.5 py-1 text-11 font-medium",
                  view === "2d" ? "bg-accent-primary text-on-color" : "text-secondary hover:bg-surface-2"
                )}
              >
                平面编辑
              </button>
              <button
                type="button"
                onClick={() => {
                  setView("3d");
                  setPlanTool("select");
                }}
                className={cn(
                  "rounded px-2.5 py-1 text-11 font-medium",
                  view === "3d" ? "bg-accent-primary text-on-color" : "text-secondary hover:bg-surface-2"
                )}
              >
                3D 墙体
              </button>
            </div>
            <FormscapeAiHeaderButton />
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-56 shrink-0 flex-col border-r border-subtle bg-surface-1">
            <div className="border-b border-subtle px-3 py-2">
              <div className="text-11 font-semibold text-placeholder">生成 / 调整</div>
              <FsMuted className="mt-0.5">PDF 矢量 / 图片识墙 · 平面可拉长画墙</FsMuted>
            </div>
            <div className="space-y-2 border-b border-subtle p-3">
              <div className="flex items-center justify-between text-11">
                <span className="text-tertiary">识墙严格度</span>
                <span className="font-medium text-primary">
                  {strictnessLabel(strictness)} · {strictness}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={strictness}
                disabled={generating}
                onChange={(e) => onStrictnessChange(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-placeholder">
                <span>宽松</span>
                <span>严格</span>
              </div>
              <button
                type="button"
                disabled={generating || !scene.floorPlanDataUrl}
                onClick={() => void onRedetect()}
                className="w-full rounded-md bg-accent-primary px-2 py-1.5 text-11 font-medium text-on-color disabled:cursor-not-allowed disabled:opacity-40"
              >
                按当前严格度重识墙
              </button>
              {!scene.floorPlanDataUrl && (
                <FsMuted>PDF 纯矢量无底图时请在 L2 重新上传并调严格度</FsMuted>
              )}

              <div className="pt-1 text-11 text-tertiary">墙高 / 默认墙厚</div>
              <label className="block">
                <span className="text-11 text-tertiary">墙高 mm</span>
                <input
                  type="number"
                  min={2200}
                  max={4000}
                  step={50}
                  className="mt-1 w-full rounded-md border border-subtle bg-surface-1 px-2 py-1.5 text-11"
                  value={scene.wallHeightMm}
                  onChange={(e) =>
                    setScene(setWallParams({ wallHeightMm: Number(e.target.value) || 2800 }))
                  }
                />
              </label>
              <label className="block">
                <span className="text-11 text-tertiary">默认墙厚 mm</span>
                <input
                  type="number"
                  min={80}
                  max={300}
                  step={10}
                  className="mt-1 w-full rounded-md border border-subtle bg-surface-1 px-2 py-1.5 text-11"
                  value={scene.wallThicknessMm}
                  onChange={(e) =>
                    setScene(setWallParams({ wallThicknessMm: Number(e.target.value) || 120 }))
                  }
                />
              </label>

              <div className="pt-1 text-11 text-tertiary">模板壳（覆盖识墙）</div>
              <div className="grid grid-cols-2 gap-1">
                {ROOM_TEMPLATES.filter((t) => t.id !== "empty").map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={generating}
                    onClick={() => onRegenerate(t.id)}
                    className="rounded-md border border-subtle px-2 py-1.5 text-left text-11 hover:border-accent-primary/40 disabled:opacity-50"
                  >
                    <div className="font-medium text-primary">{t.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-subtle px-2 py-2">
                <div className="mb-1.5 flex items-center gap-1 px-1 text-11 font-semibold text-placeholder">
                  <Layers className="size-3.5" />
                  图块（布局）
                </div>
                <div className="flex flex-wrap gap-1">
                  <CatChip active={blockCat === "all"} label="全" onClick={() => setBlockCat("all")} />
                  {BLOCK_CATEGORIES.map((c) => (
                    <CatChip
                      key={c.key}
                      active={blockCat === c.key}
                      label={c.label}
                      onClick={() => setBlockCat(c.key)}
                    />
                  ))}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <div className="grid grid-cols-2 gap-1.5">
                  {blocks.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        const next = addPlacement(b.id);
                        setScene(next);
                        const last = next.placements[next.placements.length - 1];
                        if (last) setSelectedPlacementId(last.id);
                        setEditTarget("block");
                        setPlanTool("select");
                        setView("2d");
                      }}
                      className="rounded-md border border-subtle p-1.5 text-left hover:border-accent-primary/40"
                    >
                      <div
                        className="mb-1 h-6 rounded-sm"
                        style={{ background: b.color, opacity: 0.85 }}
                      />
                      <span className="truncate text-[10px] font-medium text-primary">{b.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <div className="relative min-w-0 flex-1 bg-surface-2">
            {generating ? (
              <div className="flex h-full flex-col items-center justify-center gap-2">
                <BrickWall className="size-10 animate-pulse text-accent-primary" />
                <div className="text-13 font-medium text-primary">正在识墙并挤出 3D…</div>
                <FsMuted>PDF 矢量 / 图片扫描</FsMuted>
              </div>
            ) : view === "2d" ? (
              <SpacePlanViewport
                scene={scene}
                editTarget={editTarget}
                tool={planTool}
                selectedPlacementId={selectedPlacementId}
                selectedWallId={selectedWallId}
                onSelectPlacement={(id) => {
                  setSelectedPlacementId(id);
                  if (id) setEditTarget("block");
                }}
                onSelectWall={(id) => {
                  setSelectedWallId(id);
                  if (id) setEditTarget("wall");
                }}
                onMoveBlock={(id, x, y) => setScene(updatePlacement(id, { x, y }))}
                onWallsChange={(walls) => applyWalls(walls)}
                onAddWall={(x1, y1, x2, y2) => {
                  setScene(addWallSegment(x1, y1, x2, y2));
                  setEditTarget("wall");
                }}
                onToolChange={(t) => {
                  setPlanTool(t);
                  if (t === "draw-wall") setEditTarget("wall");
                }}
              />
            ) : (
              <SpaceWall3DViewport
                scene={scene}
                selectedWallId={selectedWallId}
                onSelectWall={(id) => {
                  setSelectedWallId(id);
                  setEditTarget("wall");
                }}
              />
            )}
          </div>

          <aside className="flex w-60 shrink-0 flex-col border-l border-subtle bg-surface-1">
            <div className="border-b border-subtle px-3 py-2 text-11 font-semibold text-placeholder">
              编辑
            </div>
            <div className="flex shrink-0 gap-1 border-b border-subtle p-2">
              <button
                type="button"
                onClick={() => setEditTarget("wall")}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-11 font-medium",
                  editTarget === "wall"
                    ? "bg-accent-primary text-on-color"
                    : "bg-surface-2 text-secondary"
                )}
              >
                墙段
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditTarget("block");
                  setPlanTool("select");
                }}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-11 font-medium",
                  editTarget === "block"
                    ? "bg-accent-primary text-on-color"
                    : "bg-surface-2 text-secondary"
                )}
              >
                图块
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto p-3">
              <label className="block">
                <span className="text-11 text-tertiary">名称</span>
                <input
                  className="mt-1 w-full rounded-md border border-subtle px-2 py-1.5 text-11"
                  value={scene.name}
                  onChange={(e) => setScene(setSpaceScene({ ...scene, name: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-11 text-tertiary">绑定项目</span>
                <select
                  className="mt-1 w-full rounded-md border border-subtle px-2 py-1.5 text-11"
                  value={scene.projectId ?? ""}
                  onChange={(e) => setScene(bindSceneProject(e.target.value || null))}
                >
                  <option value="">未绑定</option>
                  {PM_PROJECTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-md border border-subtle bg-surface-2/40 px-2.5 py-2 text-11">
                <div className="text-tertiary">尺寸</div>
                <div className="mt-0.5 font-medium text-primary">
                  {(scene.widthMm / 1000).toFixed(1)} × {(scene.depthMm / 1000).toFixed(1)} m
                </div>
                <div className="mt-1 text-tertiary">
                  墙 {scene.walls.length} · 图块 {scene.placements.length}
                </div>
                {scene.detectMethod && (
                  <div className="mt-1 text-accent-primary">
                    {detectMethodLabel(scene.detectMethod)} · 严格度{" "}
                    {scene.detectStrictness ?? strictness}
                  </div>
                )}
              </div>

              {editTarget === "wall" && (
                <>
                  {selectedWall ? (
                    <div className="space-y-2 rounded-md border border-accent-primary/30 bg-accent-subtle/30 p-2">
                      <div className="text-13 font-medium text-primary">已选墙段</div>
                      <div className="text-11 text-tertiary">
                        当前 {(wallLength(selectedWall) / 1000).toFixed(2)} m · 角{" "}
                        {wallAngleDeg(selectedWall).toFixed(0)}° · 厚 {selectedWall.thickness}mm
                      </div>

                      <label className="block">
                        <span className="text-11 text-tertiary">长度 m（中点拉伸）</span>
                        <div className="mt-1 flex gap-1">
                          <input
                            type="number"
                            min={0.1}
                            step={0.05}
                            className="w-full rounded-md border border-subtle bg-surface-1 px-2 py-1.5 text-11"
                            value={lengthInputM}
                            onChange={(e) => setLengthInputM(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") applySelectedLength();
                            }}
                          />
                          <button
                            type="button"
                            onClick={applySelectedLength}
                            className="shrink-0 rounded-md bg-accent-primary px-2 text-11 text-on-color"
                          >
                            应用
                          </button>
                        </div>
                      </label>

                      <div className="flex gap-1">
                        <button
                          type="button"
                          title="-100mm"
                          onClick={() =>
                            applyWalls(
                              nudgeWallLength(scene.walls, selectedWall.id, -100),
                              "缩短 0.1m"
                            )
                          }
                          className="inline-flex flex-1 items-center justify-center gap-0.5 rounded-md border border-subtle bg-surface-1 py-1.5 text-11"
                        >
                          <Minus className="size-3" />
                          0.1m
                        </button>
                        <button
                          type="button"
                          title="+100mm"
                          onClick={() =>
                            applyWalls(
                              nudgeWallLength(scene.walls, selectedWall.id, 100),
                              "拉长 0.1m"
                            )
                          }
                          className="inline-flex flex-1 items-center justify-center gap-0.5 rounded-md border border-subtle bg-surface-1 py-1.5 text-11"
                        >
                          <Plus className="size-3" />
                          0.1m
                        </button>
                        <button
                          type="button"
                          title="+500mm"
                          onClick={() =>
                            applyWalls(
                              nudgeWallLength(scene.walls, selectedWall.id, 500),
                              "拉长 0.5m"
                            )
                          }
                          className="inline-flex flex-1 items-center justify-center rounded-md border border-subtle bg-surface-1 py-1.5 text-11"
                        >
                          +0.5m
                        </button>
                      </div>

                      <label className="block">
                        <span className="text-11 text-tertiary">本段墙厚 mm</span>
                        <input
                          type="number"
                          min={40}
                          max={400}
                          step={10}
                          className="mt-1 w-full rounded-md border border-subtle bg-surface-1 px-2 py-1.5 text-11"
                          value={selectedWall.thickness}
                          onChange={(e) =>
                            applyWalls(
                              setWallThickness(
                                scene.walls,
                                selectedWall.id,
                                Number(e.target.value) || 120
                              )
                            )
                          }
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-1 text-[10px] text-tertiary">
                        <div>
                          A ({(selectedWall.x1 / 1000).toFixed(2)},{" "}
                          {(selectedWall.y1 / 1000).toFixed(2)})
                        </div>
                        <div>
                          B ({(selectedWall.x2 / 1000).toFixed(2)},{" "}
                          {(selectedWall.y2 / 1000).toFixed(2)})
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          applyWalls(splitWall(scene.walls, selectedWall.id, 0.5), "已从中点分割");
                          setSelectedWallId(null);
                        }}
                        className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-subtle bg-surface-1 py-1.5 text-11"
                      >
                        <Scissors className="size-3" />
                        中点分割
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScene(removeWall(selectedWall.id));
                          setSelectedWallId(null);
                        }}
                        className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-subtle bg-surface-1 py-1.5 text-11 text-danger-primary hover:bg-danger-subtle"
                      >
                        <Trash2 className="size-3" />
                        删除此墙段
                      </button>
                    </div>
                  ) : (
                    <FsMuted>
                      平面中：拖端点拉长 · 拖墙身平移 · 工具栏「画墙」链式绘制 · 3D 中点选同步
                    </FsMuted>
                  )}

                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setView("2d");
                        setPlanTool("draw-wall");
                        setEditTarget("wall");
                      }}
                      className="flex-1 rounded-md border border-subtle py-1.5 text-11 text-secondary hover:bg-surface-2"
                    >
                      画墙模式
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanTool("select")}
                      className="flex-1 rounded-md border border-subtle py-1.5 text-11 text-secondary hover:bg-surface-2"
                    >
                      选择模式
                    </button>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-11">
                      <span className="font-medium text-secondary">墙段列表</span>
                      <button
                        type="button"
                        className="text-danger-primary hover:underline"
                        onClick={() => {
                          if (window.confirm(`清空全部 ${scene.walls.length} 段墙？`)) {
                            setScene(clearWalls());
                            setSelectedWallId(null);
                          }
                        }}
                      >
                        清空
                      </button>
                    </div>
                    <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                      {scene.walls.map((w, i) => {
                        const len = wallLength(w);
                        const active = w.id === selectedWallId;
                        return (
                          <li key={w.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedWallId(w.id);
                                setEditTarget("wall");
                              }}
                              className={cn(
                                "flex w-full items-center justify-between rounded px-1.5 py-1 text-left text-[11px]",
                                active
                                  ? "bg-accent-subtle text-accent-primary"
                                  : "text-secondary hover:bg-surface-2"
                              )}
                            >
                              <span>
                                #{i + 1} {(len / 1000).toFixed(2)}m
                              </span>
                              <span
                                role="button"
                                tabIndex={0}
                                className="rounded px-1 text-danger-primary hover:bg-danger-subtle"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setScene(removeWall(w.id));
                                  if (selectedWallId === w.id) setSelectedWallId(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.stopPropagation();
                                    setScene(removeWall(w.id));
                                  }
                                }}
                              >
                                删
                              </span>
                            </button>
                          </li>
                        );
                      })}
                      {scene.walls.length === 0 && (
                        <li className="text-11 text-placeholder">无墙段 · 用画墙或上传识墙</li>
                      )}
                    </ul>
                  </div>
                </>
              )}

              {editTarget === "block" && (
                <>
                  {selectedPlacement ? (
                    <SelectedPanel
                      pl={selectedPlacement}
                      onRotate={() =>
                        setScene(
                          updatePlacement(selectedPlacement.id, {
                            rot: (selectedPlacement.rot + 90) % 360,
                          })
                        )
                      }
                      onRemove={() => {
                        setScene(removePlacement(selectedPlacement.id));
                        setSelectedPlacementId(null);
                      }}
                    />
                  ) : (
                    <FsMuted>点选图块可旋转/删除</FsMuted>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setScene(clearPlacements());
                      setSelectedPlacementId(null);
                    }}
                    className="w-full rounded-md border border-subtle py-1.5 text-11 text-secondary hover:bg-surface-2"
                  >
                    清空图块
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      </FsPageShell>
    </>
  );
}

function CatChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium",
        active ? "bg-accent-subtle text-accent-primary" : "bg-surface-2 text-tertiary"
      )}
    >
      {label}
    </button>
  );
}

function SelectedPanel({
  pl,
  onRotate,
  onRemove,
}: {
  pl: SpacePlacement;
  onRotate: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border border-subtle bg-surface-2/40 p-2">
      <div className="text-13 font-medium text-primary">{pl.label}</div>
      <div className="mt-0.5 text-11 text-tertiary">
        {(pl.wMm / 1000).toFixed(2)}×{(pl.dMm / 1000).toFixed(2)}m · {pl.rot}°
      </div>
      <div className="mt-2 flex gap-1">
        <button
          type="button"
          onClick={onRotate}
          className="inline-flex flex-1 items-center justify-center gap-0.5 rounded-md border border-subtle bg-surface-1 py-1 text-11"
        >
          <RotateCw className="size-3" />
          旋转
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex flex-1 items-center justify-center gap-0.5 rounded-md border border-subtle bg-surface-1 py-1 text-11 text-danger-primary"
        >
          <Trash2 className="size-3" />
          删除
        </button>
      </div>
    </div>
  );
}

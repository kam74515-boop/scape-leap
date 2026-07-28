/**
 * 七阶段工作区 — 需求 / 风格 / 建模 / AI渲染 / 材料 / 家具 / 施工
 * 三态 + 手动确认/回跳（流程权在人，AI 不自动推进）
 * 渲染 = mock 出图流程；材料/家具与生态库采购同源；施工报价由清单汇总驱动
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Check, Minus, Pencil, Plus, ShoppingCart, Trash2 } from "@/icons";
import { PageHead } from "@/components/core/page-title";
import { cn } from "@plane/utils";
import { StageTabs } from "./StageTabs";
import { isStageId, STAGES, type StageId } from "./types";
import {
  FsButton,
  FsCard,
  FsCardTitle,
  FsConfirm,
  FsField,
  FsModal,
  FsMuted,
  FsPageBody,
  FsPageShell,
  FsPageTitle,
  FsPrimaryLink,
  FsProgress,
  FsSectionLabel,
  FsSlider,
  FsSteps,
  FsTag,
  FsTextLink,
  fsInputClass,
} from "./ui";
import { useFormscapeProject } from "./use-formscape-project";
import { useProjectProgress } from "./use-project-progress";
import { stageStateLabel } from "./project-progress-store";
import { usePurchase } from "./use-purchase";
import {
  PURCHASE_STATUS_META,
  type PurchaseLine,
  type PurchaseStatus,
} from "./purchase-store";
import { ECO_PRODUCTS, ecoFallbackGradient, type EcoProduct } from "./ecology-mock";
import { CANVAS_SKILLS } from "./canvas/skills/registry";
import {
  getMockSkillBundle,
  listMockGallerySamples,
  pickMockResultSrcs,
} from "./canvas/skills/mock-skill-assets";
import { listAllStylePins } from "./style-boards-store";
import {
  useAdoptedRenders,
  useStyleStage,
  type StyleDirection,
  type StyleDirectionInput,
} from "./style-stage-store";
import { useConstruction } from "./construction-store";

type Props = {
  workspaceSlug: string;
  projectId: string;
  stageId: string;
};

const HOUSE_TYPES = ["平层", "复式", "别墅", "LOFT", "公寓", "商房"];
const FAMILIES = ["独居", "两口之家", "三口之家", "三代同堂"];

/** 材料行在同源采购 store 里的 productId 前缀（适配层，不改 store） */
const MATERIAL_PRODUCT_PREFIX = "mat-";

export function FormscapeStagesPage({ workspaceSlug, projectId, stageId }: Props) {
  const stage: StageId = isStageId(stageId) ? stageId : "requirements";
  const meta = STAGES.find((s) => s.id === stage)!;
  const { project, updateProfile } = useFormscapeProject(projectId);
  const { state, onEnterStage, onConfirmStage, onReopenStage } = useProjectProgress(projectId);
  const p = project.profile;
  const stageState = state.stageStates[stage];
  const isStale = state.staleStages.includes(stage);

  return (
    <>
      <PageHead title={`${project.name} · ${meta.label}`} />
      <FsPageShell>
        <FsPageBody>
          <div className="mb-3 space-y-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <FsPageTitle>{meta.label}</FsPageTitle>
                  <FsTag tone={stageState === "confirmed" ? "brand" : stageState === "in_progress" ? "warning" : "neutral"}>
                    {stageStateLabel(stageState)}
                  </FsTag>
                  {isStale && <FsTag tone="danger">上游有更新 · 建议复核</FsTag>}
                </div>
                <FsMuted className="mt-0.5">{meta.desc}</FsMuted>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {stageState === "not_started" ? (
                  <FsButton
                    size="sm"
                    onClick={() => {
                      onEnterStage(stage);
                      setToast({
                        type: TOAST_TYPE.SUCCESS,
                        title: `已开始「${meta.label}」`,
                        message: "阶段状态已更新为进行中",
                      });
                    }}
                  >
                    开始本阶段
                  </FsButton>
                ) : stageState === "in_progress" ? (
                  <FsButton
                    size="sm"
                    onClick={() => {
                      onConfirmStage(stage);
                      setToast({
                        type: TOAST_TYPE.SUCCESS,
                        title: `已确认「${meta.label}」`,
                        message: "焦点推进到下一未确认阶段（可随时回跳）",
                      });
                    }}
                  >
                    确认本阶段
                  </FsButton>
                ) : (
                  <FsButton size="sm" variant="secondary" onClick={() => onReopenStage(stage)}>
                    回跳重开
                  </FsButton>
                )}
              </div>
            </div>
            <StageTabs workspaceSlug={workspaceSlug} projectId={projectId} active={stage} />
          </div>
          <div className="w-full">
            {stage === "requirements" && (
              <FsCard className="space-y-5">
                <div>
                  <FsSectionLabel>客户（本项目）</FsSectionLabel>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FsField label="客户姓名">
                      <input
                        className={fsInputClass}
                        value={p.clientName || ""}
                        onChange={(e) => updateProfile({ clientName: e.target.value || undefined })}
                        placeholder="如 陈女士"
                      />
                    </FsField>
                    <FsField label="联系电话">
                      <input
                        className={fsInputClass}
                        value={p.clientPhone || ""}
                        onChange={(e) => updateProfile({ clientPhone: e.target.value || undefined })}
                      />
                    </FsField>
                    <FsField label="备注" className="sm:col-span-2">
                      <input
                        className={fsInputClass}
                        value={p.clientNote || ""}
                        onChange={(e) => updateProfile({ clientNote: e.target.value || undefined })}
                      />
                    </FsField>
                  </div>
                </div>
                <div>
                  <FsSectionLabel>房屋与预算</FsSectionLabel>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FsField label="房屋类型">
                      <select
                        className={fsInputClass}
                        value={p.houseType || ""}
                        onChange={(e) => updateProfile({ houseType: e.target.value || undefined })}
                      >
                        <option value="">请选择</option>
                        {HOUSE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </FsField>
                    <FsField label="面积 ㎡">
                      <input
                        type="number"
                        className={fsInputClass}
                        value={p.area ?? ""}
                        onChange={(e) => updateProfile({ area: e.target.value ? Number(e.target.value) : undefined })}
                      />
                    </FsField>
                    <FsField label="户型">
                      <input
                        className={fsInputClass}
                        value={p.rooms || ""}
                        onChange={(e) => updateProfile({ rooms: e.target.value || undefined })}
                        placeholder="两室两厅"
                      />
                    </FsField>
                    <FsField label="城市">
                      <input
                        className={fsInputClass}
                        value={p.city || ""}
                        onChange={(e) => updateProfile({ city: e.target.value || undefined })}
                      />
                    </FsField>
                    <FsField label="预算（万）">
                      <input
                        type="number"
                        className={fsInputClass}
                        value={p.budget ?? ""}
                        onChange={(e) => updateProfile({ budget: e.target.value ? Number(e.target.value) : undefined })}
                      />
                    </FsField>
                    <FsField label="家庭结构">
                      <select
                        className={fsInputClass}
                        value={p.family || ""}
                        onChange={(e) => updateProfile({ family: e.target.value || undefined })}
                      >
                        <option value="">请选择</option>
                        {FAMILIES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </FsField>
                    <FsField label="风格偏好">
                      <input
                        className={fsInputClass}
                        value={p.style || ""}
                        onChange={(e) => updateProfile({ style: e.target.value || undefined })}
                      />
                    </FsField>
                    <FsField label="时间线">
                      <input
                        className={fsInputClass}
                        value={p.timeline || ""}
                        onChange={(e) => updateProfile({ timeline: e.target.value || undefined })}
                      />
                    </FsField>
                  </div>
                </div>
                <FsMuted>修改自动保存到本地（前端-only）</FsMuted>
              </FsCard>
            )}

            {stage === "style" && <StyleStageSection projectId={projectId} />}

            {stage === "model" && (
              <FsCard className="space-y-3">
                <div>
                  <FsCardTitle>空间建模</FsCardTitle>
                  <FsMuted className="mt-0.5">
                    完整工作台在 L1「3D模型」：导入空间 / 平面识墙 / 图块布局
                  </FsMuted>
                </div>
                <FsPrimaryLink
                  to={`/${workspaceSlug}/space?project=${encodeURIComponent(projectId)}&mode=blocks`}
                >
                  打开 3D模型工作台 →
                </FsPrimaryLink>
                <FsMuted>确认本阶段前，请在 3D模型 完成墙体与图块布局并绑定本项目。</FsMuted>
              </FsCard>
            )}

            {stage === "render" && <RenderStageSection projectId={projectId} />}

            {stage === "materials" && <MaterialsStageSection projectId={projectId} project={project} workspaceSlug={workspaceSlug} />}

            {stage === "furniture" && (
              <ProjectFurniturePurchase
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                projectName={project.name}
              />
            )}

            {stage === "construction" && (
              <ConstructionStageSection projectId={projectId} />
            )}
          </div>
        </FsPageBody>
      </FsPageShell>
    </>
  );
}

/* ================================================================
 * 风格阶段 — 风格方向卡可编辑（增删改 · 图板导入 · 选定）
 * ================================================================ */

const EMPTY_DIR_FORM: StyleDirectionInput = {
  name: "",
  desc: "",
  colors: ["#E8E4DC", "#C9B8A0", "#5C5346"],
  image: undefined,
};

function StyleStageSection({ projectId }: { projectId: string }) {
  const { directions, selectedId, add, updateDir, remove, select } = useStyleStage(projectId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StyleDirection | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<StyleDirection | null>(null);
  const [form, setForm] = useState<StyleDirectionInput>(EMPTY_DIR_FORM);

  const pins = useMemo(
    () => listAllStylePins(projectId).filter((x) => !!x.src),
    // 打开导入弹窗时取最新
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, importOpen]
  );
  const sampleImages = useMemo(() => listMockGallerySamples().slice(0, 8), []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_DIR_FORM);
    setModalOpen(true);
  };
  const openEdit = (d: StyleDirection) => {
    setEditing(d);
    setForm({ name: d.name, desc: d.desc, colors: [...d.colors], image: d.image });
    setModalOpen(true);
  };
  const submit = () => {
    if (!form.name.trim()) {
      setToast({ type: TOAST_TYPE.ERROR, title: "请填写方向名称" });
      return;
    }
    if (editing) {
      updateDir(editing.id, form);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "风格方向已更新" });
    } else {
      add(form);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "已新建风格方向" });
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FsMuted>
          3-5 组方向对比 · 选定一组作为本阶段结论 · 客户确认后「确认本阶段」
        </FsMuted>
        <div className="flex gap-1.5">
          <FsButton size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
            从项目图板导入
          </FsButton>
          <FsButton size="sm" onClick={openCreate}>
            <Plus className="size-3.5" strokeWidth={1.75} />
            新建方向
          </FsButton>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {directions.map((d) => {
          const isSelected = selectedId === d.id;
          return (
            <FsCard
              key={d.id}
              className={cn("overflow-hidden p-0", isSelected && "border-accent-strong")}
            >
              {d.image ? (
                <img src={d.image} alt="" className="h-28 w-full object-cover" />
              ) : (
                <div
                  className="h-28"
                  style={{
                    background: `linear-gradient(135deg, ${d.colors[0] ?? "#eee"}, ${d.colors[1] ?? "#ddd"}, ${d.colors[2] ?? "#ccc"})`,
                  }}
                />
              )}
              <div className="p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="text-13 font-medium text-primary">{d.name}</div>
                  {isSelected && <FsTag tone="brand">已选定</FsTag>}
                </div>
                {d.desc && <div className="mt-1 text-11 text-tertiary">{d.desc}</div>}
                <div className="mt-2 flex items-center gap-1">
                  {d.colors.map((c, i) => (
                    <span
                      key={`${c}-${i}`}
                      className="size-4 rounded-full border border-subtle"
                      style={{ background: c }}
                      title={c}
                    />
                  ))}
                  <span className="ml-auto text-10 text-placeholder">{d.sourceLabel}</span>
                </div>
                <div className="mt-2.5 flex items-center gap-1">
                  {isSelected ? (
                    <FsButton size="sm" variant="secondary" onClick={() => select(null)}>
                      取消选定
                    </FsButton>
                  ) : (
                    <FsButton size="sm" onClick={() => select(d.id)}>
                      选定方向
                    </FsButton>
                  )}
                  <FsButton size="sm" variant="ghost" onClick={() => openEdit(d)} aria-label="编辑">
                    <Pencil className="size-3.5" strokeWidth={1.75} />
                  </FsButton>
                  <FsButton
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleting(d)}
                    aria-label="删除"
                    className="hover:text-danger-primary"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                  </FsButton>
                </div>
              </div>
            </FsCard>
          );
        })}
      </div>
      {directions.length === 0 && (
        <FsCard>
          <FsMuted>暂无风格方向 — 新建一组，或从项目图板导入意向图。</FsMuted>
        </FsCard>
      )}
      <FsMuted>Demo 数据 · 意向图取自内置样例池与项目图板</FsMuted>

      {/* 新建/编辑弹窗 */}
      <FsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "编辑风格方向" : "新建风格方向"}
        width="md"
        footer={
          <>
            <FsButton variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
              取消
            </FsButton>
            <FsButton size="sm" onClick={submit}>
              {editing ? "保存修改" : "创建方向"}
            </FsButton>
          </>
        }
      >
        <div className="space-y-3">
          <FsField label="方向名称">
            <input
              className={fsInputClass}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="如 奶油石材"
            />
          </FsField>
          <FsField label="一句话描述">
            <input
              className={fsInputClass}
              value={form.desc}
              onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
              placeholder="给客户讲得清的方向结论"
            />
          </FsField>
          <FsField label="色板（3 色）">
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((i) => (
                <input
                  key={i}
                  type="color"
                  value={form.colors[i] ?? "#E8E4DC"}
                  onChange={(e) =>
                    setForm((f) => {
                      const colors = [...f.colors];
                      colors[i] = e.target.value;
                      return { ...f, colors };
                    })
                  }
                  className="h-8 w-12 cursor-pointer rounded-md border border-subtle bg-surface-1"
                />
              ))}
            </div>
          </FsField>
          <FsField label="意向图（可选 · Demo 样例池）">
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, image: undefined }))}
                className={cn(
                  "flex h-14 items-center justify-center rounded-md border text-11 text-tertiary",
                  !form.image ? "border-accent-strong bg-accent-subtle" : "border-subtle"
                )}
              >
                纯色板
              </button>
              {sampleImages.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, image: s.src }))}
                  className={cn(
                    "h-14 overflow-hidden rounded-md border",
                    form.image === s.src ? "border-accent-strong ring-1 ring-accent-strong" : "border-subtle"
                  )}
                >
                  <img src={s.src} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          </FsField>
        </div>
      </FsModal>

      {/* 从项目图板导入 */}
      <FsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="从项目图板导入"
        width="md"
        footer={
          <FsButton variant="secondary" size="sm" onClick={() => setImportOpen(false)}>
            关闭
          </FsButton>
        }
      >
        {pins.length === 0 ? (
          <FsMuted>项目图板暂无带图 pin — 到生态库「加入图板」收集意向图。</FsMuted>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {pins.map((pin) => (
              <button
                key={pin.id}
                type="button"
                onClick={() => {
                  add({
                    name: pin.title,
                    desc: `来自项目图板 · ${pin.boardName}`,
                    colors: pin.colors ?? ["#E8E4DC", "#C9B8A0", "#5C5346"],
                    image: pin.src,
                    sourceLabel: `图板·${pin.boardName}`,
                  });
                  setToast({ type: TOAST_TYPE.SUCCESS, title: "已导入为风格方向", message: pin.title });
                  setImportOpen(false);
                }}
                className="overflow-hidden rounded-md border border-subtle text-left transition-transform hover:-translate-y-0.5"
              >
                <img src={pin.src} alt="" className="h-20 w-full object-cover" />
                <div className="px-2 py-1.5">
                  <div className="truncate text-11 font-medium text-primary">{pin.title}</div>
                  <div className="text-10 text-tertiary">{pin.boardName}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </FsModal>

      <FsConfirm
        open={!!deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            remove(deleting.id);
            setToast({ type: TOAST_TYPE.SUCCESS, title: "已删除风格方向", message: deleting.name });
          }
          setDeleting(null);
        }}
        title="删除风格方向？"
        body={deleting ? `「${deleting.name}」将从本阶段移除，不影响项目图板。` : undefined}
        confirmLabel="删除"
        danger
      />
    </div>
  );
}

/* ================================================================
 * AI 渲染阶段 — 选底图 → 选技能 → 参数 → mock 出图 → 采用为成果
 * ================================================================ */

type RenderBaseOption = { id: string; src: string; label: string; source: string };

function RenderStageSection({ projectId }: { projectId: string }) {
  const renderSkills = useMemo(
    () => CANVAS_SKILLS.filter((s) => s.uploads.some((u) => u.kind === "space")),
    []
  );
  const baseOptions = useMemo<RenderBaseOption[]>(() => {
    const whiteModel = getMockSkillBundle("white-model-rendering");
    const samples = (whiteModel?.inputs ?? []).slice(0, 3).map((src, i) => ({
      id: `wm-${i}`,
      src,
      label: `示例白模 ${i + 1}`,
      source: "示例",
    }));
    const pins = listAllStylePins(projectId)
      .filter((x) => !!x.src)
      .slice(0, 6)
      .map((x) => ({ id: x.id, src: x.src!, label: x.title, source: `图板·${x.boardName}` }));
    return [...samples, ...pins];
  }, [projectId]);

  const [baseSrc, setBaseSrc] = useState<string | null>(null);
  const [skillId, setSkillId] = useState<string | null>("white-model-rendering");
  const [strength, setStrength] = useState(65);
  const [count, setCount] = useState(2);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { adopted, adopt, remove } = useAdoptedRenders(projectId);

  const skill = renderSkills.find((s) => s.id === skillId) ?? null;

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => stopTimer, []);

  const start = () => {
    if (!baseSrc || !skill) return;
    setPhase("running");
    setProgress(0);
    setResults([]);
    setPicked([]);
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 3 + Math.random() * 7;
        if (next >= 100) {
          stopTimer();
          const srcs = pickMockResultSrcs({ skillId: skill.id, count });
          setResults(srcs);
          setPicked(srcs);
          setPhase("done");
          return 100;
        }
        return next;
      });
    }, 150);
  };

  const cancel = () => {
    stopTimer();
    setPhase("idle");
    setProgress(0);
  };

  const phaseText =
    progress < 30
      ? "解析空间结构"
      : progress < 65
        ? `保结构风格迁移 · 结构强度 ${strength}%`
        : progress < 92
          ? "细节与光影增强"
          : "整理出图";

  const stepIndex = !baseSrc ? 0 : phase === "idle" && results.length === 0 ? 1 : phase === "running" ? 3 : results.length ? 3 : 2;

  const togglePick = (src: string) => {
    setPicked((prev) => (prev.includes(src) ? prev.filter((s) => s !== src) : [...prev, src]));
  };

  const adoptPicked = () => {
    if (!picked.length || !skill) return;
    adopt(picked.map((src) => ({ src, skillId: skill.id, skillName: skill.name, strength })));
    setToast({
      type: TOAST_TYPE.SUCCESS,
      title: `已采用 ${picked.length} 张为本阶段成果`,
      message: "满意后点右上「确认本阶段」（AI 不自动推进）",
    });
    setPicked([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FsSteps
          steps={[
            { key: "base", label: "选底图" },
            { key: "skill", label: "选技能" },
            { key: "params", label: "参数" },
            { key: "gen", label: "生成出图" },
          ]}
          current={stepIndex}
        />
        <FsTag tone="ai">Demo 生成 · 未接真实生图 API</FsTag>
      </div>

      {/* 1 选底图 */}
      <FsCard>
        <FsCardTitle>1 · 选底图</FsCardTitle>
        <FsMuted className="mb-2.5 -mt-1">示例白模，或从项目图板取意向图（只读）</FsMuted>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {baseOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setBaseSrc(opt.src)}
              className={cn(
                "w-28 shrink-0 overflow-hidden rounded-md border text-left transition-transform hover:-translate-y-0.5",
                baseSrc === opt.src ? "border-accent-strong ring-1 ring-accent-strong" : "border-subtle"
              )}
            >
              <img src={opt.src} alt="" className="h-20 w-full object-cover" />
              <div className="px-1.5 py-1">
                <div className="truncate text-10 font-medium text-primary">{opt.label}</div>
                <div className="truncate text-10 text-tertiary">{opt.source}</div>
              </div>
            </button>
          ))}
        </div>
      </FsCard>

      {/* 2 选技能 */}
      <FsCard>
        <FsCardTitle>2 · 选技能</FsCardTitle>
        <FsMuted className="mb-2.5 -mt-1">复用画布技能库中适用渲染的空间类技能</FsMuted>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {renderSkills.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSkillId(s.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2 text-left transition-transform hover:-translate-y-0.5",
                skillId === s.id ? "border-accent-strong bg-accent-subtle" : "border-subtle bg-surface-1"
              )}
            >
              <span
                className="size-9 shrink-0 overflow-hidden rounded-md"
                style={{ background: `linear-gradient(135deg, ${s.colors[0]}, ${s.colors[1]})` }}
              >
                {s.coverSrc && <img src={s.coverSrc} alt="" className="size-full object-cover" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-12 font-medium text-primary">{s.name}</span>
                <span className="block truncate text-10 text-tertiary">{s.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </FsCard>

      {/* 3 参数 + 生成 */}
      <FsCard>
        <FsCardTitle>3 · 参数与生成</FsCardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex justify-between text-11 text-secondary">
              <span>结构强度（保留原空间结构）</span>
              <span className="font-medium text-primary tabular-nums">{strength}%</span>
            </div>
            <FsSlider
              min={0}
              max={100}
              value={strength}
              onChange={(e) => setStrength(Number(e.target.value))}
              disabled={phase === "running"}
            />
            <FsMuted className="mt-1">拖一下就能换严格度：越高越贴白模结构</FsMuted>
          </div>
          <div>
            <div className="mb-1 text-11 text-secondary">数量（最多 4 张并行）</div>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={phase === "running"}
                  onClick={() => setCount(n)}
                  className={cn(
                    "size-8 rounded-full border text-12 font-medium tabular-nums transition-colors",
                    count === n
                      ? "border-transparent bg-accent-primary text-on-color"
                      : "border-subtle text-secondary hover:bg-surface-2"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {phase !== "running" ? (
            <FsButton variant="ai" disabled={!baseSrc || !skill} onClick={start}>
              生成 {count} 张（Demo）
            </FsButton>
          ) : (
            <>
              <div className="min-w-40 flex-1">
                <FsProgress value={progress} />
                <div className="mt-1 text-11 text-tertiary">{phaseText} · {Math.round(progress)}%</div>
              </div>
              <FsButton variant="secondary" size="sm" onClick={cancel}>
                取消
              </FsButton>
            </>
          )}
          {!baseSrc && phase !== "running" && <FsMuted>先在上方选一张底图</FsMuted>}
        </div>
      </FsCard>

      {/* 4 结果 */}
      {results.length > 0 && (
        <FsCard>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <FsCardTitle className="mb-0">生成结果</FsCardTitle>
              <FsMuted className="mt-0.5">
                {skill?.name} · 结构强度 {strength}% · 点选后采用（Demo 图池取图）
              </FsMuted>
            </div>
            <FsButton size="sm" disabled={picked.length === 0} onClick={adoptPicked}>
              <Check className="size-3.5" strokeWidth={1.75} />
              采用为本阶段成果（{picked.length}）
            </FsButton>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {results.map((src) => {
              const on = picked.includes(src);
              return (
                <button
                  key={src}
                  type="button"
                  onClick={() => togglePick(src)}
                  className={cn(
                    "relative overflow-hidden rounded-md border transition-transform hover:-translate-y-0.5",
                    on ? "border-accent-strong ring-1 ring-accent-strong" : "border-subtle"
                  )}
                >
                  <img src={src} alt="" className="aspect-[4/3] w-full object-cover" />
                  <span
                    className={cn(
                      "absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full text-on-color",
                      on ? "bg-accent-primary" : "bg-black/30"
                    )}
                  >
                    {on && <Check className="size-3" strokeWidth={2} />}
                  </span>
                </button>
              );
            })}
          </div>
        </FsCard>
      )}

      {/* 阶段成果 */}
      <FsCard>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <FsCardTitle className="mb-0">本阶段成果（{adopted.length}）</FsCardTitle>
          <FsMuted>采用的效果图落到阶段资产 · 汇报 PPT 会自动取用</FsMuted>
        </div>
        {adopted.length === 0 ? (
          <FsMuted>暂无成果 — 生成并「采用」后出现在这里。</FsMuted>
        ) : (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {adopted.map((r) => (
              <div key={r.id} className="group relative overflow-hidden rounded-md border border-subtle">
                <img src={r.src} alt="" className="aspect-[4/3] w-full object-cover" />
                <div className="flex items-center justify-between px-1.5 py-1">
                  <span className="truncate text-10 text-tertiary">
                    {r.skillName} · {r.strength}%
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    className="rounded p-0.5 text-tertiary hover:bg-danger-subtle hover:text-danger-primary"
                    aria-label="移除成果"
                  >
                    <Trash2 className="size-3" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </FsCard>
    </div>
  );
}

/* ================================================================
 * 材料阶段 — 并入生态库采购同源（适配层，不改 purchase-store）
 * ================================================================ */

type ProjectMaterial = { id: string; name: string; category: string; brand: string; price: number };

function materialAsEcoProduct(m: ProjectMaterial): EcoProduct {
  return {
    id: `${MATERIAL_PRODUCT_PREFIX}${m.id}`,
    name: m.name,
    brand: m.brand,
    price: m.price,
    category: m.category,
    style: "",
    material: m.category,
    image: "",
  };
}

function isMaterialLine(l: PurchaseLine) {
  return l.productId.startsWith(MATERIAL_PRODUCT_PREFIX);
}

function MaterialsStageSection({
  projectId,
  project,
  workspaceSlug,
}: {
  projectId: string;
  project: ReturnType<typeof useFormscapeProject>["project"];
  workspaceSlug: string;
}) {
  const { projectLines, addProduct, setQty, setStatus, remove } = usePurchase(projectId);
  const materialLines = useMemo(() => projectLines.filter(isMaterialLine), [projectLines]);
  const lineByProduct = useMemo(() => {
    const map = new Map<string, PurchaseLine>();
    for (const l of materialLines) map.set(l.productId, l);
    return map;
  }, [materialLines]);
  const amount = materialLines.reduce((s, l) => s + l.price * l.qty, 0);

  return (
    <div className="space-y-3">
      <FsCard>
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <FsCardTitle>材料选材 · 同源清单</FsCardTitle>
            <FsMuted className="mt-0.5">
              与生态库「采购」同一状态机 · {materialLines.length} 项 · ¥{amount.toLocaleString("zh-CN")}
            </FsMuted>
          </div>
          <FsTextLink to={`/${workspaceSlug}/library?mode=purchase`}>全局采购清单 →</FsTextLink>
        </div>
        <div className="space-y-1.5">
          {project.materials.map((item) => {
            const line = lineByProduct.get(`${MATERIAL_PRODUCT_PREFIX}${item.id}`);
            const on = !!line;
            return (
              <div
                key={item.id}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border px-3 py-2.5 transition-colors",
                  on ? "border-accent-primary/30 bg-accent-subtle" : "border-subtle bg-surface-1"
                )}
              >
                <div>
                  <div className="text-13 font-medium text-primary">{item.name}</div>
                  <div className="text-11 text-tertiary">
                    {item.category} · {item.brand}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-13 font-medium text-secondary tabular-nums">
                    ¥{item.price.toLocaleString()}
                  </div>
                  {on ? (
                    <FsButton size="sm" variant="secondary" onClick={() => line && remove(line.id)}>
                      移出清单
                    </FsButton>
                  ) : (
                    <FsButton
                      size="sm"
                      onClick={() => {
                        addProduct(materialAsEcoProduct(item), { projectId, qty: 1 });
                        setToast({ type: TOAST_TYPE.SUCCESS, title: "已加入同源采购清单", message: item.name });
                      }}
                    >
                      加入清单
                    </FsButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </FsCard>

      {materialLines.length > 0 && (
        <FsCard>
          <FsCardTitle>已加入的材料行（可改数量 / 状态）</FsCardTitle>
          <ul className="divide-y divide-subtle rounded-md border border-subtle">
            {materialLines.map((line) => (
              <ProjectPurchaseRow key={line.id} line={line} onQty={setQty} onStatus={setStatus} onRemove={remove} />
            ))}
          </ul>
        </FsCard>
      )}
      <FsMuted>
        材料行已并入采购同源清单（施工报价按此汇总）· Demo 数据 · 未接真实下单
      </FsMuted>
    </div>
  );
}

/* ================================================================
 * 施工阶段 — 清单驱动报价 + 甘特 + 验收清单 + 变更留痕
 * ================================================================ */

/** Demo 市场价：按 productId 生成稳定的 +3%~+12% 市场参考价 */
function mockMarketPrice(productId: string, price: number): number {
  let h = 0;
  for (let i = 0; i < productId.length; i++) h = (h * 31 + productId.charCodeAt(i)) % 997;
  const pct = 3 + (h % 10); // 3..12
  return Math.round(price * (1 + pct / 100));
}

const GANTT_MILESTONES: { label: string; start: number; end: number }[] = [
  { label: "拆改进场", start: 0, end: 1.5 },
  { label: "水电改造", start: 1, end: 3.5 },
  { label: "泥木施工", start: 3, end: 6.5 },
  { label: "油漆涂装", start: 6, end: 8.5 },
  { label: "安装收尾", start: 8, end: 10 },
  { label: "软装进场", start: 9.5, end: 11.5 },
];
const GANTT_TOTAL_WEEKS = 12;

function ConstructionStageSection({ projectId }: { projectId: string }) {
  const { projectLines } = usePurchase(projectId);
  const { fee } = useProjectProgress(projectId);
  const { checklist, changes, toggle, addChange, removeChange } = useConstruction(projectId);
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeForm, setChangeForm] = useState({ title: "", note: "", amount: "" });
  const [removingChange, setRemovingChange] = useState<string | null>(null);

  const materialLines = projectLines.filter(isMaterialLine);
  const furnitureLines = projectLines.filter((l) => !isMaterialLine(l));
  const skuAmount = projectLines.reduce((s, l) => s + l.price * l.qty, 0);
  const savedAmount = projectLines.reduce(
    (s, l) => s + (mockMarketPrice(l.productId, l.price) - l.price) * l.qty,
    0
  );
  const designFee = Math.round(fee.designFeeWan * 10000);
  const changesAmount = changes.reduce((s, c) => s + c.amountDelta, 0);
  const total = skuAmount + designFee + changesAmount;
  const doneCount = checklist.filter((c) => c.done).length;

  const renderSkuRow = (l: PurchaseLine) => {
    const market = mockMarketPrice(l.productId, l.price);
    const diff = (market - l.price) * l.qty;
    return (
      <div key={l.id} className="flex flex-wrap items-center justify-between gap-1 py-1.5">
        <div className="min-w-0 flex-1">
          <span className="text-13 text-secondary">{l.name}</span>
          <span className="ml-1.5 text-11 text-placeholder">× {l.qty}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-11 text-placeholder line-through tabular-nums">
            市场 ¥{(market * l.qty).toLocaleString()}
          </span>
          {diff > 0 && <FsTag tone="success">省 ¥{diff.toLocaleString()}</FsTag>}
          <span className="w-20 text-right text-13 font-medium text-primary tabular-nums">
            ¥{(l.price * l.qty).toLocaleString()}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* 透明报价 */}
      <FsCard>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <FsCardTitle className="mb-0">透明报价 · 清单汇总驱动</FsCardTitle>
            <FsMuted className="mt-0.5">
              SKU 级明细来自同源采购清单 · 全程可追（Demo 数据）
            </FsMuted>
          </div>
          {savedAmount > 0 && <FsTag tone="success">较市场价共省 ¥{savedAmount.toLocaleString()}</FsTag>}
        </div>

        {materialLines.length > 0 && (
          <>
            <FsSectionLabel>材料（{materialLines.length} 项）</FsSectionLabel>
            <div className="divide-y divide-subtle">{materialLines.map(renderSkuRow)}</div>
          </>
        )}
        {furnitureLines.length > 0 && (
          <>
            <FsSectionLabel>家具（{furnitureLines.length} 项）</FsSectionLabel>
            <div className="divide-y divide-subtle">{furnitureLines.map(renderSkuRow)}</div>
          </>
        )}
        {projectLines.length === 0 && (
          <FsMuted>清单为空 — 到「材料选材 / 家具采买」阶段加入 SKU 后自动汇总。</FsMuted>
        )}

        <div className="mt-3 space-y-1.5 border-t border-subtle pt-2 text-13">
          <div className="flex justify-between text-secondary">
            <span>材料 + 家具小计</span>
            <span className="tabular-nums">¥{skuAmount.toLocaleString()}</span>
          </div>
          {/* 设计费独立高亮：设计的价值高于材料 */}
          <div className="flex items-center justify-between rounded-md bg-accent-subtle px-2.5 py-2 font-medium text-accent-secondary">
            <span>
              设计费（与经营节点同源）
              <span className="ml-1.5 text-10 font-normal opacity-80">设计的价值高于材料</span>
            </span>
            <span className="tabular-nums">¥{designFee.toLocaleString()}</span>
          </div>
          {changes.length > 0 && (
            <div className="flex justify-between text-secondary">
              <span>
                变更计价差异
                <FsTag tone="warning" className="ml-1.5">草稿 {changes.length}</FsTag>
              </span>
              <span className="tabular-nums">
                {changesAmount >= 0 ? "+" : "−"}¥{Math.abs(changesAmount).toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-subtle pt-2 text-14 font-semibold text-primary">
            <span>合计</span>
            <span className="tabular-nums">¥{total.toLocaleString()}</span>
          </div>
        </div>
        <div className="mt-2 text-10 text-placeholder">施工尺寸以实测为准 · 报价为演示数据</div>
      </FsCard>

      {/* 工期甘特 */}
      <FsCard>
        <FsCardTitle>工期时间线（简版）</FsCardTitle>
        <div className="space-y-1.5">
          {GANTT_MILESTONES.map((m, i) => (
            <div key={m.label} className="flex items-center gap-2">
              <div className="w-16 shrink-0 text-11 text-secondary">{m.label}</div>
              <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="absolute inset-y-0 rounded-full bg-accent-primary"
                  style={{
                    left: `${(m.start / GANTT_TOTAL_WEEKS) * 100}%`,
                    width: `${((m.end - m.start) / GANTT_TOTAL_WEEKS) * 100}%`,
                    opacity: 0.35 + 0.55 * (1 - i / GANTT_MILESTONES.length),
                  }}
                />
              </div>
              <div className="w-20 shrink-0 text-right text-10 text-tertiary tabular-nums">
                第 {m.start + 1}–{Math.ceil(m.end)} 周
              </div>
            </div>
          ))}
        </div>
        <FsMuted className="mt-2">共约 {GANTT_TOTAL_WEEKS} 周 · Demo 排期</FsMuted>
      </FsCard>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* 验收清单 */}
        <FsCard>
          <div className="mb-2 flex items-center justify-between">
            <FsCardTitle className="mb-0">验收清单</FsCardTitle>
            <FsTag tone={doneCount === checklist.length && checklist.length > 0 ? "success" : "neutral"}>
              {doneCount}/{checklist.length}
            </FsTag>
          </div>
          <div className="space-y-1">
            {checklist.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                  c.done ? "border-transparent bg-success-subtle" : "border-subtle hover:bg-surface-2"
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border",
                    c.done ? "border-transparent bg-success-primary text-on-color" : "border-strong"
                  )}
                >
                  {c.done && <Check className="size-3" strokeWidth={2} />}
                </span>
                <span className={cn("text-12", c.done ? "text-secondary line-through" : "text-primary")}>
                  {c.label}
                </span>
              </button>
            ))}
          </div>
        </FsCard>

        {/* 变更留痕 */}
        <FsCard>
          <div className="mb-2 flex items-center justify-between">
            <FsCardTitle className="mb-0">变更留痕</FsCardTitle>
            <FsButton size="sm" variant="secondary" onClick={() => setChangeOpen(true)}>
              <Plus className="size-3.5" strokeWidth={1.75} />
              新增变更
            </FsButton>
          </div>
          {changes.length === 0 ? (
            <FsMuted>暂无变更记录 — 现场调整请留痕，自动生成计价差异草稿行。</FsMuted>
          ) : (
            <div className="space-y-1.5">
              {changes.map((c) => (
                <div key={c.id} className="rounded-md border border-subtle px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-12 font-medium text-primary">{c.title}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={cn(
                          "text-12 font-medium tabular-nums",
                          c.amountDelta >= 0 ? "text-warning-primary" : "text-success-primary"
                        )}
                      >
                        {c.amountDelta >= 0 ? "+" : "−"}¥{Math.abs(c.amountDelta).toLocaleString()}
                      </span>
                      <FsTag tone="warning">草稿</FsTag>
                      <button
                        type="button"
                        onClick={() => setRemovingChange(c.id)}
                        className="rounded p-0.5 text-tertiary hover:bg-danger-subtle hover:text-danger-primary"
                        aria-label="删除变更"
                      >
                        <Trash2 className="size-3" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-0.5 text-10 text-tertiary">
                    {c.date}
                    {c.note ? ` · ${c.note}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </FsCard>
      </div>

      {/* 新增变更弹窗 */}
      <FsModal
        open={changeOpen}
        onClose={() => setChangeOpen(false)}
        title="新增变更（生成计价差异草稿行）"
        footer={
          <>
            <FsButton variant="secondary" size="sm" onClick={() => setChangeOpen(false)}>
              取消
            </FsButton>
            <FsButton
              size="sm"
              onClick={() => {
                if (!changeForm.title.trim()) {
                  setToast({ type: TOAST_TYPE.ERROR, title: "请填写变更内容" });
                  return;
                }
                addChange({
                  title: changeForm.title,
                  note: changeForm.note,
                  amountDelta: Number(changeForm.amount) || 0,
                });
                setToast({
                  type: TOAST_TYPE.SUCCESS,
                  title: "变更已留痕",
                  message: "计价差异已生成草稿行并计入报价合计",
                });
                setChangeForm({ title: "", note: "", amount: "" });
                setChangeOpen(false);
              }}
            >
              留痕并生成草稿行
            </FsButton>
          </>
        }
      >
        <div className="space-y-3">
          <FsField label="变更内容">
            <input
              className={fsInputClass}
              value={changeForm.title}
              onChange={(e) => setChangeForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="如 主卧增加一组定制柜"
            />
          </FsField>
          <FsField label="计价差异（元，减项填负数）">
            <input
              type="number"
              className={fsInputClass}
              value={changeForm.amount}
              onChange={(e) => setChangeForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="如 2600 或 -800"
            />
          </FsField>
          <FsField label="备注（可选）">
            <input
              className={fsInputClass}
              value={changeForm.note}
              onChange={(e) => setChangeForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="原因 / 客户确认方式 / 工期影响"
            />
          </FsField>
        </div>
      </FsModal>

      <FsConfirm
        open={!!removingChange}
        onCancel={() => setRemovingChange(null)}
        onConfirm={() => {
          if (removingChange) removeChange(removingChange);
          setRemovingChange(null);
        }}
        title="删除这条变更留痕？"
        body="对应的计价差异草稿行会一并移除。"
        confirmLabel="删除"
        danger
      />
    </div>
  );
}

/* ================================================================
 * 项目 · 家具采买 — 与生态库采购清单同一 store
 * ================================================================ */

function ProjectFurniturePurchase({
  workspaceSlug,
  projectId,
  projectName,
}: {
  workspaceSlug: string;
  projectId: string;
  projectName: string;
}) {
  const {
    projectLines: allProjectLines,
    projectScopeLines,
    addProduct,
    setQty,
    setStatus,
    claimToProject,
    remove,
    submitDrafts,
  } = usePurchase(projectId);
  const [showUnassigned, setShowUnassigned] = useState(false);
  // 家具视图排除材料适配行（材料在「材料选材」阶段管理）
  const projectLines = useMemo(() => allProjectLines.filter((l) => !isMaterialLine(l)), [allProjectLines]);
  const totals = useMemo(() => {
    const qty = projectLines.reduce((s, l) => s + l.qty, 0);
    const amount = projectLines.reduce((s, l) => s + l.price * l.qty, 0);
    const byStatus: Partial<Record<PurchaseStatus, number>> = {};
    for (const l of projectLines) byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
    return { qty, amount, byStatus };
  }, [projectLines]);
  const unassigned = useMemo(
    () => projectScopeLines.filter((l) => !l.projectId && !isMaterialLine(l)),
    [projectScopeLines]
  );

  /** Demo：推荐 SKU（未在本项目清单中的） */
  const recommendations = useMemo(() => {
    const have = new Set(projectLines.map((l) => l.productId));
    return ECO_PRODUCTS.filter((x) => !have.has(x.id)).slice(0, 6);
  }, [projectLines]);

  return (
    <div className="space-y-3">
      <FsCard>
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <FsCardTitle>家具采买 · 项目清单</FsCardTitle>
            <FsMuted className="mt-0.5">
              与生态库「采购」同源 · {projectName} · {totals.qty} 件 · ¥
              {totals.amount.toLocaleString("zh-CN")}
            </FsMuted>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <FsTextLink to={`/${workspaceSlug}/library?mode=purchase`}>全局采购清单 →</FsTextLink>
            <FsPrimaryLink to={`/${workspaceSlug}/library?mode=products`}>
              去生态库选品 →
            </FsPrimaryLink>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          <FsTag>待选 {totals.byStatus.draft ?? 0}</FsTag>
          <FsTag tone="brand">询价 {totals.byStatus.quoted ?? 0}</FsTag>
          <FsTag tone="success">下单 {totals.byStatus.ordered ?? 0}</FsTag>
          <FsTag tone="success">到货 {totals.byStatus.arrived ?? 0}</FsTag>
        </div>

        {projectLines.length === 0 ? (
          <div className="rounded-md border border-dashed border-subtle px-3 py-10 text-center">
            <div className="text-13 text-tertiary">本项目暂无采购行</div>
            <FsMuted className="mt-1">从生态库加购并绑定本项目，或认领未归属行</FsMuted>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <FsPrimaryLink to={`/${workspaceSlug}/library?mode=products`}>打开生态库</FsPrimaryLink>
              {unassigned.length > 0 && (
                <FsButton size="sm" variant="secondary" onClick={() => setShowUnassigned(true)}>
                  认领未归属（{unassigned.length}）
                </FsButton>
              )}
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-subtle rounded-md border border-subtle">
            {projectLines.map((line) => (
              <ProjectPurchaseRow
                key={line.id}
                line={line}
                onQty={setQty}
                onStatus={setStatus}
                onRemove={remove}
              />
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <FsButton
            size="sm"
            disabled={(totals.byStatus.draft ?? 0) === 0}
            onClick={() => {
              submitDrafts(projectId);
              setToast({ type: TOAST_TYPE.SUCCESS, title: "已提交询价", message: "Demo 状态流转 · 未接真实下单" });
            }}
          >
            提交本项目询价
          </FsButton>
          {unassigned.length > 0 && (
            <FsButton size="sm" variant="secondary" onClick={() => setShowUnassigned((v) => !v)}>
              {showUnassigned ? "收起" : "显示"}未归属（{unassigned.length}）
            </FsButton>
          )}
        </div>
      </FsCard>

      {showUnassigned && unassigned.length > 0 && (
        <FsCard>
          <FsCardTitle>未归属 · 可认领到本项目</FsCardTitle>
          <FsMuted className="mb-2">生态库加购时未绑项目的行</FsMuted>
          <ul className="space-y-1.5">
            {unassigned.map((line) => (
              <li
                key={line.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-subtle px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-13 font-medium text-primary">{line.name}</div>
                  <div className="text-11 text-tertiary">
                    {line.brand} · ¥{line.price.toLocaleString()} × {line.qty}
                  </div>
                </div>
                <FsButton size="sm" onClick={() => claimToProject(line.id)}>
                  认领
                </FsButton>
              </li>
            ))}
          </ul>
        </FsCard>
      )}

      <FsCard>
        <FsCardTitle>推荐加购（生态库）</FsCardTitle>
        <FsMuted className="mb-2">一键加入本项目清单 · 与全局采购同源</FsMuted>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {recommendations.map((x) => (
            <RecommendCard
              key={x.id}
              product={x}
              onAdd={() => addProduct(x, { projectId, qty: 1 })}
            />
          ))}
        </div>
      </FsCard>
    </div>
  );
}

function ProjectPurchaseRow({
  line,
  onQty,
  onStatus,
  onRemove,
}: {
  line: PurchaseLine;
  onQty: (id: string, qty: number) => void;
  onStatus: (id: string, status: PurchaseStatus) => void;
  onRemove: (id: string) => void;
}) {
  const meta = PURCHASE_STATUS_META[line.status];
  return (
    <li className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
      <div
        className="size-12 shrink-0 rounded-md bg-surface-2"
        style={{ background: line.image ? undefined : ecoFallbackGradient(line.productId) }}
      >
        {line.image ? (
          <img
            src={line.image}
            alt=""
            className="size-12 rounded-md object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-13 font-medium text-primary">{line.name}</div>
        <div className="text-11 text-tertiary">
          {line.brand} · {line.category} · ¥{line.price.toLocaleString()}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <select
            className="h-7 rounded-md border border-subtle bg-surface-1 px-1.5 text-11 text-secondary"
            value={line.status}
            onChange={(e) => onStatus(line.id, e.target.value as PurchaseStatus)}
          >
            {(Object.keys(PURCHASE_STATUS_META) as PurchaseStatus[]).map((st) => (
              <option key={st} value={st}>
                {PURCHASE_STATUS_META[st].label}
              </option>
            ))}
          </select>
          <FsTag>{meta.label}</FsTag>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center rounded-full border border-subtle">
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-l-full text-secondary hover:bg-surface-2"
            onClick={() => onQty(line.id, line.qty - 1)}
          >
            <Minus className="size-3" strokeWidth={1.75} />
          </button>
          <span className="w-7 text-center text-11 font-medium tabular-nums">{line.qty}</span>
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-r-full text-secondary hover:bg-surface-2"
            onClick={() => onQty(line.id, line.qty + 1)}
          >
            <Plus className="size-3" strokeWidth={1.75} />
          </button>
        </div>
        <div className="w-16 text-right text-13 font-semibold text-primary tabular-nums">
          ¥{(line.price * line.qty).toLocaleString()}
        </div>
        <button
          type="button"
          onClick={() => onRemove(line.id)}
          className="rounded-full p-1.5 text-tertiary hover:bg-danger-subtle hover:text-danger-primary"
        >
          <Trash2 className="size-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </li>
  );
}

function RecommendCard({ product, onAdd }: { product: EcoProduct; onAdd: () => void }) {
  return (
    <div className="flex flex-col rounded-lg border border-subtle bg-surface-1 p-2 transition-transform hover:-translate-y-0.5">
      <div
        className="mb-2 h-20 rounded-md bg-surface-2 object-cover"
        style={{ background: ecoFallbackGradient(product.id) }}
      >
        {product.image ? (
          <img
            src={product.image}
            alt=""
            className="h-20 w-full rounded-md object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
      </div>
      <div className="line-clamp-2 text-11 font-medium text-primary">{product.name}</div>
      <div className="mt-0.5 text-11 text-tertiary">{product.brand}</div>
      <div className="mt-2 flex items-center justify-between gap-1">
        <span className="text-13 font-semibold text-primary tabular-nums">
          ¥{product.price.toLocaleString("zh-CN")}
        </span>
        <FsButton size="sm" onClick={onAdd}>
          <ShoppingCart className="size-3" strokeWidth={1.75} />
          加购
        </FsButton>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Minus, Plus, ShoppingCart, Trash2 } from "@/icons";
import { PageHead } from "@/components/core/page-title";
import { StageTabs } from "./StageTabs";
import { isStageId, STAGES, type StageId } from "./types";
import {
  FsCard,
  FsCardTitle,
  FsEmpty,
  FsField,
  FsMuted,
  FsPageBody,
  FsPageShell,
  FsPrimaryLink,
  FsSectionLabel,
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
import { getPurchaseTotalsForProject } from "./purchase-store";
import { cn } from "@plane/utils";

type Props = {
  workspaceSlug: string;
  projectId: string;
  stageId: string;
};

const HOUSE_TYPES = ["平层", "复式", "别墅", "LOFT", "公寓", "商房"];
const FAMILIES = ["独居", "两口之家", "三口之家", "三代同堂"];

export function FormscapeStagesPage({ workspaceSlug, projectId, stageId }: Props) {
  const stage: StageId = isStageId(stageId) ? stageId : "requirements";
  const meta = STAGES.find((s) => s.id === stage)!;
  const { project, updateProfile, setStage, togglePurchase } = useFormscapeProject();
  const { state, onEnterStage, onConfirmStage, onReopenStage } = useProjectProgress(projectId);
  const p = project.profile;
  const stageState = state.stageStates[stage];
  const isStale = state.staleStages.includes(stage);

  useEffect(() => {
    if (project.stage !== stage) setStage(stage);
    onEnterStage(stage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, projectId]);

  return (
    <>
      <PageHead title={`${project.name} · ${meta.label}`} />
      <FsPageShell>
        <FsPageBody>
          <div className="mb-3 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-13 font-semibold text-primary">{meta.label}</div>
                  <FsTag>{stageStateLabel(stageState)}</FsTag>
                  {isStale && (
                    <span className="rounded-sm bg-danger-subtle px-1.5 py-0.5 text-11 font-medium text-danger-primary">
                      上游有更新 · 建议复核
                    </span>
                  )}
                </div>
                <FsMuted className="mt-0.5">{meta.desc}</FsMuted>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {stageState !== "confirmed" ? (
                  <button
                    type="button"
                    onClick={() => onConfirmStage(stage)}
                    className="rounded-md bg-accent-primary px-2.5 py-1 text-11 font-medium text-on-color"
                  >
                    确认本阶段
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onReopenStage(stage)}
                    className="rounded-md border border-subtle px-2.5 py-1 text-11 font-medium text-secondary hover:bg-surface-2"
                  >
                    回跳重开
                  </button>
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

            {stage === "style" && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {project.moodboard.map((card) => (
                  <FsCard key={card.id} className="overflow-hidden p-0">
                    <div
                      className="h-28"
                      style={{
                        background: `linear-gradient(135deg, ${card.colors[0]}, ${card.colors[1]}, ${card.colors[2]})`,
                      }}
                    />
                    <div className="p-3">
                      <div className="text-13 font-medium text-primary">{card.title}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {card.tags.map((t) => (
                          <span key={t} className="rounded-sm bg-surface-2 px-1.5 py-0.5 text-11 text-tertiary">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </FsCard>
                ))}
              </div>
            )}

            {stage === "model" && (
              <FsCard className="space-y-3">
                <div>
                  <FsCardTitle>空间建模</FsCardTitle>
                  <FsMuted className="mt-0.5">
                    完整工作台在 L1「3D模型」：导入空间 / 平面识墙 / 图块布局
                  </FsMuted>
                </div>
                <FsPrimaryLink to={`/${workspaceSlug}/space?mode=blocks`}>
                  打开 3D模型工作台 →
                </FsPrimaryLink>
                <FsEmpty
                  title="阶段内摘要"
                  body="确认本阶段前，请在 3D模型 完成墙体与图块布局并绑定本项目。"
                />
              </FsCard>
            )}

            {stage === "render" && (
              <FsEmpty title="AI 渲染" body="从白模截图 → 选技能/参数 → 异步出图。前端-only 阶段展示流程壳。" />
            )}

            {stage === "materials" && (
              <div className="space-y-1.5">
                {project.materials.map((item) => {
                  const on = project.purchaseIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => togglePurchase(item.id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left transition-colors",
                        on
                          ? "border-accent-primary/30 bg-accent-subtle"
                          : "border-subtle bg-surface-1 hover:bg-surface-2"
                      )}
                    >
                      <div>
                        <div className="text-13 font-medium text-primary">{item.name}</div>
                        <div className="text-11 text-tertiary">
                          {item.category} · {item.brand}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-13 font-medium text-secondary">¥{item.price.toLocaleString()}</div>
                        <div className={cn("text-11", on ? "text-accent-primary" : "text-tertiary")}>
                          {on ? "已加入" : "加入清单"}
                        </div>
                      </div>
                    </button>
                  );
                })}
                <FsMuted className="pt-1">材料选材仍用项目本地清单 · 家具采买已与生态库采购同源</FsMuted>
              </div>
            )}

            {stage === "furniture" && (
              <ProjectFurniturePurchase
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                projectName={project.name}
              />
            )}

            {stage === "construction" && (
              <div className="space-y-3">
                <FsCard>
                  <FsCardTitle>透明报价（示意）</FsCardTitle>
                  <FsMuted className="mb-3">设计费是一等公民 · 家具采买读生态库同源清单</FsMuted>
                  <QuoteLines project={project} projectId={projectId} />
                </FsCard>
                <FsEmpty title="工期节点" body="Checklist 与变更留痕可映射 Cycle / Work items。" />
              </div>
            )}
          </div>
        </FsPageBody>
      </FsPageShell>
    </>
  );
}

function QuoteLines({
  project,
  projectId,
}: {
  project: ReturnType<typeof useFormscapeProject>["project"];
  projectId: string;
}) {
  const materials = project.materials.filter((m) => project.purchaseIds.includes(m.id));
  const materialsTotal = materials.reduce((s, i) => s + i.price, 0);
  const furniture = getPurchaseTotalsForProject(projectId);
  const designFee = Math.round((project.profile.area || 0) * 280);
  return (
    <div className="space-y-1.5 text-13">
      {materials.map((i) => (
        <div key={i.id} className="flex justify-between text-secondary">
          <span>{i.name}</span>
          <span className="font-mono text-11">¥{i.price.toLocaleString()}</span>
        </div>
      ))}
      <div className="flex justify-between text-secondary">
        <span>家具采买（生态库同源 · {furniture.qty} 件）</span>
        <span className="font-mono text-11">¥{furniture.amount.toLocaleString()}</span>
      </div>
      <div className="border-t border-subtle pt-2" />
      <div className="flex justify-between text-secondary">
        <span>材料 + 家具小计</span>
        <span className="font-mono text-11">¥{(materialsTotal + furniture.amount).toLocaleString()}</span>
      </div>
      <div className="flex justify-between font-medium text-primary">
        <span>设计费（示意）</span>
        <span className="font-mono text-11">¥{designFee.toLocaleString()}</span>
      </div>
      <div className="flex justify-between text-13 font-semibold text-primary">
        <span>合计</span>
        <span className="font-mono">
          ¥{(materialsTotal + furniture.amount + designFee).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

/** 项目 · 家具采买 — 与生态库采购清单同一 store */
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
    projectLines,
    projectScopeLines,
    totals,
    addProduct,
    setQty,
    setStatus,
    claimToProject,
    remove,
    submitDrafts,
  } = usePurchase(projectId);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const unassigned = useMemo(
    () => projectScopeLines.filter((l) => !l.projectId),
    [projectScopeLines]
  );

  /** Demo：推荐 SKU（未在本项目清单中的） */
  const recommendations = useMemo(() => {
    const have = new Set(projectLines.map((l) => l.productId));
    return ECO_PRODUCTS.filter((p) => !have.has(p.id)).slice(0, 6);
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
          <div className="flex flex-wrap gap-1.5">
            <FsTextLink to={`/${workspaceSlug}/library?mode=purchase`}>全局采购清单 →</FsTextLink>
            <FsPrimaryLink to={`/${workspaceSlug}/library?mode=products`}>
              去生态库选品 →
            </FsPrimaryLink>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          <FsTag>待选 {totals.byStatus.draft ?? 0}</FsTag>
          <FsTag>询价 {totals.byStatus.quoted ?? 0}</FsTag>
          <FsTag>下单 {totals.byStatus.ordered ?? 0}</FsTag>
          <FsTag>到货 {totals.byStatus.arrived ?? 0}</FsTag>
        </div>

        {projectLines.length === 0 ? (
          <div className="rounded-md border border-dashed border-subtle px-3 py-10 text-center">
            <div className="text-13 text-tertiary">本项目暂无采购行</div>
            <FsMuted className="mt-1">从生态库加购并绑定本项目，或认领未归属行</FsMuted>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Link
                to={`/${workspaceSlug}/library?mode=products`}
                className="rounded-md bg-accent-primary px-2.5 py-1 text-11 font-medium text-on-color"
              >
                打开生态库
              </Link>
              {unassigned.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowUnassigned(true)}
                  className="rounded-md border border-subtle px-2.5 py-1 text-11 font-medium text-secondary"
                >
                  认领未归属（{unassigned.length}）
                </button>
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
          <button
            type="button"
            disabled={(totals.byStatus.draft ?? 0) === 0}
            onClick={() => submitDrafts(projectId)}
            className={cn(
              "rounded-md px-2.5 py-1 text-11 font-medium",
              (totals.byStatus.draft ?? 0) === 0
                ? "cursor-not-allowed bg-surface-2 text-placeholder"
                : "bg-accent-primary text-on-color"
            )}
          >
            提交本项目询价
          </button>
          {unassigned.length > 0 && (
            <button
              type="button"
              onClick={() => setShowUnassigned((v) => !v)}
              className="rounded-md border border-subtle px-2.5 py-1 text-11 font-medium text-secondary hover:bg-surface-2"
            >
              {showUnassigned ? "收起" : "显示"}未归属（{unassigned.length}）
            </button>
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
                <button
                  type="button"
                  onClick={() => claimToProject(line.id)}
                  className="rounded-md bg-accent-primary px-2.5 py-1 text-11 font-medium text-on-color"
                >
                  认领
                </button>
              </li>
            ))}
          </ul>
        </FsCard>
      )}

      <FsCard>
        <FsCardTitle>推荐加购（生态库）</FsCardTitle>
        <FsMuted className="mb-2">一键加入本项目清单 · 与全局采购同源</FsMuted>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {recommendations.map((p) => (
            <RecommendCard
              key={p.id}
              product={p}
              onAdd={() => addProduct(p, { projectId, qty: 1 })}
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
          <span className="rounded-sm bg-surface-2 px-1.5 py-0.5 text-[10px] text-tertiary">
            {meta.label}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center rounded-md border border-subtle">
          <button
            type="button"
            className="flex size-7 items-center justify-center text-secondary hover:bg-surface-2"
            onClick={() => onQty(line.id, line.qty - 1)}
          >
            <Minus className="size-3" />
          </button>
          <span className="w-7 text-center text-11 font-medium">{line.qty}</span>
          <button
            type="button"
            className="flex size-7 items-center justify-center text-secondary hover:bg-surface-2"
            onClick={() => onQty(line.id, line.qty + 1)}
          >
            <Plus className="size-3" />
          </button>
        </div>
        <div className="w-16 text-right text-13 font-semibold text-primary">
          ¥{(line.price * line.qty).toLocaleString()}
        </div>
        <button
          type="button"
          onClick={() => onRemove(line.id)}
          className="rounded-md p-1.5 text-tertiary hover:bg-danger-subtle hover:text-danger-primary"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </li>
  );
}

function RecommendCard({ product, onAdd }: { product: EcoProduct; onAdd: () => void }) {
  return (
    <div className="flex flex-col rounded-md border border-subtle bg-surface-1 p-2">
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
        <span className="text-13 font-semibold text-primary">
          ¥{product.price.toLocaleString("zh-CN")}
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-0.5 rounded-md bg-accent-primary px-2 py-1 text-11 font-medium text-on-color"
        >
          <ShoppingCart className="size-3" />
          加购
        </button>
      </div>
    </div>
  );
}

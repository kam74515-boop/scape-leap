/**
 * 项目 · 汇报 PPT — 三模板（业主汇报 / 内部评审 / 施工交底）
 * 用本项目真实成果、清单与进度组装分页预览，并导出可编辑 PPTX。
 */
import { useMemo, useState } from "react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Download } from "@/icons";
import { PageHead } from "@/components/core/page-title";
import { cn } from "@plane/utils";
import { STAGES } from "./types";
import { useFormscapeProject } from "./use-formscape-project";
import { useProjectProgress } from "./use-project-progress";
import { usePurchase } from "./use-purchase";
import { useAdoptedRenders, useStyleStage } from "./style-stage-store";
import { useConstruction } from "./construction-store";
import { addProjectFile } from "./files-store";
import { buildProjectPptx, downloadBlob } from "./ppt-export";
import { FsButton, FsCard, FsMuted, FsPageBody, FsPageShell, FsPageTitle, FsSecondaryLink, FsTag } from "./ui";

type Props = { workspaceSlug: string; projectId: string };

type TemplateId = "owner" | "internal" | "handover";

const TEMPLATES: { id: TemplateId; name: string; desc: string }[] = [
  { id: "owner", name: "业主汇报", desc: "讲结论：风格方向 · 效果图 · 报价与下一步" },
  { id: "internal", name: "内部评审", desc: "讲依据：阶段进度 · 方案对比 · 风险与任务" },
  { id: "handover", name: "施工交底", desc: "讲落地：清单明细 · 工期 · 验收与变更" },
];

type SlideModel = {
  id: string;
  title: string;
  bullets: string[];
  images?: string[];
  accent?: boolean;
};

export function FormscapePptPage({ workspaceSlug, projectId }: Props) {
  const { project } = useFormscapeProject(projectId);
  const { state, fee, design } = useProjectProgress(projectId);
  const { projectLines, totals } = usePurchase(projectId);
  const { adopted } = useAdoptedRenders(projectId);
  const { directions, selectedId } = useStyleStage(projectId);
  const { checklist, changes } = useConstruction(projectId);
  const base = `/${workspaceSlug}/projects/${projectId}`;

  const [template, setTemplate] = useState<TemplateId>("owner");
  const [outline, setOutline] = useState<string[] | null>(null);
  const [exporting, setExporting] = useState(false);

  const selectedDirection = directions.find((d) => d.id === selectedId) ?? directions[0];
  const renderImages = adopted.map((r) => r.src);
  const styleImages = directions.map((d) => d.image).filter((x): x is string => !!x);
  const focusMeta = STAGES.find((s) => s.id === state.focusStage);
  const designFee = Math.round(fee.designFeeWan * 10000);

  const slides = useMemo<SlideModel[]>(() => {
    const p = project.profile;
    const cover: SlideModel = {
      id: "cover",
      title: project.name,
      bullets: [
        [p.city, p.houseType, p.rooms, p.area ? `${p.area}㎡` : null].filter(Boolean).join(" · ") || "项目档案待完善",
        p.clientName ? `客户 · ${p.clientName}` : "客户待补充",
      ],
      images: renderImages.slice(0, 1).length ? renderImages.slice(0, 1) : styleImages.slice(0, 1),
      accent: true,
    };
    if (template === "owner") {
      return [
        cover,
        {
          id: "style",
          title: "风格方向",
          bullets: [
            selectedDirection ? `选定 · ${selectedDirection.name}` : "方向待选定",
            selectedDirection?.desc ?? "在「风格设计」阶段维护 3-5 组方向",
          ],
          images: styleImages.slice(0, 3),
        },
        {
          id: "render",
          title: renderImages.length ? "效果图（阶段成果）" : "效果图（下一阶段）",
          bullets: renderImages.length
            ? [`已采用 ${renderImages.length} 张阶段成果`]
            : ["当前方案方向已就绪，效果图待生成", "在「AI 渲染」采用成果后，本页将自动补齐"],
          images: renderImages.slice(0, 4),
        },
        {
          id: "list",
          title: "选材与清单",
          bullets: [
            `清单 ${projectLines.length} 项 · 共 ${totals.qty} 件`,
            `材料家具小计 ¥${totals.amount.toLocaleString()}`,
          ],
        },
        {
          id: "quote",
          title: "报价确认",
          bullets: [
            `设计费 ¥${designFee.toLocaleString()}（设计的价值高于材料）`,
            `合计（含清单）¥${(totals.amount + designFee).toLocaleString()}`,
            "施工尺寸以实测为准",
          ],
          accent: true,
        },
        {
          id: "next",
          title: "下一步",
          bullets: [
            `当前设计完成度 · ${design.pct}%`,
            `设计焦点 · ${focusMeta?.label ?? "—"}`,
            "本轮确认后推进下一阶段",
          ],
        },
      ];
    }
    if (template === "internal") {
      return [
        cover,
        {
          id: "progress",
          title: "阶段进度",
          bullets: [
            `设计阶段确认 ${design.confirmed}/${design.total}（${design.pct}%）`,
            design.staleCount > 0 ? `${design.staleCount} 个下游阶段被标记过期，需复核` : "无过期阶段",
            `焦点 · ${focusMeta?.label ?? "—"}`,
          ],
        },
        {
          id: "compare",
          title: "方案对比",
          bullets: directions.slice(0, 3).map((d) => `${d.name} — ${d.desc || "待补充描述"}`),
          images: styleImages.slice(0, 3),
        },
        {
          id: "render",
          title: "渲染批次评审",
          bullets: [renderImages.length ? `本批 ${renderImages.length} 张待评审` : "暂无采用成果"],
          images: renderImages.slice(0, 4),
        },
        {
          id: "risk",
          title: "风险与任务",
          bullets: [`变更留痕 ${changes.length} 条（草稿）`, `设计费已收 ${fee.collectedWan} / ${fee.designFeeWan} 万`],
        },
      ];
    }
    return [
      cover,
      {
        id: "list",
        title: "清单明细（SKU 级）",
        bullets: [
          `${projectLines.length} 项 · ${totals.qty} 件 · ¥${totals.amount.toLocaleString()}`,
          "明细与生态库采购清单同源",
        ],
      },
      {
        id: "schedule",
        title: "工期计划",
        bullets: ["拆改 → 水电 → 泥木 → 油漆 → 安装 → 软装", project.profile.timeline ?? "工期待确认"],
      },
      {
        id: "check",
        title: "验收标准",
        bullets: checklist.slice(0, 4).map((c) => `${c.done ? "√ " : "· "}${c.label}`),
      },
      {
        id: "change",
        title: "变更管理",
        bullets: [`已留痕 ${changes.length} 条 · 变更先出计价差异草稿`, "施工尺寸以实测为准"],
        accent: true,
      },
    ];
  }, [
    template,
    project,
    selectedDirection,
    directions,
    renderImages,
    styleImages,
    projectLines.length,
    totals,
    designFee,
    design,
    fee,
    focusMeta,
    checklist,
    changes,
  ]);

  const generateOutline = () => {
    const tpl = TEMPLATES.find((t) => t.id === template)!;
    setOutline([
      `开场：${project.name} — ${project.profile.style ?? "整体"}方案${tpl.name}`,
      ...slides.map((s, i) => `第 ${i + 1} 页 · ${s.title}：${s.bullets[0] ?? ""}`),
      "收尾：明确本次需确认的结论、负责人和下一时间点",
    ]);
  };

  const exportPptx = async () => {
    setExporting(true);
    const templateName = TEMPLATES.find((item) => item.id === template)?.name ?? "项目汇报";
    const safeProjectName = project.name.replace(/[\\/:*?"<>|]/g, "-");
    const fileName = `${safeProjectName}-${templateName}.pptx`;
    try {
      const blob = await buildProjectPptx({
        projectName: project.name,
        templateName,
        slides,
      });
      downloadBlob(blob, fileName);
      let archived = true;
      try {
        const file = new File([blob], fileName, {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        });
        await addProjectFile(projectId, file, {
          kind: "汇报",
          stageId: state.focusStage,
          portalVisible: false,
        });
      } catch {
        archived = false;
      }
      setToast({
        type: archived ? TOAST_TYPE.SUCCESS : TOAST_TYPE.INFO,
        title: "PPTX 已导出",
        message: archived
          ? "已同时归档到项目文件，可继续在 PowerPoint 编辑"
          : "文件已下载；体积超过项目文件上限，未自动归档",
      });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "PPTX 导出失败",
        message: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHead title={`${project.name} · 汇报`} />
      <FsPageShell>
        <FsPageBody>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <FsPageTitle>汇报 PPT</FsPageTitle>
              <FsMuted className="mt-0.5">自动灌入本项目资产（阶段成果 / 清单 / 报价摘要）· 可编辑 PPTX</FsMuted>
            </div>
            <div className="flex flex-wrap gap-2">
              <FsSecondaryLink to={`${base}/overview`}>返回概览</FsSecondaryLink>
              <FsButton variant="ai" onClick={generateOutline}>
                生成讲稿大纲
              </FsButton>
              <FsButton disabled={exporting} onClick={() => void exportPptx()}>
                <Download className="size-3.5" strokeWidth={1.75} />
                {exporting ? "正在生成…" : "导出 pptx"}
              </FsButton>
            </div>
          </div>

          {/* 模板选择 */}
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTemplate(t.id);
                  setOutline(null);
                }}
                className={cn(
                  "rounded-lg border p-3 text-left transition-transform hover:-translate-y-0.5",
                  template === t.id ? "border-accent-strong bg-accent-subtle" : "border-subtle bg-surface-1"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-13 font-semibold text-primary">{t.name}</span>
                  {template === t.id && <FsTag tone="brand">当前模板</FsTag>}
                </div>
                <div className="mt-0.5 text-11 text-tertiary">{t.desc}</div>
              </button>
            ))}
          </div>

          {/* AI 大纲 */}
          {outline && (
            <FsCard className="mb-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-13 font-semibold text-primary">讲稿大纲</span>
                <FsTag tone="ai">项目数据生成</FsTag>
              </div>
              <ul className="space-y-1 text-12 text-secondary">
                {outline.map((line, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-placeholder tabular-nums">{i + 1}.</span>
                    {line}
                  </li>
                ))}
              </ul>
            </FsCard>
          )}

          {/* 分页预览 */}
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {slides.map((s, i) => (
              <FsCard
                key={s.id}
                className={cn("flex min-h-40 flex-col overflow-hidden", s.accent && "border-accent-primary/30")}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-11 font-medium text-placeholder tabular-nums">Slide {i + 1}</span>
                  {s.accent && <FsTag tone="brand">重点页</FsTag>}
                </div>
                <div className="text-13 font-semibold text-primary">{s.title}</div>
                <ul className="mt-1.5 flex-1 space-y-0.5">
                  {s.bullets.filter(Boolean).map((b, j) => (
                    <li key={j} className="text-11 leading-relaxed text-tertiary">
                      · {b}
                    </li>
                  ))}
                </ul>
                {s.images && s.images.length > 0 && (
                  <div className="mt-2 flex gap-1">
                    {s.images.slice(0, 4).map((src) => (
                      <img key={src} src={src} alt="" className="h-12 min-w-0 flex-1 rounded-sm object-cover" />
                    ))}
                  </div>
                )}
              </FsCard>
            ))}
          </div>
          <FsMuted className="mt-4 text-center">分页内容随阶段成果实时刷新 · 导出后自动归档到项目文件</FsMuted>
        </FsPageBody>
      </FsPageShell>
    </>
  );
}

/**
 * 项目制 harness 工具表
 * 对应 grok-build xai-grok-tools：可调用能力注册表
 * 构境域：进度 / 采购 / 档案（只读+轻写 Demo）
 */
import {
  advanceBizNode,
  getBizNodesView,
  getDesignFeeProgress,
  getDesignStageProgress,
  getProjectProgress,
  stageStateLabel,
} from "../project-progress-store";
import {
  getPurchaseLinesForProject,
  getPurchaseTotalsForProject,
  PURCHASE_STATUS_META,
} from "../purchase-store";
import { projectById } from "../pm-mock";
import { STAGES } from "../types";
import { getCanvasAiBridge } from "../canvas/canvas-ai-bridge-registry";
import type { HarnessTool, ProjectHarnessContext, ToolResult } from "./types";

function needProject(ctx: ProjectHarnessContext): ToolResult | null {
  if (!ctx.projectId) {
    return {
      ok: false,
      summary: "当前无项目上下文。请先进入某个项目（概览/阶段/任务），再执行项目工具。",
    };
  }
  return null;
}

export const HARNESS_TOOLS: HarnessTool[] = [
  {
    name: "get_project_snapshot",
    description: "读取项目双轴进度、设计费、经营节点快照",
    requiresProject: true,
    run: (ctx) => {
      const miss = needProject(ctx);
      if (miss) return miss;
      const id = ctx.projectId!;
      const pm = projectById(id);
      const progress = getProjectProgress(id);
      const fee = getDesignFeeProgress(id);
      const design = getDesignStageProgress(id);
      const biz = getBizNodesView(id);
      const current = biz.find((n) => n.status === "current");
      return {
        ok: true,
        summary: [
          `项目「${pm?.name ?? ctx.projectName ?? id}」`,
          `设计焦点：${STAGES.find((s) => s.id === progress.focusStage)?.label ?? progress.focusStage}（已确认 ${design.confirmed}/${design.total}）`,
          `经营当前：${current?.label ?? "已交付"} · 设计费已收 ${fee.collectedWan}/${fee.designFeeWan} 万`,
        ].join(" · "),
        data: { progress, fee, design, biz },
      };
    },
  },
  {
    name: "list_project_purchase",
    description: "列出本项目家具采买清单（与生态库同源）",
    requiresProject: true,
    run: (ctx) => {
      const miss = needProject(ctx);
      if (miss) return miss;
      const id = ctx.projectId!;
      const lines = getPurchaseLinesForProject(id);
      const totals = getPurchaseTotalsForProject(id);
      if (lines.length === 0) {
        return {
          ok: true,
          summary: "本项目采购清单为空。可在「家具采买」阶段或生态库加购并绑定项目。",
          data: { lines, totals },
        };
      }
      const head = lines
        .slice(0, 5)
        .map(
          (l) =>
            `${l.name}×${l.qty}（${PURCHASE_STATUS_META[l.status].label} ¥${(l.price * l.qty).toLocaleString()}）`
        )
        .join("；");
      return {
        ok: true,
        summary: `采购 ${totals.qty} 件 / ${totals.lines} 行 · 合计 ¥${totals.amount.toLocaleString()}。示例：${head}${lines.length > 5 ? "…" : ""}`,
        data: { lines, totals },
      };
    },
  },
  {
    name: "list_stage_states",
    description: "列出七段设计阶段三态与过期标记",
    requiresProject: true,
    run: (ctx) => {
      const miss = needProject(ctx);
      if (miss) return miss;
      const { stageStates, staleStages, focusStage } = getProjectProgress(ctx.projectId!);
      const lines = STAGES.map((s) => {
        const st = stageStates[s.id];
        const stale = staleStages.includes(s.id) ? "·上游有更新" : "";
        const focus = s.id === focusStage ? "·焦点" : "";
        return `${s.label}:${stageStateLabel(st)}${focus}${stale}`;
      });
      return {
        ok: true,
        summary: lines.join(" · "),
        data: { stageStates, staleStages, focusStage },
      };
    },
  },
  {
    name: "advance_biz_node",
    description: "推进经营节点到下一档（并联动设计费已收）",
    requiresProject: true,
    run: (ctx) => {
      const miss = needProject(ctx);
      if (miss) return miss;
      const before = getBizNodesView(ctx.projectId!);
      const prev = before.find((n) => n.status === "current");
      advanceBizNode(ctx.projectId!);
      const after = getBizNodesView(ctx.projectId!);
      const next = after.find((n) => n.status === "current");
      const fee = getDesignFeeProgress(ctx.projectId!);
      return {
        ok: true,
        summary: `经营节点已推进：${prev?.label ?? "—"} → 完成；当前 ${next?.label ?? "已交付"}。设计费已收 ${fee.collectedWan}/${fee.designFeeWan} 万。`,
        data: { fee, nodes: after },
      };
    },
  },
  {
    name: "suggest_next_actions",
    description: "根据双轴进度与采购状态给出下一步建议",
    requiresProject: true,
    run: (ctx) => {
      const miss = needProject(ctx);
      if (miss) return miss;
      const id = ctx.projectId!;
      const design = getDesignStageProgress(id);
      const fee = getDesignFeeProgress(id);
      const purchase = getPurchaseTotalsForProject(id);
      const actions: string[] = [];
      if (design.staleCount > 0) actions.push(`复核 ${design.staleCount} 个「上游有更新」阶段`);
      if (design.pct < 100) {
        const focus = getProjectProgress(id).focusStage;
        const label = STAGES.find((s) => s.id === focus)?.label ?? focus;
        actions.push(`继续设计阶段「${label}」并确认`);
      }
      if (fee.pendingWan > 0) actions.push(`跟进设计费待收 ${fee.pendingWan} 万（经营节点）`);
      if (purchase.qty === 0) actions.push("在家具采买/生态库为本项目加购 SKU");
      else if ((purchase.byStatus.draft ?? 0) > 0)
        actions.push(`提交 ${purchase.byStatus.draft} 条待选采购询价`);
      if (actions.length === 0) actions.push("双轴与采购均较完整，可准备施工落地报价与汇报 PPT");
      return {
        ok: true,
        summary: actions.map((a, i) => `${i + 1}. ${a}`).join(" "),
        data: { actions },
      };
    },
  },
  {
    name: "canvas_snapshot",
    description: "读取画布节点数与当前选中（画布 Agent）",
    run: (ctx) => {
      if (!ctx.canvasActive) {
        return { ok: false, summary: "当前不在画布页。请打开意向画布后再问画布相关问题。" };
      }
      const b = getCanvasAiBridge();
      const snap = b?.getSnapshot?.();
      if (!snap) return { ok: false, summary: "画布桥未就绪。" };
      return {
        ok: true,
        summary: `画布共 ${snap.nodeCount} 节点 · 选中 ${snap.selectedCount}：${
          snap.selectedTitles.slice(0, 4).join("、") || "无"
        }`,
        data: snap,
      };
    },
  },
  {
    name: "canvas_place_image",
    description: "在画布中心放一张 Agent 建议图节点",
    run: (ctx, args) => {
      if (!ctx.canvasActive) {
        return { ok: false, summary: "需在画布页使用。" };
      }
      const b = getCanvasAiBridge();
      if (!b) return { ok: false, summary: "画布桥未就绪。" };
      const title = String(args.title ?? "AI 建议稿");
      const src = args.src ? String(args.src) : undefined;
      b.placeResult({
        title,
        tags: ["agent", "画布"],
        colors: (args.colors as string[]) ?? ["#EDE9FE", "#C4B5FD", "#8B5CF6"],
        src,
      });
      return { ok: true, summary: `已放到画布：${title}${src ? "（mock 图）" : ""}` };
    },
  },
  {
    name: "canvas_place_gen",
    description: "在画布落图片生成器并按提示词跑生成（一键落图）",
    run: (ctx, args) => {
      if (!ctx.canvasActive) {
        return { ok: false, summary: "需在画布页使用。" };
      }
      const b = getCanvasAiBridge();
      if (!b?.placeImageGen) return { ok: false, summary: "画布生成桥未就绪。" };
      const prompt = String(args.prompt ?? args.instruction ?? "空间效果图");
      const skillId = args.skillId ? String(args.skillId) : undefined;
      const count = typeof args.count === "number" ? args.count : undefined;
      const id = b.placeImageGen({ prompt, skillId, count, autoRun: true });
      return {
        ok: !!id,
        summary: id
          ? `已创建生成任务并自动落图${skillId ? ` · 技能 ${skillId}` : ""}：${prompt.slice(0, 40)}`
          : "创建生成节点失败",
      };
    },
  },
  {
    name: "canvas_edit_selected",
    description: "对当前选中图像做交互改图（再生成/风格延展）",
    run: (ctx, args) => {
      if (!ctx.canvasActive) {
        return { ok: false, summary: "需在画布页使用。" };
      }
      const b = getCanvasAiBridge();
      if (!b?.editSelected) return { ok: false, summary: "画布改图桥未就绪。" };
      const instruction = String(args.instruction ?? args.prompt ?? "风格延展");
      const ok = b.editSelected(instruction);
      return {
        ok,
        summary: ok
          ? `已对选中图像发起「${instruction}」，完成后自动落图。`
          : "请先在画布选中一张图片或生成器节点。",
      };
    },
  },
];

export function getTool(name: string): HarnessTool | undefined {
  return HARNESS_TOOLS.find((t) => t.name === name);
}

export async function runTool(
  name: string,
  ctx: ProjectHarnessContext,
  args: Record<string, unknown> = {}
): Promise<ToolResult> {
  const tool = getTool(name);
  if (!tool) return { ok: false, summary: `未知工具：${name}` };
  return tool.run(ctx, args);
}

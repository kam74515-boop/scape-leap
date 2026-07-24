/**
 * 项目制 Skills — 对标 grok-build skills（可组合的能力包）
 * 触发仍用关键词 Demo；后续可接 LLM router
 */
import type { HarnessSkill } from "./types";

export const HARNESS_SKILLS: HarnessSkill[] = [
  {
    id: "project_ops",
    label: "项目经营",
    description: "双轴进度、设计费、经营节点",
    triggers: ["进度", "经营", "设计费", "节点", "回款", "概览", "推进"],
    tools: ["get_project_snapshot", "advance_biz_node", "suggest_next_actions"],
    systemHint: "你是构境工作室的项目经营助手，以项目为边界，经营节点与设计费同源。",
  },
  {
    id: "design_stages",
    label: "设计阶段",
    description: "七段三态、确认与过期",
    triggers: ["阶段", "确认", "风格", "需求", "渲染", "建模", "过期", "回跳"],
    tools: ["list_stage_states", "get_project_snapshot", "suggest_next_actions"],
    systemHint: "你协助设计师推进七段设计阶段，不自动流转，强调确认与上游过期。",
  },
  {
    id: "furniture_purchase",
    label: "家具采买",
    description: "生态库同源采购清单",
    triggers: ["采购", "家具", "采买", "清单", "加购", "询价", "SKU", "生态库"],
    tools: ["list_project_purchase", "suggest_next_actions", "get_project_snapshot"],
    systemHint: "采购清单与生态库全局采购同源；项目家具采买阶段只读绑定本项目的行。",
  },
  {
    id: "canvas_ideate",
    label: "意向画布",
    description: "画布上下文创意辅助",
    triggers: ["画布", "moodboard", "色板", "意向", "布局", "口播"],
    tools: ["get_project_snapshot"],
    systemHint: "在画布上下文中协助风格与布局草稿，可建议放到画布节点。",
  },
  {
    id: "general",
    label: "通用",
    description: "默认路由",
    triggers: [],
    tools: ["suggest_next_actions", "get_project_snapshot"],
    systemHint: "你是构境 AI：基于项目制 harness，优先调用项目工具再给建议。",
  },
];

export function matchSkill(userText: string): HarnessSkill {
  const t = userText.toLowerCase();
  for (const skill of HARNESS_SKILLS) {
    if (skill.id === "general") continue;
    if (skill.triggers.some((k) => t.includes(k.toLowerCase()) || userText.includes(k))) {
      return skill;
    }
  }
  return HARNESS_SKILLS.find((s) => s.id === "general")!;
}

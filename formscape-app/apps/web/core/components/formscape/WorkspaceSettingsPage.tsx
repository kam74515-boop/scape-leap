/**
 * 工作室设置 — 四子区（?section=plan|usage|integrations|appearance）
 * plan 计划与席位 · usage 算力与用量（Demo） · integrations 插件中心 · appearance 外观（真生效）
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { cn } from "@plane/utils";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import { Blocks, Check, Monitor, Moon, Sun } from "@/icons";
import { PageHead } from "@/components/core/page-title";
import { WORKSPACE_META } from "./workspace-mock";
import {
  FsButton,
  FsCard,
  FsCardTitle,
  FsModal,
  FsMuted,
  FsPageBody,
  FsPageHeader,
  FsPageShell,
  FsPageTitle,
  FsProgress,
  FsStat,
  FsTag,
} from "./ui";

export type SettingsSection = "plan" | "usage" | "integrations" | "appearance";

const SECTIONS: { key: SettingsSection; label: string }[] = [
  { key: "plan", label: "计划与席位" },
  { key: "usage", label: "算力与用量" },
  { key: "integrations", label: "集成" },
  { key: "appearance", label: "外观" },
];

function parseSection(raw: string | null): SettingsSection {
  if (raw === "usage" || raw === "integrations" || raw === "appearance" || raw === "plan") return raw;
  return "plan";
}

/* ─── 计划档位（Demo 数据）───────────────────────────────── */

type PlanDef = {
  key: string;
  name: string;
  seats: string;
  priceLine: string;
  features: string[];
};

const PLANS: PlanDef[] = [
  {
    key: "Free-Trial",
    name: "Free-Trial",
    seats: "1 – 2 席",
    priceLine: "¥0",
    features: ["意向画布 + 空间模型", "生态库浏览", "单项目试用"],
  },
  {
    key: "Studio",
    name: "Studio",
    seats: "3 – 10 席",
    priceLine: "按席位订阅（演示价）",
    features: ["七阶段全流程 + 汇报 PPT", "生态库 + 采购清单", "客户档案与经营看板"],
  },
  {
    key: "Business",
    name: "Business",
    seats: "10 席以上",
    priceLine: "按团队洽谈（演示）",
    features: ["SSO 单点登录", "审计日志", "API 接入"],
  },
];

/* ─── 用量 mock（Demo 数据）──────────────────────────────── */

const USAGE = [
  { label: "AI 生成（本月）", used: 128, quota: 500, unit: "次" },
  { label: "平面图识别（本月）", used: 46, quota: 200, unit: "次" },
  { label: "存储空间", used: 2.1, quota: 20, unit: "GB" },
];

/* ─── 集成插件中心（Demo）────────────────────────────────── */

const INTEGRATIONS = [
  { key: "sketchup", name: "SketchUp 插件", desc: "白模一键同步到空间模型，少开一个软件来回导" },
  { key: "rhino", name: "Rhino 插件", desc: "曲面模型直接进画布出效果图" },
  { key: "lark", name: "飞书", desc: "任务与汇报同步到群，业主确认不丢消息" },
  { key: "affiliate", name: "联盟带货", desc: "采购清单一键生成外链，比价与返佣走开放生态" },
];

export function FormscapeWorkspaceSettingsPage() {
  const searchParams = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [section, setSectionState] = useState<SettingsSection>(() =>
    parseSection(searchParams.get("section"))
  );
  const [upgradeTarget, setUpgradeTarget] = useState<PlanDef | null>(null);

  useEffect(() => {
    setSectionState(parseSection(searchParams.get("section")));
  }, [searchParams]);

  const setSection = useCallback(
    (s: SettingsSection) => {
      setSectionState(s);
      navigate(`${pathname}?section=${s}`, { replace: true });
    },
    [navigate, pathname]
  );

  return (
    <>
      <PageHead title="工作室设置 · 构境AI" />
      <FsPageShell>
        <FsPageHeader title="设置" description="计划与席位 · 算力与用量 · 集成 · 外观" />
        <FsPageBody>
          <div className="w-full max-w-3xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FsPageTitle>工作室设置</FsPageTitle>
              <div className="flex flex-wrap gap-1">
                {SECTIONS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSection(s.key)}
                    className={cn(
                      "rounded-full px-3 py-1 text-12 font-medium transition-colors",
                      section === s.key
                        ? "bg-accent-subtle text-accent-secondary"
                        : "text-secondary hover:bg-layer-transparent-hover"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {section === "plan" && <PlanSection onUpgrade={setUpgradeTarget} />}
            {section === "usage" && <UsageSection />}
            {section === "integrations" && <IntegrationsSection />}
            {section === "appearance" && <AppearanceSection />}
          </div>
        </FsPageBody>
      </FsPageShell>

      <FsModal
        open={upgradeTarget !== null}
        onClose={() => setUpgradeTarget(null)}
        title={upgradeTarget ? `升级到 ${upgradeTarget.name}` : "升级"}
        footer={
          <FsButton variant="secondary" size="sm" onClick={() => setUpgradeTarget(null)}>
            知道了
          </FsButton>
        }
      >
        {upgradeTarget && (
          <div className="space-y-2">
            <p>
              {upgradeTarget.name}（{upgradeTarget.seats}）包含：{upgradeTarget.features.join("、")}。
            </p>
            <FsMuted>
              当前为演示环境，未接入真实计费。正式版将在此对接订阅支付，按席位与经营结果计价，
              不按出图次数收费。
            </FsMuted>
          </div>
        )}
      </FsModal>
    </>
  );
}

/* ─── 计划与席位 ─────────────────────────────────────────── */

function PlanSection({ onUpgrade }: { onUpgrade: (plan: PlanDef) => void }) {
  const currentKey = WORKSPACE_META.plan; // "Studio"
  const seatsUsed = WORKSPACE_META.seatsUsed;
  const seatsTotal = WORKSPACE_META.seatsTotal;

  return (
    <div className="space-y-3">
      <FsCard>
        <div className="flex items-center justify-between">
          <FsCardTitle className="!mb-0">当前计划</FsCardTitle>
          <FsTag tone="brand">{currentKey}</FsTag>
        </div>
        <FsProgress ai={false} value={(seatsUsed / seatsTotal) * 100} className="mt-3 h-1.5" />
        <FsMuted className="mt-2">
          席位 {seatsUsed}/{seatsTotal} · 席位管理在「团队管理」，此处升级档位（Demo 数据）
        </FsMuted>
      </FsCard>

      <div className="grid gap-3 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.key === currentKey;
          return (
            <FsCard
              key={plan.key}
              className={cn("flex flex-col", isCurrent && "border-accent-strong")}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="text-15 font-semibold text-primary">{plan.name}</div>
                {isCurrent && <FsTag tone="brand">当前档位</FsTag>}
              </div>
              <div className="mt-0.5 text-11 text-tertiary">{plan.seats}</div>
              <div className="mt-2 text-13 font-semibold text-primary tabular-nums">{plan.priceLine}</div>
              <ul className="mt-2 flex-1 space-y-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-12 text-secondary">
                    <Check className="mt-0.5 size-3 shrink-0 text-accent-primary" strokeWidth={1.75} />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                {isCurrent ? (
                  <FsButton variant="secondary" size="sm" disabled className="w-full">
                    正在使用
                  </FsButton>
                ) : (
                  <FsButton size="sm" className="w-full" onClick={() => onUpgrade(plan)}>
                    {plan.key === "Free-Trial" ? "了解详情" : "升级"}
                  </FsButton>
                )}
              </div>
            </FsCard>
          );
        })}
      </div>
      <FsMuted>档位与价格为演示说明，未接真实计费 · 付费贴合经营结果，不按出图次数计价</FsMuted>
    </div>
  );
}

/* ─── 算力与用量 ─────────────────────────────────────────── */

function UsageSection() {
  return (
    <div className="space-y-3">
      <FsCard>
        <div className="flex items-center justify-between">
          <FsCardTitle className="!mb-0">算力与用量</FsCardTitle>
          <FsTag tone="warning">Demo 数据</FsTag>
        </div>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          {USAGE.map((u) => {
            const pct = Math.round((u.used / u.quota) * 100);
            return (
              <div key={u.label}>
                <FsStat
                  label={u.label}
                  value={u.used}
                  hint={`额度 ${u.quota} ${u.unit} · 已用 ${pct}%`}
                />
                <FsProgress ai={false} value={pct} className="mt-2" />
              </div>
            );
          })}
        </div>
        <FsMuted className="mt-4">
          正式版接入真实生成/识别计量后，这里按经营周期出账 · 当前为演示统计
        </FsMuted>
      </FsCard>
    </div>
  );
}

/* ─── 集成（插件中心）───────────────────────────────────── */

function IntegrationsSection() {
  const onConnect = (name: string) => {
    setToast({
      type: TOAST_TYPE.INFO,
      title: `${name} 即将推出`,
      message: "插件中心正在接入，上线后这里一键连接",
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {INTEGRATIONS.map((it) => (
          <FsCard key={it.key} interactive className="flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-accent-subtle text-accent-primary">
                  <Blocks className="size-4" strokeWidth={1.75} />
                </span>
                <div>
                  <div className="text-13 font-semibold text-primary">{it.name}</div>
                  <FsTag className="mt-0.5">未连接</FsTag>
                </div>
              </div>
            </div>
            <FsMuted className="mt-2 flex-1">{it.desc}</FsMuted>
            <div className="mt-3">
              <FsButton variant="secondary" size="sm" onClick={() => onConnect(it.name)}>
                连接
              </FsButton>
            </div>
          </FsCard>
        ))}
      </div>
      <FsMuted>插件中心为演示态 · 开放生态方向：外链与比价，不做封闭商城</FsMuted>
    </div>
  );
}

/* ─── 外观（主题真生效）─────────────────────────────────── */

const THEME_CHOICES = [
  { value: "light", label: "浅色", desc: "白底干净底座，效果图是主角", Icon: Sun },
  { value: "dark", label: "深色", desc: "夜间改图不刺眼", Icon: Moon },
  { value: "system", label: "跟随系统", desc: "白天浅色，夜里自动变深", Icon: Monitor },
] as const;

function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-3">
      <FsCard>
        <FsCardTitle>主题</FsCardTitle>
        <FsMuted className="mb-3">点一下就切换，立即生效</FsMuted>
        <div className="grid gap-2 sm:grid-cols-3">
          {THEME_CHOICES.map(({ value, label, desc, Icon }) => {
            const active = theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-[transform,border-color] duration-150 ease-out hover:-translate-y-0.5",
                  active ? "border-accent-strong bg-accent-subtle/40" : "border-subtle hover:border-strong"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <Icon
                    className={cn("size-4", active ? "text-accent-primary" : "text-secondary")}
                    strokeWidth={1.75}
                  />
                  {active && <Check className="size-3.5 text-accent-primary" strokeWidth={1.75} />}
                </div>
                <div className={cn("text-13 font-medium", active ? "text-accent-secondary" : "text-primary")}>
                  {label}
                </div>
                <div className="text-11 text-tertiary">{desc}</div>
              </button>
            );
          })}
        </div>
      </FsCard>

      <FsCard>
        <FsCardTitle>品牌色</FsCardTitle>
        <FsMuted className="mb-3">界面是低饱和干净底座，色彩留给效果图；紫色仅 AI 能力专用</FsMuted>
        <div className="flex flex-wrap gap-3">
          <ColorSwatch className="bg-accent-primary" name="Brand 靛蓝" note="主交互色" />
          <ColorSwatch className="bg-ai-primary" name="AI 紫罗兰" note="仅 AI 能力" />
          <ColorSwatch className="bg-success-primary" name="Success" note="完成 / 已到货" />
          <ColorSwatch className="bg-warning-primary" name="Warning" note="风险 / 演示语义" />
          <ColorSwatch className="bg-danger-primary" name="Danger" note="删除 / 已取消" />
        </div>
      </FsCard>
    </div>
  );
}

function ColorSwatch({ className, name, note }: { className: string; name: string; note: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-8 rounded-lg border border-subtle", className)} />
      <div>
        <div className="text-12 font-medium text-primary">{name}</div>
        <div className="text-11 text-tertiary">{note}</div>
      </div>
    </div>
  );
}

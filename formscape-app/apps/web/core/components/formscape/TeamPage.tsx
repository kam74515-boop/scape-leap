/**
 * 用户管理 — 含原「团队」：成员 / 席位 / 角色权限
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@plane/utils";
import { PageHead } from "@/components/core/page-title";
import { TEAM, WORKSPACE_META } from "./workspace-mock";
import { FsCard, FsCardTitle, FsMuted, FsPageBody, FsPageShell, FsTag } from "./ui";

export type UsersTab = "members" | "seats" | "roles";

function parseTab(raw: string | null): UsersTab {
  if (raw === "seats" || raw === "roles" || raw === "members") return raw;
  if (raw === "team" || raw === "load") return "members";
  return "members";
}

export function FormscapeTeamPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<UsersTab>(() =>
    parseTab(searchParams.get("tab") ?? searchParams.get("view"))
  );

  useEffect(() => {
    setTab(parseTab(searchParams.get("tab") ?? searchParams.get("view")));
  }, [searchParams]);

  const avgLoad = useMemo(
    () => Math.round(TEAM.reduce((s, m) => s + m.load, 0) / Math.max(1, TEAM.length)),
    []
  );

  return (
    <>
      <PageHead title="用户管理 · 构境AI" />
      <FsPageShell>
        <div className="shrink-0 border-b border-subtle bg-surface-1">
          <div className="flex h-11 items-center justify-between gap-2 px-3">
            <div>
              <div className="text-13 font-semibold text-primary">用户管理</div>
              <div className="text-11 text-tertiary">
                团队成员 · 席位 · 角色权限 · {WORKSPACE_META.plan}
              </div>
            </div>
            <div className="flex rounded-md border border-subtle p-0.5">
              {(
                [
                  ["members", "成员"],
                  ["seats", "席位"],
                  ["roles", "角色权限"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={cn(
                    "rounded px-2.5 py-1 text-11 font-medium",
                    tab === k ? "bg-accent-primary text-on-color" : "text-secondary hover:bg-surface-2"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <FsPageBody>
          {tab === "members" && (
            <div className="w-full space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <MiniKpi label="成员" value={String(TEAM.length)} />
                <MiniKpi label="平均负荷" value={`${avgLoad}%`} />
                <MiniKpi
                  label="席位占用"
                  value={`${WORKSPACE_META.seatsUsed}/${WORKSPACE_META.seatsTotal}`}
                />
              </div>
              <div className="space-y-1.5">
                {TEAM.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-md border border-subtle bg-surface-1 px-3 py-2.5"
                  >
                    <div>
                      <div className="text-13 font-medium text-primary">{m.name}</div>
                      <div className="text-11 text-tertiary">{m.email}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <FsTag>{m.role}</FsTag>
                      <div className="w-20 text-right">
                        <div className="text-11 text-tertiary">负荷</div>
                        <div className="text-13 font-medium text-secondary">{m.load}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <FsMuted>原 L1「团队」已并入用户管理 · 可从侧栏按成员筛选（Demo）</FsMuted>
            </div>
          )}

          {tab === "seats" && (
            <div className="w-full space-y-3">
              <FsCard>
                <FsCardTitle>席位概览</FsCardTitle>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-accent-primary"
                    style={{
                      width: `${(WORKSPACE_META.seatsUsed / WORKSPACE_META.seatsTotal) * 100}%`,
                    }}
                  />
                </div>
                <FsMuted className="mt-2">
                  已用 {WORKSPACE_META.seatsUsed} / {WORKSPACE_META.seatsTotal} · 计划{" "}
                  {WORKSPACE_META.plan}
                </FsMuted>
              </FsCard>
              <FsCard>
                <FsCardTitle>席位分配</FsCardTitle>
                <FsMuted className="mb-2">每位成员占用 1 个设计席位（Demo）</FsMuted>
                <ul className="divide-y divide-subtle rounded-md border border-subtle">
                  {TEAM.map((m) => (
                    <li key={m.id} className="flex items-center justify-between px-3 py-2 text-13">
                      <span className="text-primary">{m.name}</span>
                      <span className="text-11 text-tertiary">席位 · 已分配</span>
                    </li>
                  ))}
                  {Array.from({
                    length: Math.max(0, WORKSPACE_META.seatsTotal - WORKSPACE_META.seatsUsed),
                  }).map((_, i) => (
                    <li
                      key={`empty-${i}`}
                      className="flex items-center justify-between px-3 py-2 text-13 text-placeholder"
                    >
                      <span>空闲席位</span>
                      <span className="text-11">可邀请</span>
                    </li>
                  ))}
                </ul>
              </FsCard>
            </div>
          )}

          {tab === "roles" && (
            <div className="w-full space-y-3">
              <FsCard>
                <FsCardTitle>角色矩阵（示意）</FsCardTitle>
                <FsMuted className="mb-3">工作室权限 · 不替代项目内角色</FsMuted>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-11">
                    <thead>
                      <tr className="border-b border-subtle text-tertiary">
                        <th className="py-2 pr-2 font-medium">能力</th>
                        <th className="py-2 px-1 font-medium">主案</th>
                        <th className="py-2 px-1 font-medium">深化</th>
                        <th className="py-2 px-1 font-medium">软装</th>
                        <th className="py-2 px-1 font-medium">助理</th>
                      </tr>
                    </thead>
                    <tbody className="text-secondary">
                      {[
                        ["项目管理", "✓", "读", "读", "读"],
                        ["设计阶段确认", "✓", "✓", "—", "—"],
                        ["采购清单", "✓", "读", "✓", "读"],
                        ["客户档案", "✓", "读", "读", "✓"],
                        ["席位与计费", "✓", "—", "—", "—"],
                      ].map((row) => (
                        <tr key={row[0]} className="border-b border-subtle/80">
                          {row.map((cell, i) => (
                            <td
                              key={i}
                              className={cn("py-2", i === 0 ? "pr-2 font-medium text-primary" : "px-1")}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FsCard>
              <FsMuted>正式版将对接 Plane 成员与自定义角色</FsMuted>
            </div>
          )}
        </FsPageBody>
      </FsPageShell>
    </>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-subtle bg-surface-1 px-3 py-2.5">
      <div className="text-11 text-tertiary">{label}</div>
      <div className="mt-0.5 text-13 font-semibold text-primary">{value}</div>
    </div>
  );
}

/** @deprecated 使用 FormscapeTeamPage（用户管理） */
export const FormscapeUsersPage = FormscapeTeamPage;

/**
 * 团队管理 — 成员 / 席位 / 角色权限
 * Demo 级成员 CRUD：邀请 / 编辑角色 / 移除，数据仅保存在本机 localStorage
 * （不改 workspace-mock.ts：本地 store 逻辑内置于本文件）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useParams, useSearchParams } from "next/navigation";
import { cn } from "@plane/utils";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import { UserPlus } from "@/icons";
import { PageHead } from "@/components/core/page-title";
import { TEAM, WORKSPACE_META, type TeamMember } from "./workspace-mock";
import { ensureFsHydrated, readFsCache, registerFsEntity, replaceFsDocs } from "./fs-data-client";
import {
  FsButton,
  FsCard,
  FsCardTitle,
  FsConfirm,
  FsField,
  fsInputClass,
  FsModal,
  FsMuted,
  FsPageBody,
  FsPageShell,
  FsProgress,
  FsStat,
  FsTag,
} from "./ui";

export type UsersTab = "members" | "seats" | "roles";

const ROLE_OPTIONS: TeamMember["role"][] = ["管理员", "主案设计师", "深化", "软装", "助理"];

/* ─── 成员 store（Demo · SQLite 持久化，/api/fs/members）───────────────────── */

const MEMBERS_CHANGE_EVENT = "fs-users-members-change";

registerFsEntity("members", MEMBERS_CHANGE_EVENT);
ensureFsHydrated(["members"]);

function loadMembers(): TeamMember[] {
  const cached = readFsCache<TeamMember>("members");
  return cached.length > 0 ? cached : TEAM;
}

function saveMembers(members: TeamMember[]) {
  replaceFsDocs("members", members);
}

function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>(() => loadMembers());

  useEffect(() => {
    const onChange = () => setMembers(loadMembers());
    window.addEventListener(MEMBERS_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(MEMBERS_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const invite = useCallback((input: { name: string; email: string; role: TeamMember["role"] }) => {
    const next: TeamMember[] = [
      ...loadMembers(),
      {
        id: `tm-${Date.now().toString(36)}`,
        name: input.name,
        email: input.email,
        role: input.role,
        load: 0,
      },
    ];
    saveMembers(next);
    setMembers(next);
  }, []);

  const setRole = useCallback((id: string, role: TeamMember["role"]) => {
    const next = loadMembers().map((m) => (m.id === id ? { ...m, role } : m));
    saveMembers(next);
    setMembers(next);
  }, []);

  const remove = useCallback((id: string) => {
    const next = loadMembers().filter((m) => m.id !== id);
    saveMembers(next);
    setMembers(next);
  }, []);

  return { members, invite, setRole, remove };
}

/* ─── 页面 ────────────────────────────────────────────────── */

function parseTab(raw: string | null): UsersTab {
  if (raw === "seats" || raw === "roles" || raw === "members") return raw;
  if (raw === "team" || raw === "load") return "members";
  return "members";
}

export function FormscapeTeamPage() {
  const searchParams = useSearchParams();
  const navigate = useNavigate();
  const { workspaceSlug } = useParams();
  const ws = workspaceSlug?.toString() ?? "formscape";
  const [tab, setTabState] = useState<UsersTab>(() =>
    parseTab(searchParams.get("tab") ?? searchParams.get("view"))
  );
  const { members, invite, setRole, remove } = useTeamMembers();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  // ?member=<成员id> 高亮定位
  const highlightId = searchParams.get("member");
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTabState(parseTab(searchParams.get("tab") ?? searchParams.get("view")));
  }, [searchParams]);

  useEffect(() => {
    if (!highlightId) return;
    // 等列表渲染后滚动定位
    const t = window.setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [highlightId, tab, members.length]);

  const setTab = useCallback(
    (t: UsersTab) => {
      setTabState(t);
      navigate(`/${ws}/users?tab=${t}`, { replace: true });
    },
    [navigate, ws]
  );

  const seatsTotal = WORKSPACE_META.seatsTotal;
  const seatsUsed = members.length;
  const seatsFree = Math.max(0, seatsTotal - seatsUsed);
  const seatsFull = seatsUsed >= seatsTotal;

  const avgLoad = useMemo(
    () => Math.round(members.reduce((s, m) => s + m.load, 0) / Math.max(1, members.length)),
    [members]
  );

  const onInvite = (input: { name: string; email: string; role: TeamMember["role"] }) => {
    if (seatsFull) {
      setToast({ type: TOAST_TYPE.WARNING, title: "席位已满", message: "升级订阅档位可增加席位（Demo）" });
      return;
    }
    invite(input);
    setInviteOpen(false);
    setToast({ type: TOAST_TYPE.SUCCESS, title: "已邀请成员", message: `${input.name} 已加入并占用 1 个席位（Demo）` });
  };

  const onRemove = () => {
    if (!removeTarget) return;
    remove(removeTarget.id);
    setToast({ type: TOAST_TYPE.SUCCESS, title: "已移除成员", message: `${removeTarget.name} 已移除，释放 1 个席位（Demo）` });
    setRemoveTarget(null);
  };

  return (
    <>
      <PageHead title="团队管理 · 构境AI" />
      <FsPageShell>
        <div className="shrink-0 border-b border-subtle bg-surface-1">
          <div className="flex h-11 items-center justify-between gap-2 px-3">
            <div>
              <div className="text-13 font-semibold text-primary">团队管理</div>
              <div className="text-11 text-tertiary">
                团队成员 · 席位 · 角色权限 · {WORKSPACE_META.plan}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-full border border-subtle p-0.5">
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
                      "rounded-full px-2.5 py-1 text-11 font-medium transition-colors",
                      tab === k
                        ? "bg-accent-subtle text-accent-secondary"
                        : "text-secondary hover:bg-layer-transparent-hover"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <FsButton size="sm" disabled={seatsFull} onClick={() => setInviteOpen(true)}>
                <UserPlus className="size-3.5" strokeWidth={1.75} />
                邀请成员
              </FsButton>
            </div>
          </div>
        </div>

        <FsPageBody>
          {tab === "members" && (
            <div className="w-full space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <FsCard className="!p-3">
                  <FsStat label="成员" value={seatsUsed} />
                </FsCard>
                <FsCard className="!p-3">
                  <FsStat label="平均负荷" value={`${avgLoad}%`} />
                </FsCard>
                <FsCard className="!p-3">
                  <FsStat label="席位占用" value={`${seatsUsed}/${seatsTotal}`} hint={seatsFull ? "席位已满" : `还可邀请 ${seatsFree} 人`} />
                </FsCard>
              </div>
              <div className="space-y-1.5">
                {members.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    highlighted={m.id === highlightId}
                    highlightRef={m.id === highlightId ? highlightRef : undefined}
                    onRole={(role) => setRole(m.id, role)}
                    onRemove={() => setRemoveTarget(m)}
                  />
                ))}
              </div>
              <FsMuted>
                成员数据仅保存在本机（Demo 数据）· 正式版将对接 Plane 成员与邀请邮件
              </FsMuted>
            </div>
          )}

          {tab === "seats" && (
            <div className="w-full space-y-3">
              <FsCard>
                <div className="flex items-center justify-between">
                  <FsCardTitle className="!mb-0">席位概览</FsCardTitle>
                  <FsTag tone={seatsFull ? "warning" : "brand"} className="tabular-nums">
                    {seatsUsed} / {seatsTotal}
                  </FsTag>
                </div>
                <FsProgress ai={false} value={(seatsUsed / seatsTotal) * 100} className="mt-3 h-1.5" />
                <FsMuted className="mt-2">
                  已用 {seatsUsed} / {seatsTotal} · 计划 {WORKSPACE_META.plan} ·
                  邀请成员即占席位，移除即释放（Demo 数据）
                </FsMuted>
              </FsCard>
              <FsCard>
                <FsCardTitle>席位分配</FsCardTitle>
                <FsMuted className="mb-2">每位成员占用 1 个设计席位（Demo 数据）</FsMuted>
                <ul className="divide-y divide-subtle rounded-lg border border-subtle">
                  {members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between px-3 py-2 text-13">
                      <span className="text-primary">{m.name}</span>
                      <FsTag tone="brand">席位 · 已分配</FsTag>
                    </li>
                  ))}
                  {Array.from({ length: seatsFree }).map((_, i) => (
                    <li
                      key={`empty-${i}`}
                      className="flex items-center justify-between px-3 py-2 text-13 text-placeholder"
                    >
                      <span>空闲席位</span>
                      <button
                        type="button"
                        onClick={() => setInviteOpen(true)}
                        className="text-11 font-medium text-accent-primary hover:underline"
                      >
                        邀请成员
                      </button>
                    </li>
                  ))}
                </ul>
              </FsCard>
            </div>
          )}

          {tab === "roles" && (
            <div className="w-full space-y-3">
              <FsCard>
                <div className="flex items-center justify-between">
                  <FsCardTitle className="!mb-0">角色矩阵</FsCardTitle>
                  <FsTag tone="warning">Demo 数据 · 展示级</FsTag>
                </div>
                <FsMuted className="mt-1 mb-3">工作室权限 · 不替代项目内角色 · 权限暂不生效</FsMuted>
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
                        ["项目管理", "可", "读", "读", "读"],
                        ["设计阶段确认", "可", "可", "—", "—"],
                        ["采购清单", "可", "读", "可", "读"],
                        ["客户档案", "可", "读", "读", "可"],
                        ["席位与计费", "可", "—", "—", "—"],
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
              <FsMuted>正式版将对接 Plane 成员与自定义角色，业主仅走 Portal 不进主 App</FsMuted>
            </div>
          )}
        </FsPageBody>
      </FsPageShell>

      <InviteMemberModal
        open={inviteOpen}
        seatsFree={seatsFree}
        onClose={() => setInviteOpen(false)}
        onSubmit={onInvite}
      />

      <FsConfirm
        open={removeTarget !== null}
        danger
        title="移除成员"
        body={
          removeTarget
            ? `确定移除 ${removeTarget.name}（${removeTarget.role}）？移除后释放 1 个席位，其任务需另行移交（Demo）。`
            : undefined
        }
        confirmLabel="移除"
        onCancel={() => setRemoveTarget(null)}
        onConfirm={onRemove}
      />
    </>
  );
}

function loadTone(load: number): string {
  if (load >= 85) return "bg-danger-primary";
  if (load >= 60) return "bg-warning-primary";
  return "bg-accent-primary";
}

function MemberRow({
  member,
  highlighted,
  highlightRef,
  onRole,
  onRemove,
}: {
  member: TeamMember;
  highlighted: boolean;
  highlightRef?: React.Ref<HTMLDivElement>;
  onRole: (role: TeamMember["role"]) => void;
  onRemove: () => void;
}) {
  return (
    <div
      ref={highlightRef}
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-surface-1 px-3 py-2.5 transition-colors",
        highlighted ? "border-accent-strong bg-accent-subtle/40" : "border-subtle"
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-13 font-medium text-primary">{member.name}</span>
          {member.load === 0 && <FsTag>新成员</FsTag>}
        </div>
        <div className="truncate text-11 text-tertiary">{member.email}</div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <select
          className="h-7 rounded-md border border-subtle bg-surface-1 px-1.5 text-11 text-secondary"
          value={member.role}
          onChange={(e) => onRole(e.target.value as TeamMember["role"])}
          aria-label="编辑角色"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <div className="w-24">
          <div className="flex items-center justify-between text-11 text-tertiary">
            <span>负荷</span>
            <span className="font-medium text-secondary tabular-nums">{member.load}%</span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn("h-full rounded-full transition-[width] duration-200 ease-out", loadTone(member.load))}
              style={{ width: `${Math.max(0, Math.min(100, member.load))}%` }}
            />
          </div>
        </div>
        <FsButton variant="ghost" size="sm" onClick={onRemove} className="text-tertiary hover:text-danger-primary">
          移除
        </FsButton>
      </div>
    </div>
  );
}

function InviteMemberModal({
  open,
  seatsFree,
  onClose,
  onSubmit,
}: {
  open: boolean;
  seatsFree: number;
  onClose: () => void;
  onSubmit: (input: { name: string; email: string; role: TeamMember["role"] }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRoleState] = useState<TeamMember["role"]>("助理");

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setRoleState("助理");
    }
  }, [open]);

  const valid = name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <FsModal
      open={open}
      onClose={onClose}
      title="邀请成员"
      footer={
        <>
          <FsButton variant="secondary" size="sm" onClick={onClose}>
            取消
          </FsButton>
          <FsButton
            size="sm"
            disabled={!valid}
            onClick={() => onSubmit({ name: name.trim(), email: email.trim(), role })}
          >
            发出邀请
          </FsButton>
        </>
      }
    >
      <div className="space-y-3">
        <FsField label="姓名">
          <input
            className={fsInputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：吴设计师"
            autoFocus
          />
        </FsField>
        <FsField label="邮箱">
          <input
            className={fsInputClass}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@studio.com"
          />
        </FsField>
        <FsField label="角色">
          <select
            className={fsInputClass}
            value={role}
            onChange={(e) => setRoleState(e.target.value as TeamMember["role"])}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </FsField>
        <FsMuted>
          加入即占用 1 个席位（剩余 {seatsFree} 个）· Demo：数据仅保存在本机，正式版发送邀请邮件
        </FsMuted>
      </div>
    </FsModal>
  );
}

/** @deprecated 使用 FormscapeTeamPage（团队管理） */
export const FormscapeUsersPage = FormscapeTeamPage;

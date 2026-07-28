import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useSearchParams } from "next/navigation";
import { Database, KeyRound, RefreshCw, ShieldCheck, UserPlus, Users } from "lucide-react";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import { PageHead } from "@/components/core/page-title";
import {
  AdminService,
  type AdminOverview,
  type AdminRole,
  type AdminUser,
  type AuditLog,
} from "@/services/admin.service";
import {
  FsButton,
  FsCard,
  FsCardTitle,
  FsField,
  fsInputClass,
  FsModal,
  FsMuted,
  FsPageBody,
  FsPageShell,
  FsStat,
  FsTag,
} from "./ui";

type AdminTab = "overview" | "users" | "audit";

const adminService = new AdminService();
const roleLabels: Record<AdminRole, string> = {
  owner: "所有者",
  admin: "管理员",
  member: "成员",
  viewer: "只读",
};

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

function formatTime(value: string | null) {
  if (!value) return "尚未登录";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function FormscapeAdminPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<AdminTab>(initialTab === "users" || initialTab === "audit" ? initialTab : "overview");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextOverview, nextUsers, nextLogs] = await Promise.all([
        adminService.overview(),
        adminService.users(),
        adminService.auditLogs(),
      ]);
      setOverview(nextOverview);
      setUsers(nextUsers);
      setLogs(nextLogs);
      setForbidden(false);
    } catch (error: any) {
      setForbidden(error?.response?.status === 403);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "后台加载失败",
        message: error?.response?.data?.detail || "请稍后重试",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeUsers = useMemo(() => users.filter((user) => user.is_active), [users]);

  const createUser = async (input: { email: string; display_name: string; role: AdminRole }) => {
    try {
      const result = await adminService.createUser(input);
      setUsers((current) => [result.user, ...current]);
      setCredentials({ email: result.user.email, password: result.temporary_password });
      setInviteOpen(false);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "成员已创建", message: "临时密码仅展示一次" });
      void load();
    } catch (error: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "创建失败",
        message: error?.response?.data?.error === "email_exists" ? "该邮箱已经存在" : "请检查输入后重试",
      });
    }
  };

  const updateUser = async (user: AdminUser, data: Partial<Pick<AdminUser, "display_name" | "role" | "is_active">>) => {
    try {
      const result = await adminService.updateUser(user.id, data);
      setUsers((current) => current.map((item) => (item.id === user.id ? result.user : item)));
      setToast({ type: TOAST_TYPE.SUCCESS, title: "成员已更新", message: result.user.display_name });
      void load();
    } catch (error: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "更新失败",
        message:
          error?.response?.data?.error === "last_owner_required"
            ? "系统必须保留至少一位有效所有者"
            : error?.response?.data?.error === "cannot_deactivate_self"
              ? "不能停用当前登录账号"
              : "请稍后重试",
      });
    }
  };

  const resetPassword = async (user: AdminUser) => {
    const result = await adminService.resetPassword(user.id);
    setCredentials({ email: user.email, password: result.temporary_password });
    setToast({ type: TOAST_TYPE.SUCCESS, title: "密码已重置", message: "该用户的其他会话已退出" });
    void load();
  };

  if (forbidden) {
    return (
      <FsPageShell>
        <FsPageBody>
          <FsCard className="mx-auto mt-10 max-w-lg text-center">
            <ShieldCheck className="mx-auto size-8 text-tertiary" />
            <FsCardTitle className="mt-3">需要管理员权限</FsCardTitle>
            <FsMuted>只有所有者和管理员可以进入系统后台。</FsMuted>
            <Link to="/formscape" className="mt-4 inline-block text-13 font-medium text-accent-primary">
              返回工作台
            </Link>
          </FsCard>
        </FsPageBody>
      </FsPageShell>
    );
  }

  return (
    <>
      <PageHead title="系统后台 · 构境AI" />
      <FsPageShell>
        <div className="shrink-0 border-b border-subtle bg-surface-1">
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-2">
            <div>
              <div className="text-14 font-semibold text-primary">系统后台</div>
              <div className="text-11 text-tertiary">用户、权限、数据库与安全审计</div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/formscape" className="text-12 font-medium text-secondary hover:text-primary">
                返回工作台
              </Link>
              <FsButton variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                刷新
              </FsButton>
              <FsButton size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus className="size-3.5" />
                新建成员
              </FsButton>
            </div>
          </div>
          <div className="flex gap-1 px-4">
            {(
              [
                ["overview", "总览"],
                ["users", `用户 ${users.length}`],
                ["audit", "审计日志"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`border-b-2 px-3 py-2 text-12 font-medium ${
                  tab === key
                    ? "border-accent-strong text-accent-primary"
                    : "border-transparent text-tertiary hover:text-primary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <FsPageBody>
          {loading && !overview ? (
            <div className="py-16 text-center text-13 text-tertiary">正在读取后台数据…</div>
          ) : tab === "overview" && overview ? (
            <OverviewPanel overview={overview} activeUsers={activeUsers.length} />
          ) : tab === "users" ? (
            <UsersPanel
              users={users}
              onUpdate={updateUser}
              onReset={resetPassword}
              onRevoke={async (user) => {
                const result = await adminService.revokeSessions(user.id);
                setToast({
                  type: TOAST_TYPE.SUCCESS,
                  title: "会话已撤销",
                  message: `共退出 ${result.revoked} 个会话`,
                });
                void load();
              }}
            />
          ) : (
            <AuditPanel logs={logs} />
          )}
        </FsPageBody>
      </FsPageShell>

      <CreateUserModal open={inviteOpen} onClose={() => setInviteOpen(false)} onSubmit={createUser} />
      <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />
    </>
  );
}

function OverviewPanel({ overview, activeUsers }: { overview: AdminOverview; activeUsers: number }) {
  const vector = overview.database.extensions.find((extension) => extension.extname === "vector");
  const documentCount = Object.values(overview.entities).reduce((sum, count) => sum + count, 0);
  return (
    <div className="w-full space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FsCard className="!p-4">
          <Users className="mb-3 size-5 text-accent-primary" />
          <FsStat label="有效用户" value={`${activeUsers}/${overview.users.total}`} />
        </FsCard>
        <FsCard className="!p-4">
          <KeyRound className="mb-3 size-5 text-accent-primary" />
          <FsStat
            label="活跃会话"
            value={overview.sessions.active}
            hint={`有效期 ${overview.auth.session_ttl_days} 天`}
          />
        </FsCard>
        <FsCard className="!p-4">
          <Database className="mb-3 size-5 text-accent-primary" />
          <FsStat label="业务文档" value={documentCount} hint={formatBytes(overview.database.bytes)} />
        </FsCard>
        <FsCard className="!p-4">
          <ShieldCheck className="mb-3 size-5 text-accent-primary" />
          <FsStat label="24 小时安全事件" value={overview.audit.last_24h} />
        </FsCard>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <FsCard>
          <FsCardTitle>PostgreSQL 数据库</FsCardTitle>
          <div className="space-y-2 text-12">
            <InfoRow label="数据库" value={overview.database.name} />
            <InfoRow label="容量" value={formatBytes(overview.database.bytes)} />
            <InfoRow label="向量扩展" value={vector ? `pgvector ${vector.extversion}` : "未启用"} />
            <InfoRow label="JSONB 文档" value={`${documentCount} 条`} />
          </div>
          <FsMuted className="mt-3 line-clamp-2">{overview.database.version}</FsMuted>
        </FsCard>
        <FsCard>
          <FsCardTitle>认证策略</FsCardTitle>
          <div className="space-y-2 text-12">
            <InfoRow label="密码" value="scrypt 强哈希" />
            <InfoRow label="会话" value="HttpOnly + SameSite + CSRF" />
            <InfoRow label="公开注册" value={overview.auth.signup_enabled ? "开启" : "关闭"} />
            <InfoRow label="邮件找回" value={overview.auth.smtp_configured ? "已配置" : "待配置 SMTP"} />
          </div>
        </FsCard>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-subtle/70 pb-2">
      <span className="text-tertiary">{label}</span>
      <span className="text-right font-medium text-primary">{value}</span>
    </div>
  );
}

function UsersPanel({
  users,
  onUpdate,
  onReset,
  onRevoke,
}: {
  users: AdminUser[];
  onUpdate: (user: AdminUser, data: Partial<Pick<AdminUser, "display_name" | "role" | "is_active">>) => Promise<void>;
  onReset: (user: AdminUser) => Promise<void>;
  onRevoke: (user: AdminUser) => Promise<void>;
}) {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-subtle bg-surface-1">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-12">
          <thead className="border-b border-subtle bg-surface-2 text-tertiary">
            <tr>
              <th className="px-3 py-2.5 font-medium">用户</th>
              <th className="px-3 py-2.5 font-medium">角色</th>
              <th className="px-3 py-2.5 font-medium">状态</th>
              <th className="px-3 py-2.5 font-medium">会话</th>
              <th className="px-3 py-2.5 font-medium">最近登录</th>
              <th className="px-3 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {users.map((user) => (
              <tr key={user.id} className="text-secondary">
                <td className="px-3 py-3">
                  <div className="font-medium text-primary">{user.display_name || user.email}</div>
                  <div className="text-11 text-tertiary">{user.email}</div>
                </td>
                <td className="px-3 py-3">
                  <select
                    value={user.role}
                    onChange={(event) => void onUpdate(user, { role: event.target.value as AdminRole })}
                    className="h-8 rounded-md border border-subtle bg-surface-1 px-2 text-12"
                  >
                    {(Object.keys(roleLabels) as AdminRole[]).map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-3">
                  <FsTag tone={user.is_active ? "brand" : "warning"}>{user.is_active ? "有效" : "已停用"}</FsTag>
                  {user.must_change_password && <FsTag className="ml-1">待改密</FsTag>}
                </td>
                <td className="px-3 py-3 tabular-nums">{user.active_sessions}</td>
                <td className="px-3 py-3 text-11">{formatTime(user.last_login_at)}</td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <FsButton variant="ghost" size="sm" onClick={() => void onReset(user)}>
                      重置密码
                    </FsButton>
                    <FsButton variant="ghost" size="sm" onClick={() => void onRevoke(user)}>
                      退出会话
                    </FsButton>
                    <FsButton
                      variant="ghost"
                      size="sm"
                      onClick={() => void onUpdate(user, { is_active: !user.is_active })}
                    >
                      {user.is_active ? "停用" : "启用"}
                    </FsButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditPanel({ logs }: { logs: AuditLog[] }) {
  return (
    <div className="w-full space-y-2">
      {logs.length === 0 ? (
        <FsCard className="text-center">
          <FsMuted>暂无审计记录</FsMuted>
        </FsCard>
      ) : (
        logs.map((log) => (
          <FsCard key={log.id} className="!p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-12 font-medium text-primary">{log.action}</div>
                <div className="mt-0.5 text-11 text-tertiary">
                  {log.actor_name || log.actor_email || "系统"} · {log.target_type || "system"}
                  {log.target_id ? ` / ${log.target_id}` : ""}
                </div>
              </div>
              <span className="text-11 text-tertiary">{formatTime(log.created_at)}</span>
            </div>
          </FsCard>
        ))
      )}
    </div>
  );
}

function CreateUserModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { email: string; display_name: string; role: AdminRole }) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AdminRole>("member");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setName("");
    setRole("member");
    setSubmitting(false);
  }, [open]);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && name.trim().length > 0;
  return (
    <FsModal
      open={open}
      onClose={onClose}
      title="新建成员"
      footer={
        <>
          <FsButton variant="secondary" size="sm" onClick={onClose}>
            取消
          </FsButton>
          <FsButton
            size="sm"
            disabled={!valid || submitting}
            onClick={async () => {
              setSubmitting(true);
              await onSubmit({ email: email.trim(), display_name: name.trim(), role });
              setSubmitting(false);
            }}
          >
            {submitting ? "创建中…" : "创建账号"}
          </FsButton>
        </>
      }
    >
      <div className="space-y-3">
        <FsField label="姓名">
          <input className={fsInputClass} value={name} onChange={(event) => setName(event.target.value)} />
        </FsField>
        <FsField label="邮箱">
          <input
            className={fsInputClass}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FsField>
        <FsField label="系统角色">
          <select className={fsInputClass} value={role} onChange={(event) => setRole(event.target.value as AdminRole)}>
            {(Object.keys(roleLabels) as AdminRole[]).map((item) => (
              <option key={item} value={item}>
                {roleLabels[item]}
              </option>
            ))}
          </select>
        </FsField>
        <FsMuted>系统会生成一次性临时密码，首次登录后必须修改。</FsMuted>
      </div>
    </FsModal>
  );
}

function CredentialsModal({
  credentials,
  onClose,
}: {
  credentials: { email: string; password: string } | null;
  onClose: () => void;
}) {
  return (
    <FsModal
      open={credentials !== null}
      onClose={onClose}
      title="临时登录凭据"
      footer={
        <FsButton size="sm" onClick={onClose}>
          已安全保存
        </FsButton>
      }
    >
      {credentials && (
        <div className="space-y-3">
          <FsMuted>密码关闭后无法再次查看，请通过安全渠道交给成员。</FsMuted>
          <div className="font-mono rounded-lg border border-subtle bg-surface-2 p-3 text-12">
            <div>{credentials.email}</div>
            <div className="mt-1 font-semibold break-all text-primary">{credentials.password}</div>
          </div>
          <FsButton
            variant="secondary"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(`${credentials.email}\n${credentials.password}`);
              setToast({ type: TOAST_TYPE.SUCCESS, title: "已复制", message: "请妥善保管临时凭据" });
            }}
          >
            复制凭据
          </FsButton>
        </div>
      )}
    </FsModal>
  );
}

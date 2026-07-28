/**
 * 客户库（Demo · localStorage CRUD）
 * - 新建 / 编辑 / 删除 / 详情侧板（联系方式 · 关联项目 · 备注时间线）
 * - 搜索 + 阶段筛选（消费 URL ?stage=，L2 侧栏带参导航）
 * - 业主 Portal 入口只在这里（客户详情 → 项目关联 → 新窗口打开）
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ExternalLink, Pencil, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import { cn } from "@plane/utils";
import { PageHead } from "@/components/core/page-title";
import {
  CUSTOMER_SOURCES,
  CUSTOMER_STAGES,
  CUSTOMERS_CHANGE_EVENT,
  PORTAL_CHANGE_EVENT,
  PORTAL_STEPS,
  addCustomerNote,
  createCustomer,
  deleteCustomer,
  getCustomers,
  getPortalSummary,
  portalStatusLabel,
  portalStatusTone,
  toggleCustomerProject,
  updateCustomer,
  type CustomerDraft,
  type CustomerRecord,
  type CustomerStage,
} from "./customers-store";
import { listProjects } from "./projects-store";
import { createPortalShare } from "./portal-api";
import {
  FsButton,
  FsCard,
  FsEmpty,
  FsField,
  FsModal,
  FsConfirm,
  FsMuted,
  FsPageBody,
  FsPageHeader,
  FsPageShell,
  FsPageTitle,
  FsTag,
  FsTextLink,
  fsInputClass,
  type FsTagTone,
} from "./ui";

type Props = { workspaceSlug: string };

const STAGE_TONE: Record<CustomerStage, FsTagTone> = {
  线索: "neutral",
  量房: "brand",
  方案: "brand",
  施工: "warning",
  已交付: "success",
};

const EMPTY_DRAFT: CustomerDraft = {
  name: "",
  phone: "",
  wechat: "",
  source: CUSTOMER_SOURCES[0],
  city: "",
  stage: "线索",
  budgetWan: undefined,
  note: "",
};

function formatTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDay(iso?: string): string {
  return formatTime(iso).slice(0, 10);
}

export function FormscapeCustomersPage({ workspaceSlug }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 新建 / 编辑弹窗
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CustomerDraft>(EMPTY_DRAFT);
  // 删除确认
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const reload = useCallback(() => setCustomers(getCustomers()), []);

  useEffect(() => {
    reload();
    window.addEventListener(CUSTOMERS_CHANGE_EVENT, reload);
    // Portal 在新窗口写回执 → storage 事件跨标签刷新徽标
    window.addEventListener(PORTAL_CHANGE_EVENT, reload as EventListener);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(CUSTOMERS_CHANGE_EVENT, reload);
      window.removeEventListener(PORTAL_CHANGE_EVENT, reload as EventListener);
      window.removeEventListener("storage", reload);
    };
  }, [reload]);

  // URL ?stage=<阶段key>（key 即客户数据的阶段字段值）
  const rawStage = searchParams.get("stage");
  const stageFilter: CustomerStage | null =
    rawStage && (CUSTOMER_STAGES as readonly string[]).includes(rawStage) ? (rawStage as CustomerStage) : null;

  const setStageFilter = useCallback(
    (stage: CustomerStage | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (stage) next.set("stage", stage);
          else next.delete("stage");
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      if (stageFilter && c.stage !== stageFilter) return false;
      if (!q) return true;
      const hay = `${c.name} ${c.phone} ${c.wechat} ${c.city} ${c.source}`.toLowerCase();
      return hay.includes(q);
    });
  }, [customers, query, stageFilter]);

  const selected = selectedId ? (customers.find((c) => c.id === selectedId) ?? null) : null;
  const deleting = deletingId ? (customers.find((c) => c.id === deletingId) ?? null) : null;

  const openCreate = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormOpen(true);
  };

  const openEdit = (c: CustomerRecord) => {
    setEditingId(c.id);
    setDraft({
      name: c.name,
      phone: c.phone,
      wechat: c.wechat,
      source: c.source,
      city: c.city,
      stage: c.stage,
      budgetWan: c.budgetWan,
      note: "",
    });
    setFormOpen(true);
  };

  const submitForm = () => {
    if (!draft.name.trim()) {
      setToast({ type: TOAST_TYPE.WARNING, title: "请填写客户姓名" });
      return;
    }
    if (editingId) {
      updateCustomer(editingId, draft);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "客户资料已更新" });
    } else {
      const created = createCustomer(draft);
      setSelectedId(created.id);
      setToast({ type: TOAST_TYPE.SUCCESS, title: `已建立客户「${created.name}」` });
    }
    setFormOpen(false);
    reload();
  };

  const confirmDelete = () => {
    if (!deletingId) return;
    const name = deleting?.name ?? "";
    deleteCustomer(deletingId);
    if (selectedId === deletingId) setSelectedId(null);
    setDeletingId(null);
    reload();
    setToast({ type: TOAST_TYPE.SUCCESS, title: `已删除客户「${name}」` });
  };

  const stagePills: Array<{ label: string; value: CustomerStage | null; count: number }> = [
    { label: "全部", value: null, count: customers.length },
    ...CUSTOMER_STAGES.map((s) => ({
      label: s,
      value: s as CustomerStage | null,
      count: customers.filter((c) => c.stage === s).length,
    })),
  ];

  return (
    <>
      <PageHead title="客户 · 构境AI" />
      <FsPageShell>
        <FsPageHeader
          title="客户"
          description="一个客户挂多个项目 · 进展随时说清楚"
          actions={
            <FsButton size="sm" onClick={openCreate}>
              <Plus className="size-3.5" strokeWidth={1.75} />
              新建客户
            </FsButton>
          }
        />
        <FsPageBody>
          <div className="mx-auto w-full max-w-5xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <FsPageTitle>客户</FsPageTitle>
              <FsTag tone="neutral">{customers.length} 位</FsTag>
              <FsMuted>服务端保存 · 与项目档案联动</FsMuted>
            </div>

            {/* 工具条：搜索 + 阶段筛选胶囊 */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full max-w-xs">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-placeholder"
                  strokeWidth={1.75}
                />
                <input
                  type="search"
                  aria-label="搜索客户"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜姓名 / 电话 / 微信 / 城市"
                  className={cn(fsInputClass, "pl-8")}
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {stagePills.map((p) => {
                  const active = stageFilter === p.value;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setStageFilter(p.value)}
                      className={cn(
                        "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-11 font-medium transition-colors",
                        active
                          ? "bg-accent-subtle text-accent-secondary"
                          : "bg-surface-2 text-tertiary hover:text-secondary"
                      )}
                    >
                      {p.label}
                      <span className="tabular-nums">{p.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 客户表格 */}
            {customers.length === 0 ? (
              <FsEmpty
                title="把第一位客户记下来"
                body="姓名和电话就够了，进展、项目、备注都会自动挂在这个人身上。"
                action={
                  <FsButton onClick={openCreate}>
                    <Plus className="size-3.5" strokeWidth={1.75} />
                    新建客户
                  </FsButton>
                }
              />
            ) : filtered.length === 0 ? (
              <FsEmpty
                title="这个筛选下暂时没有客户"
                body="换个阶段或清空搜索，客户都还在。"
                action={
                  <FsButton
                    variant="secondary"
                    onClick={() => {
                      setQuery("");
                      setStageFilter(null);
                    }}
                  >
                    清除筛选
                  </FsButton>
                }
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-subtle">
                <table className="w-full text-left text-13">
                  <thead className="border-b border-subtle bg-surface-1 text-11 font-medium text-tertiary">
                    <tr>
                      <th className="px-3 py-2.5">客户</th>
                      <th className="hidden px-3 py-2.5 md:table-cell">来源</th>
                      <th className="hidden px-3 py-2.5 sm:table-cell">城市</th>
                      <th className="px-3 py-2.5">阶段</th>
                      <th className="hidden px-3 py-2.5 md:table-cell">关联项目</th>
                      <th className="px-3 py-2.5 text-right">预算</th>
                      <th className="hidden px-3 py-2.5 lg:table-cell">更新</th>
                      <th className="px-3 py-2.5 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const projects = listProjects().filter((p) => c.projectIds.includes(p.id));
                      return (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedId(c.id)}
                          className={cn(
                            "cursor-pointer border-b border-subtle transition-colors last:border-0 hover:bg-surface-2/60",
                            selectedId === c.id && "bg-accent-subtle/40"
                          )}
                        >
                          <td className="px-3 py-2.5">
                            <div className="font-medium text-primary">{c.name}</div>
                            <div className="text-11 text-tertiary tabular-nums">{c.phone || "—"}</div>
                          </td>
                          <td className="hidden px-3 py-2.5 text-secondary md:table-cell">{c.source}</td>
                          <td className="hidden px-3 py-2.5 text-secondary sm:table-cell">{c.city || "—"}</td>
                          <td className="px-3 py-2.5">
                            <FsTag tone={STAGE_TONE[c.stage]}>{c.stage}</FsTag>
                          </td>
                          <td className="hidden px-3 py-2.5 md:table-cell">
                            {projects.length === 0 ? (
                              <span className="text-11 text-placeholder">未关联</span>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                {projects.map((p) => (
                                  <FsTextLink key={p.id} to={`/${workspaceSlug}/projects/${p.id}/overview`}>
                                    {p.name}
                                  </FsTextLink>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-secondary tabular-nums">
                            {c.budgetWan !== undefined ? `${c.budgetWan} 万` : "—"}
                          </td>
                          <td className="hidden px-3 py-2.5 text-11 text-tertiary tabular-nums lg:table-cell">
                            {formatDay(c.updatedAt)}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                title="编辑"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(c);
                                }}
                                className="rounded-full p-1.5 text-tertiary transition-colors hover:bg-layer-transparent-hover hover:text-primary"
                              >
                                <Pencil className="size-3.5" strokeWidth={1.75} />
                              </button>
                              <button
                                type="button"
                                title="删除"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingId(c.id);
                                }}
                                className="rounded-full p-1.5 text-tertiary transition-colors hover:bg-danger-subtle hover:text-danger-primary"
                              >
                                <Trash2 className="size-3.5" strokeWidth={1.75} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <FsMuted>
              客户与项目的关联为演示数据（来自内置示例项目）；业主查看进展只走「业主 Portal」，不进入工作台。
            </FsMuted>
          </div>
        </FsPageBody>
      </FsPageShell>

      {/* 详情侧板 */}
      {selected && (
        <CustomerDetailPanel
          key={selected.id}
          customer={selected}
          workspaceSlug={workspaceSlug}
          onClose={() => setSelectedId(null)}
          onEdit={() => openEdit(selected)}
          onDelete={() => setDeletingId(selected.id)}
          onChanged={reload}
        />
      )}

      {/* 新建 / 编辑弹窗 */}
      <FsModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? "编辑客户" : "新建客户"}
        width="md"
        footer={
          <>
            <FsButton variant="secondary" size="sm" onClick={() => setFormOpen(false)}>
              取消
            </FsButton>
            <FsButton size="sm" onClick={submitForm}>
              {editingId ? "保存" : "建立客户"}
            </FsButton>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FsField label="姓名 *">
            <input
              className={fsInputClass}
              value={draft.name}
              autoFocus
              placeholder="如：陈女士"
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </FsField>
          <FsField label="电话">
            <input
              className={fsInputClass}
              value={draft.phone}
              placeholder="138…"
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
            />
          </FsField>
          <FsField label="微信">
            <input
              className={fsInputClass}
              value={draft.wechat}
              placeholder="微信号"
              onChange={(e) => setDraft((d) => ({ ...d, wechat: e.target.value }))}
            />
          </FsField>
          <FsField label="来源">
            <select
              className={fsInputClass}
              value={draft.source}
              onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
            >
              {CUSTOMER_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FsField>
          <FsField label="阶段">
            <select
              className={fsInputClass}
              value={draft.stage}
              onChange={(e) => setDraft((d) => ({ ...d, stage: e.target.value as CustomerStage }))}
            >
              {CUSTOMER_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FsField>
          <FsField label="城市">
            <input
              className={fsInputClass}
              value={draft.city}
              placeholder="如：杭州"
              onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
            />
          </FsField>
          <FsField label="预算（万）">
            <input
              className={cn(fsInputClass, "tabular-nums")}
              value={draft.budgetWan ?? ""}
              inputMode="decimal"
              placeholder="选填"
              onChange={(e) => {
                const v = e.target.value.trim();
                const n = Number(v);
                setDraft((d) => ({ ...d, budgetWan: v === "" || Number.isNaN(n) ? undefined : n }));
              }}
            />
          </FsField>
          {!editingId && (
            <FsField label="备注" className="sm:col-span-2">
              <textarea
                className={cn(fsInputClass, "min-h-16 resize-y")}
                value={draft.note ?? ""}
                placeholder="第一条备注，会进入客户时间线"
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              />
            </FsField>
          )}
        </div>
      </FsModal>

      {/* 删除确认 */}
      <FsConfirm
        open={!!deletingId}
        onCancel={() => setDeletingId(null)}
        onConfirm={confirmDelete}
        danger
        title={`删除客户「${deleting?.name ?? ""}」？`}
        body="删除后备注时间线一并移除；关联的项目本身不受影响。"
        confirmLabel="删除"
      />
    </>
  );
}

/* ============================== 详情侧板 ============================== */

function CustomerDetailPanel({
  customer,
  workspaceSlug,
  onClose,
  onEdit,
  onDelete,
  onChanged,
}: {
  customer: CustomerRecord;
  workspaceSlug: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const [noteText, setNoteText] = useState("");
  const [manageProjects, setManageProjects] = useState(false);
  const [sharingProjectId, setSharingProjectId] = useState<string | null>(null);

  const linkedProjects = listProjects().filter((p) => customer.projectIds.includes(p.id));

  const submitNote = () => {
    if (!noteText.trim()) return;
    addCustomerNote(customer.id, noteText);
    setNoteText("");
    onChanged();
    setToast({ type: TOAST_TYPE.SUCCESS, title: "备注已记录" });
  };

  const openPortal = async (projectId: string) => {
    const preview = window.open("about:blank", "_blank");
    if (preview) preview.opener = null;
    setSharingProjectId(projectId);
    try {
      const share = await createPortalShare(projectId);
      const path = `/portal/${encodeURIComponent(projectId)}/${encodeURIComponent(share.token)}`;
      const url = new URL(path, window.location.origin).toString();
      await navigator.clipboard?.writeText(url).catch(() => undefined);
      if (preview) preview.location.href = url;
      else window.open(url, "_blank", "noopener");
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "安全链接已生成并复制",
        message: "链接 30 天内有效；再次生成会让旧链接立即失效",
      });
    } catch {
      preview?.close();
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "分享链接生成失败",
        message: "请稍后重试",
      });
    } finally {
      setSharingProjectId(null);
    }
  };

  return (
    <div className="fs-ui-pop fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col border-l border-subtle bg-surface-1 shadow-overlay-200">
      {/* 头部 */}
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-subtle px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent-secondary">
            <UserRound className="size-4.5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate text-15 font-semibold text-primary">{customer.name}</div>
              <FsTag tone={STAGE_TONE[customer.stage]}>{customer.stage}</FsTag>
            </div>
            <div className="text-11 text-tertiary">
              更新于 <span className="tabular-nums">{formatTime(customer.updatedAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <FsButton variant="secondary" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" strokeWidth={1.75} />
            编辑
          </FsButton>
          <button
            type="button"
            title="关闭"
            onClick={onClose}
            className="rounded-full p-1.5 text-tertiary transition-colors hover:bg-layer-transparent-hover hover:text-primary"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* 内容 */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {/* 联系方式 */}
        <FsCard className="p-3.5">
          <div className="mb-2 text-13 font-semibold text-primary">联系方式</div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-12">
            <div>
              <dt className="text-tertiary">电话</dt>
              <dd className="mt-0.5 text-primary tabular-nums">{customer.phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-tertiary">微信</dt>
              <dd className="mt-0.5 text-primary">{customer.wechat || "—"}</dd>
            </div>
            <div>
              <dt className="text-tertiary">来源</dt>
              <dd className="mt-0.5 text-primary">{customer.source}</dd>
            </div>
            <div>
              <dt className="text-tertiary">城市</dt>
              <dd className="mt-0.5 text-primary">{customer.city || "—"}</dd>
            </div>
            <div>
              <dt className="text-tertiary">预算</dt>
              <dd className="mt-0.5 text-primary tabular-nums">
                {customer.budgetWan !== undefined ? `${customer.budgetWan} 万` : "—"}
              </dd>
            </div>
          </dl>
        </FsCard>

        {/* 关联项目 + Portal 入口 */}
        <FsCard className="p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="text-13 font-semibold text-primary">关联项目</div>
              <FsTag tone="neutral">Demo 数据</FsTag>
            </div>
            <FsButton variant="ghost" size="sm" onClick={() => setManageProjects((v) => !v)}>
              {manageProjects ? "完成" : "管理关联"}
            </FsButton>
          </div>

          {manageProjects ? (
            <div className="space-y-1.5">
              {listProjects().map((p) => {
                const linked = customer.projectIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-12 text-secondary transition-colors hover:bg-layer-transparent-hover"
                  >
                    <input
                      type="checkbox"
                      className="accent-[var(--brand-default)]"
                      checked={linked}
                      onChange={() => {
                        toggleCustomerProject(customer.id, p.id);
                        onChanged();
                      }}
                    />
                    <span>{p.name}</span>
                  </label>
                );
              })}
              <FsMuted>项目来自内置示例，用于演示客户与项目的归属关系。</FsMuted>
            </div>
          ) : linkedProjects.length === 0 ? (
            <FsMuted>还没关联项目 · 点「管理关联」把项目挂到这位客户名下。</FsMuted>
          ) : (
            <div className="space-y-2.5">
              {linkedProjects.map((p) => {
                const summary = getPortalSummary(p.id);
                return (
                  <div key={p.id} className="rounded-lg border border-subtle p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <FsTextLink to={`/${workspaceSlug}/projects/${p.id}/overview`} className="truncate">
                        {p.name}
                      </FsTextLink>
                      <FsButton
                        variant="secondary"
                        size="sm"
                        disabled={sharingProjectId === p.id}
                        onClick={() => void openPortal(p.id)}
                      >
                        <ExternalLink className="size-3.5" strokeWidth={1.75} />
                        {sharingProjectId === p.id ? "生成中…" : "生成安全链接"}
                      </FsButton>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {PORTAL_STEPS.map((s) => {
                        const st = summary.state[s.key];
                        return (
                          <FsTag key={s.key} tone={portalStatusTone(st.status)}>
                            {s.label} · {portalStatusLabel(st.status)}
                          </FsTag>
                        );
                      })}
                    </div>
                    {summary.rejected > 0 && (
                      <div className="mt-1.5 text-11 text-danger-primary">业主提了意见，去 Portal 看批注内容。</div>
                    )}
                  </div>
                );
              })}
              <FsMuted>业主只会看到 Portal 四步进展；链接 30 天有效，再次生成会撤销旧链接。</FsMuted>
            </div>
          )}
        </FsCard>

        {/* 备注时间线 */}
        <FsCard className="p-3.5">
          <div className="mb-2 text-13 font-semibold text-primary">备注时间线</div>
          <div className="flex items-center gap-2">
            <input
              className={fsInputClass}
              value={noteText}
              placeholder="记一条进展，如：已发方案 A/B 待选"
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNote();
              }}
            />
            <FsButton size="sm" onClick={submitNote} disabled={!noteText.trim()}>
              记录
            </FsButton>
          </div>
          {customer.notes.length === 0 ? (
            <FsMuted className="mt-3">还没有备注 · 记录第一条进展吧。</FsMuted>
          ) : (
            <ol className="mt-3 space-y-2.5 border-l border-subtle pl-3">
              {customer.notes.map((n) => (
                <li key={n.id} className="relative">
                  <span className="absolute top-1.5 -left-[17px] size-2 rounded-full bg-accent-primary" aria-hidden />
                  <div className="text-12 text-primary">{n.text}</div>
                  <div className="text-10 text-tertiary tabular-nums">{formatTime(n.at)}</div>
                </li>
              ))}
            </ol>
          )}
        </FsCard>

        {/* 危险区 */}
        <div className="flex justify-end pb-2">
          <FsButton variant="ghost" size="sm" className="text-danger-primary" onClick={onDelete}>
            <Trash2 className="size-3.5" strokeWidth={1.75} />
            删除客户
          </FsButton>
        </div>
      </div>
    </div>
  );
}

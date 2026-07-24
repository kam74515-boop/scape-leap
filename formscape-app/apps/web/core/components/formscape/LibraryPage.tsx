/**
 * 生态库 — 数据来自 ark Mini program；含设计师侧「采购」功能页
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { observer } from "mobx-react";
import { useParams, useSearchParams } from "next/navigation";
import { cn } from "@plane/utils";
import {
  ChevronDown,
  LayoutGrid,
  LayoutList,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
} from "@/icons";
import { PageHead } from "@/components/core/page-title";
import { AppSidebarToggleButton } from "@/components/sidebar/sidebar-toggle-button";
import { useAppTheme } from "@/hooks/store/use-app-theme";
import {
  ECO_BRANDS,
  ECO_CASES,
  ECO_CATEGORIES,
  ECO_COMBOS,
  ECO_FILTERS,
  ECO_MODES,
  ECO_PRODUCTS,
  ECO_SPACES,
  ecoFallbackGradient,
  filterEcoProducts,
  type EcoCase,
  type EcoCombo,
  type EcoMode,
  type EcoProduct,
  type EcoSpace,
} from "./ecology-mock";
import { PM_PROJECTS } from "./pm-mock";
import {
  groupPurchaseByProject,
  PURCHASE_STATUS_FLOW,
  PURCHASE_STATUS_META,
  type PurchaseLine,
  type PurchaseStatus,
} from "./purchase-store";
import { usePurchase } from "./use-purchase";
import { FsMuted, FsPageBody, FsPageShell, FsTag } from "./ui";

function Cover({
  src,
  alt,
  seed,
  className,
}: {
  src?: string;
  alt: string;
  seed: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className={cn("bg-surface-2", className)}
        style={{ background: ecoFallbackGradient(seed) }}
        role="img"
        aria-label={alt}
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={cn("object-cover", className)}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function parseMode(raw: string | null): EcoMode {
  if (raw === "combos" || raw === "cases" || raw === "spaces" || raw === "purchase" || raw === "products") {
    return raw;
  }
  if (raw === "procurement" || raw === "cart") return "purchase";
  return "products";
}

export const FormscapeLibraryPage = observer(function FormscapeLibraryPage() {
  const searchParams = useSearchParams();
  const navigate = useNavigate();
  const { workspaceSlug } = useParams();
  const { sidebarCollapsed } = useAppTheme();
  const ws = workspaceSlug?.toString() ?? "formscape";
  const initialMode = parseMode(searchParams.get("mode") ?? searchParams.get("tab"));
  const [mode, setModeState] = useState<EcoMode>(initialMode);
  const [category, setCategory] = useState<string>("sofa");
  const [brand, setBrand] = useState<string>("全部");
  const [viewMode, setViewMode] = useState<"waterfall" | "list">("waterfall");
  const [filterOpen, setFilterOpen] = useState<string | null>(null);
  const [addFlash, setAddFlash] = useState<string | null>(null);
  const purchase = usePurchase();

  const setMode = useCallback(
    (m: EcoMode) => {
      setModeState(m);
      navigate(`/${ws}/library?mode=${m}`, { replace: true });
    },
    [navigate, ws]
  );

  useEffect(() => {
    const m = parseMode(searchParams.get("mode") ?? searchParams.get("tab"));
    setModeState(m);
  }, [searchParams]);

  const isComboCategory = category === "combo";
  const products = useMemo(
    () => filterEcoProducts(ECO_PRODUCTS, category, brand),
    [category, brand]
  );

  const flashAdded = (name: string) => {
    setAddFlash(name);
    window.setTimeout(() => setAddFlash(null), 1600);
  };

  const onAddProduct = (p: EcoProduct) => {
    purchase.addProduct(p);
    flashAdded(p.name);
  };

  const onAddCombo = (c: EcoCombo) => {
    purchase.addCombo(c.productIds.length ? c.productIds : []);
    // 组合无 productIds 时退化为按名称提示
    flashAdded(c.name);
  };

  return (
    <>
      <PageHead title="生态库 · 构境AI" />
      <FsPageShell>
        <div className="shrink-0 border-b border-subtle bg-surface-1">
          <div className="flex h-11 items-center justify-between gap-2 border-b border-subtle px-3">
            <div className="flex min-w-0 items-center gap-1.5">
              {sidebarCollapsed === true && (
                <div className="flex shrink-0 items-center">
                  <AppSidebarToggleButton />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-13 font-semibold text-primary">生态库</div>
                <div className="text-11 text-tertiary">
                  单品 {ECO_PRODUCTS.length} · 组合 {ECO_COMBOS.length} · 案例 {ECO_CASES.length} ·
                  空间 {ECO_SPACES.length}
                  <span className="text-placeholder"> · 采购 {purchase.count} 件</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {addFlash && (
                <span className="hidden text-11 text-accent-primary sm:inline">
                  已加入 · {addFlash}
                </span>
              )}
              <button
                type="button"
                onClick={() => setMode("purchase")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-11 font-medium",
                  mode === "purchase"
                    ? "border-accent-primary/40 bg-accent-subtle text-accent-primary"
                    : "border-subtle text-secondary hover:bg-surface-2"
                )}
              >
                <ShoppingCart className="size-3.5" strokeWidth={1.5} />
                采购
                {purchase.count > 0 && (
                  <span className="rounded-sm bg-accent-primary px-1 text-[10px] text-on-color">
                    {purchase.count}
                  </span>
                )}
              </button>
              <div className="flex rounded-md border border-subtle p-0.5">
                {ECO_MODES.filter((m) => m.key !== "purchase").map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => {
                      setMode(m.key);
                      if (m.key === "combos") setCategory("combo");
                      if (m.key === "products" && category === "combo") setCategory("sofa");
                    }}
                    className={cn(
                      "rounded px-2.5 py-1 text-11 font-medium transition-colors",
                      mode === m.key
                        ? "bg-accent-primary text-on-color"
                        : "text-secondary hover:bg-surface-2"
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {mode === "products" && (
            <>
              <div className="flex gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none]">
                {ECO_CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCategory(cat.key)}
                    className={cn(
                      "shrink-0 rounded-md px-2.5 py-1 text-11 font-medium transition-colors",
                      category === cat.key
                        ? "bg-accent-primary text-on-color"
                        : "bg-surface-2 text-secondary hover:bg-layer-transparent-hover"
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 border-t border-subtle px-3 py-1.5">
                <button
                  type="button"
                  className="flex size-7 shrink-0 items-center justify-center rounded-md border border-subtle text-secondary hover:bg-surface-2"
                  aria-label={viewMode === "list" ? "瀑布流" : "列表"}
                  onClick={() => setViewMode((v) => (v === "list" ? "waterfall" : "list"))}
                >
                  {viewMode === "list" ? (
                    <LayoutGrid className="size-3.5" strokeWidth={1.5} />
                  ) : (
                    <LayoutList className="size-3.5" strokeWidth={1.5} />
                  )}
                </button>
                <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
                  {ECO_FILTERS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilterOpen(filterOpen === f ? null : f)}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-0.5 rounded-md border border-subtle px-2 py-1 text-11 text-secondary hover:bg-surface-2",
                        filterOpen === f && "border-accent-primary/40 text-accent-primary"
                      )}
                    >
                      {f}
                      <ChevronDown className="size-2.5 opacity-50" strokeWidth={1.5} />
                    </button>
                  ))}
                </div>
                <span className="shrink-0 text-11 text-placeholder">{products.length} 件</span>
              </div>
            </>
          )}
        </div>

        <FsPageBody className="!p-0">
          {mode === "purchase" && (
            <PurchasePanel
              lines={purchase.lines}
              totals={purchase.totals}
              onQty={purchase.setQty}
              onStatus={purchase.setStatus}
              onProject={purchase.setProject}
              onRemove={purchase.remove}
              onSubmitDrafts={purchase.submitDrafts}
              onBrowse={() => setMode("products")}
            />
          )}

          {mode === "products" && (
            <div className="flex h-full min-h-0">
              {!isComboCategory && (
                <aside className="flex w-[104px] shrink-0 flex-col overflow-y-auto border-r border-subtle bg-surface-1 py-1">
                  {ECO_BRANDS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBrand(b)}
                      className={cn(
                        "px-2 py-2 text-left text-11 transition-colors",
                        brand === b
                          ? "bg-accent-subtle font-semibold text-accent-primary"
                          : "text-secondary hover:bg-layer-transparent-hover"
                      )}
                    >
                      <span className="line-clamp-2">{b}</span>
                    </button>
                  ))}
                </aside>
              )}

              <div className="min-w-0 flex-1 overflow-y-auto p-3">
                {isComboCategory ? (
                  <div className="space-y-2">
                    {ECO_COMBOS.map((c) => (
                      <ComboCard key={c.id} combo={c} onAdd={() => onAddCombo(c)} />
                    ))}
                  </div>
                ) : products.length === 0 ? (
                  <div className="py-16 text-center text-13 text-tertiary">该筛选下暂无商品</div>
                ) : viewMode === "waterfall" ? (
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4">
                    {products.map((p) => (
                      <ProductCard key={p.id} product={p} onAdd={() => onAddProduct(p)} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {products.map((p) => (
                      <ProductRow key={p.id} product={p} onAdd={() => onAddProduct(p)} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === "combos" && (
            <div className="space-y-2 p-3">
              {ECO_COMBOS.map((c) => (
                <ComboCard key={c.id} combo={c} onAdd={() => onAddCombo(c)} />
              ))}
            </div>
          )}

          {mode === "cases" && (
            <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {ECO_CASES.map((item) => (
                <CaseCard key={item.id} item={item} />
              ))}
            </div>
          )}

          {mode === "spaces" && (
            <div className="space-y-2 p-3">
              {ECO_SPACES.map((s) => (
                <SpaceCard key={s.id} space={s} />
              ))}
            </div>
          )}
        </FsPageBody>
      </FsPageShell>
    </>
  );
});

// ─── 采购功能页 ───────────────────────────────────────────────

function PurchasePanel({
  lines,
  totals,
  onQty,
  onStatus,
  onProject,
  onRemove,
  onSubmitDrafts,
  onBrowse,
}: {
  lines: PurchaseLine[];
  totals: ReturnType<typeof usePurchase>["totals"];
  onQty: (id: string, qty: number) => void;
  onStatus: (id: string, status: PurchaseStatus) => void;
  onProject: (id: string, projectId: string | null) => void;
  onRemove: (id: string) => void;
  onSubmitDrafts: (projectId?: string | null) => void;
  onBrowse: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | "all">("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return lines.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (projectFilter === "all") return true;
      if (projectFilter === "__unassigned__") return !l.projectId;
      return l.projectId === projectFilter;
    });
  }, [lines, statusFilter, projectFilter]);

  const groups = useMemo(() => groupPurchaseByProject(filtered), [filtered]);
  const draftCount = lines.filter((l) => l.status === "draft").length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 顶栏 KPI */}
      <div className="shrink-0 border-b border-subtle bg-surface-1 px-3 py-3">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-13 font-semibold text-primary">采购清单</div>
            <FsMuted className="mt-0.5">
              从生态库加购 · 绑定项目 · 询价/下单状态 · 不做支付履约
            </FsMuted>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={onBrowse}
              className="rounded-md border border-subtle px-2.5 py-1 text-11 font-medium text-secondary hover:bg-surface-2"
            >
              继续选品
            </button>
            <button
              type="button"
              disabled={draftCount === 0}
              onClick={() => onSubmitDrafts()}
              className={cn(
                "rounded-md px-2.5 py-1 text-11 font-medium",
                draftCount === 0
                  ? "cursor-not-allowed bg-surface-2 text-placeholder"
                  : "bg-accent-primary text-on-color"
              )}
            >
              提交询价（{draftCount} 待选）
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi label="行数" value={String(totals.lines)} />
          <Kpi label="件数" value={String(totals.qty)} />
          <Kpi label="清单合计" value={`¥${totals.amount.toLocaleString("zh-CN")}`} />
          <Kpi
            label="待选 / 询价 / 下单"
            value={`${totals.byStatus.draft ?? 0} / ${totals.byStatus.quoted ?? 0} / ${totals.byStatus.ordered ?? 0}`}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <FilterPill
            active={statusFilter === "all"}
            label="全部状态"
            onClick={() => setStatusFilter("all")}
          />
          {PURCHASE_STATUS_FLOW.map((st) => (
            <FilterPill
              key={st}
              active={statusFilter === st}
              label={PURCHASE_STATUS_META[st].label}
              onClick={() => setStatusFilter(st)}
            />
          ))}
          <span className="mx-1 h-3 w-px bg-subtle" />
          <FilterPill
            active={projectFilter === "all"}
            label="全部项目"
            onClick={() => setProjectFilter("all")}
          />
          {PM_PROJECTS.map((p) => (
            <FilterPill
              key={p.id}
              active={projectFilter === p.id}
              label={p.identifier}
              onClick={() => setProjectFilter(p.id)}
            />
          ))}
          <FilterPill
            active={projectFilter === "__unassigned__"}
            label="未归属"
            onClick={() => setProjectFilter("__unassigned__")}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-subtle px-4 py-16 text-center">
            <div className="text-13 text-tertiary">
              {lines.length === 0 ? "采购清单为空" : "当前筛选下无行项目"}
            </div>
            <button
              type="button"
              onClick={onBrowse}
              className="mt-3 rounded-md bg-accent-primary px-3 py-1.5 text-11 font-medium text-on-color"
            >
              去单品库加购
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => {
              const sub = g.lines.reduce((s, l) => s + l.price * l.qty, 0);
              return (
                <section key={g.key} className="overflow-hidden rounded-lg border border-subtle bg-surface-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle bg-surface-2/50 px-3 py-2">
                    <div className="text-13 font-semibold text-primary">{g.label}</div>
                    <div className="text-11 text-tertiary">
                      {g.lines.length} 行 · ¥{sub.toLocaleString("zh-CN")}
                    </div>
                  </div>
                  <ul className="divide-y divide-subtle">
                    {g.lines.map((line) => (
                      <PurchaseRow
                        key={line.id}
                        line={line}
                        onQty={onQty}
                        onStatus={onStatus}
                        onProject={onProject}
                        onRemove={onRemove}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
        <FsMuted className="mt-3">
          轻采购 Demo · 状态本地保存 · 可对接联盟下单链接与项目阶段「家具采买」
        </FsMuted>
      </div>
    </div>
  );
}

function PurchaseRow({
  line,
  onQty,
  onStatus,
  onProject,
  onRemove,
}: {
  line: PurchaseLine;
  onQty: (id: string, qty: number) => void;
  onStatus: (id: string, status: PurchaseStatus) => void;
  onProject: (id: string, projectId: string | null) => void;
  onRemove: (id: string) => void;
}) {
  const meta = PURCHASE_STATUS_META[line.status];
  const lineTotal = line.price * line.qty;

  return (
    <li className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
      <Cover
        src={line.image}
        alt={line.name}
        seed={line.productId}
        className="size-14 shrink-0 rounded-md sm:size-12"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-13 font-medium text-primary">{line.name}</div>
        <div className="text-11 text-tertiary">
          {line.brand} · {line.category} · ¥{line.price.toLocaleString("zh-CN")}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <select
            className="h-7 rounded-md border border-subtle bg-surface-1 px-1.5 text-11 text-secondary"
            value={line.projectId ?? ""}
            onChange={(e) => onProject(line.id, e.target.value || null)}
          >
            <option value="">未归属项目</option>
            {PM_PROJECTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
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
          <span
            className={cn(
              "rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
              meta.tone === "accent" && "bg-accent-subtle text-accent-primary",
              meta.tone === "ok" && "bg-surface-2 text-secondary",
              meta.tone === "danger" && "bg-danger-subtle text-danger-primary",
              meta.tone === "neutral" && "bg-surface-2 text-tertiary",
              meta.tone === "warn" && "bg-accent-subtle text-accent-primary"
            )}
          >
            {meta.label}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
        <div className="flex items-center rounded-md border border-subtle">
          <button
            type="button"
            className="flex size-7 items-center justify-center text-secondary hover:bg-surface-2"
            onClick={() => onQty(line.id, line.qty - 1)}
            aria-label="减少"
          >
            <Minus className="size-3" />
          </button>
          <span className="w-7 text-center text-11 font-medium text-primary">{line.qty}</span>
          <button
            type="button"
            className="flex size-7 items-center justify-center text-secondary hover:bg-surface-2"
            onClick={() => onQty(line.id, line.qty + 1)}
            aria-label="增加"
          >
            <Plus className="size-3" />
          </button>
        </div>
        <div className="text-13 font-semibold text-primary">
          ¥{lineTotal.toLocaleString("zh-CN")}
        </div>
        <button
          type="button"
          onClick={() => onRemove(line.id)}
          className="rounded-md p-1.5 text-tertiary hover:bg-danger-subtle hover:text-danger-primary"
          aria-label="移除"
        >
          <Trash2 className="size-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </li>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-subtle bg-surface-2/40 px-2.5 py-2">
      <div className="text-11 text-tertiary">{label}</div>
      <div className="mt-0.5 truncate text-13 font-semibold text-primary">{value}</div>
    </div>
  );
}

function FilterPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-0.5 text-11 font-medium",
        active
          ? "border-accent-primary/40 bg-accent-subtle text-accent-primary"
          : "border-subtle text-secondary hover:bg-surface-2"
      )}
    >
      {label}
    </button>
  );
}

// ─── 浏览卡片 ─────────────────────────────────────────────────

function ProductCard({ product, onAdd }: { product: EcoProduct; onAdd: () => void }) {
  return (
    <article className="group overflow-hidden rounded-lg border border-subtle bg-surface-1 shadow-sm transition-colors hover:border-accent-primary/30">
      <div className="relative h-36 bg-surface-2">
        <Cover
          src={product.image}
          alt={product.name}
          seed={product.id}
          className="absolute inset-0 size-full"
        />
        {product.tag ? (
          <span className="absolute top-1.5 left-1.5 rounded-sm bg-accent-primary px-1.5 py-0.5 text-[10px] font-medium text-on-color">
            {product.tag}
          </span>
        ) : null}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="absolute right-1.5 bottom-1.5 inline-flex items-center gap-0.5 rounded-md bg-surface-1/95 px-2 py-1 text-11 font-medium text-primary shadow-sm opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
        >
          <ShoppingCart className="size-3" strokeWidth={1.5} />
          加购
        </button>
      </div>
      <div className="p-2.5">
        <div className="line-clamp-2 text-13 font-medium leading-snug text-primary">{product.name}</div>
        <div className="mt-1 text-11 text-tertiary">{product.brand}</div>
        <div className="mt-1.5 flex items-center justify-between gap-1">
          <span className="text-13 font-semibold text-primary">
            ¥{product.price.toLocaleString("zh-CN")}
          </span>
          <span className="truncate text-11 text-placeholder">{product.style}</span>
        </div>
      </div>
    </article>
  );
}

function ProductRow({ product, onAdd }: { product: EcoProduct; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-subtle bg-surface-1 px-2.5 py-2">
      <Cover
        src={product.image}
        alt={product.name}
        seed={product.id}
        className="size-12 shrink-0 rounded-md"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-13 font-medium text-primary">{product.name}</div>
        <div className="text-11 text-tertiary">
          {product.brand} · {product.category}
          {product.material ? ` · ${product.material}` : ""}
        </div>
      </div>
      <div className="shrink-0 text-13 font-semibold text-primary">
        ¥{product.price.toLocaleString("zh-CN")}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-subtle px-2 py-1 text-11 font-medium text-secondary hover:border-accent-primary/40 hover:text-accent-primary"
      >
        <ShoppingCart className="size-3" strokeWidth={1.5} />
        加购
      </button>
    </div>
  );
}

function ComboCard({ combo, onAdd }: { combo: EcoCombo; onAdd: () => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-subtle bg-surface-1 shadow-sm">
      <Cover
        src={combo.image}
        alt={combo.name}
        seed={combo.id}
        className="h-auto w-28 shrink-0 self-stretch sm:w-36"
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center p-3">
        <div className="text-13 font-medium text-primary">{combo.name}</div>
        {combo.meta && <FsMuted className="mt-0.5">{combo.meta}</FsMuted>}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {combo.styleTags.slice(0, 3).map((t) => (
            <FsTag key={t}>{t}</FsTag>
          ))}
          <FsTag>{combo.itemCount} 件</FsTag>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-13 font-semibold text-primary">
            ¥{combo.price.toLocaleString("zh-CN")}
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-0.5 rounded-md bg-accent-primary px-2.5 py-1 text-11 font-medium text-on-color"
          >
            <ShoppingCart className="size-3" strokeWidth={1.5} />
            整套加购
          </button>
        </div>
      </div>
    </div>
  );
}

function CaseCard({ item }: { item: EcoCase }) {
  return (
    <article className="overflow-hidden rounded-lg border border-subtle bg-surface-1 shadow-sm">
      <div className="relative h-32 bg-surface-2">
        <Cover
          src={item.image}
          alt={item.title}
          seed={item.id}
          className="absolute inset-0 size-full"
        />
      </div>
      <div className="p-3">
        <div className="text-13 font-medium text-primary">{item.title}</div>
        {item.meta && <FsMuted className="mt-0.5">{item.meta}</FsMuted>}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {item.tags.map((t) => (
            <FsTag key={t}>{t}</FsTag>
          ))}
        </div>
        {item.desc && <FsMuted className="mt-2 line-clamp-2">{item.desc}</FsMuted>}
      </div>
    </article>
  );
}

function SpaceCard({ space }: { space: EcoSpace }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-subtle bg-surface-1 shadow-sm">
      <Cover
        src={space.image}
        alt={space.name}
        seed={space.id}
        className="h-auto w-28 shrink-0 self-stretch sm:w-36"
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center p-3">
        <FsTag>{space.type}</FsTag>
        <div className="mt-1 text-13 font-medium text-primary">{space.name}</div>
        <FsMuted className="mt-0.5">
          {space.area}
          {space.light ? ` · ${space.light}` : ""} · 可作为 AI 样板空间
        </FsMuted>
      </div>
    </div>
  );
}

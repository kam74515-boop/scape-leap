/**
 * 生态库 · 采购清单（Demo · localStorage）
 * 设计师侧轻采购：加购 SKU → 绑定项目 → 状态推进 → 合计
 * 不做重履约 / 支付 / 物流
 */
import { ECO_PRODUCTS, type EcoProduct } from "./ecology-mock";
import { PM_PROJECTS } from "./pm-mock";

export type PurchaseStatus = "draft" | "quoted" | "ordered" | "arrived" | "cancelled";

export type PurchaseLine = {
  id: string;
  productId: string;
  name: string;
  brand: string;
  price: number;
  image: string;
  category: string;
  qty: number;
  /** 绑定项目；空 = 未归属 */
  projectId: string | null;
  projectName: string | null;
  status: PurchaseStatus;
  note?: string;
  addedAt: string;
};

const STORAGE_KEY = "fs-eco-purchase-v1";
export const PURCHASE_CHANGE_EVENT = "fs-eco-purchase-change";

export const PURCHASE_STATUS_META: Record<
  PurchaseStatus,
  { label: string; tone: "neutral" | "accent" | "ok" | "warn" | "danger" }
> = {
  draft: { label: "待选", tone: "neutral" },
  quoted: { label: "已询价", tone: "accent" },
  ordered: { label: "已下单", tone: "ok" },
  arrived: { label: "已到货", tone: "ok" },
  cancelled: { label: "已取消", tone: "danger" },
};

export const PURCHASE_STATUS_FLOW: PurchaseStatus[] = [
  "draft",
  "quoted",
  "ordered",
  "arrived",
];

function emitChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PURCHASE_CHANGE_EVENT));
}

function seedLines(): PurchaseLine[] {
  const pick = (id: string) => ECO_PRODUCTS.find((p) => p.id === id) ?? ECO_PRODUCTS[0];
  const p1 = PM_PROJECTS[0];
  const p2 = PM_PROJECTS[1];
  const a = pick(ECO_PRODUCTS[0]?.id ?? "p1");
  const b = pick(ECO_PRODUCTS[1]?.id ?? ECO_PRODUCTS[0]?.id);
  const c = pick(ECO_PRODUCTS[2]?.id ?? ECO_PRODUCTS[0]?.id);
  const d = pick(ECO_PRODUCTS[3]?.id ?? ECO_PRODUCTS[0]?.id);
  const now = new Date().toISOString();
  return [
    lineFromProduct(a, {
      qty: 1,
      projectId: p1?.id ?? null,
      projectName: p1?.name ?? null,
      status: "quoted",
      addedAt: now,
    }),
    lineFromProduct(b, {
      qty: 2,
      projectId: p1?.id ?? null,
      projectName: p1?.name ?? null,
      status: "draft",
      addedAt: now,
    }),
    lineFromProduct(c, {
      qty: 1,
      projectId: p2?.id ?? null,
      projectName: p2?.name ?? null,
      status: "ordered",
      addedAt: now,
    }),
    lineFromProduct(d, {
      qty: 1,
      projectId: null,
      projectName: null,
      status: "draft",
      addedAt: now,
    }),
  ].filter(Boolean) as PurchaseLine[];
}

function lineFromProduct(
  product: EcoProduct,
  extra: Partial<PurchaseLine> & { qty: number; status: PurchaseStatus; addedAt: string }
): PurchaseLine {
  return {
    id: `pl-${product.id}-${Math.random().toString(36).slice(2, 8)}`,
    productId: product.id,
    name: product.name,
    brand: product.brand,
    price: product.price,
    image: product.image,
    category: product.category,
    qty: extra.qty,
    projectId: extra.projectId ?? null,
    projectName: extra.projectName ?? null,
    status: extra.status,
    note: extra.note,
    addedAt: extra.addedAt,
  };
}

function load(): PurchaseLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PurchaseLine[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  const seeded = seedLines();
  save(seeded, false);
  return seeded;
}

function save(lines: PurchaseLine[], notify = true) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* ignore */
  }
  if (notify) emitChange();
}

export function getPurchaseLines(): PurchaseLine[] {
  return load();
}

/** 项目内家具采买：只读绑定到该 projectId 的行（不含未归属） */
export function getPurchaseLinesForProject(projectId: string): PurchaseLine[] {
  return load().filter((l) => l.projectId === projectId && l.status !== "cancelled");
}

/** 项目视图可选：绑定本项目 + 未归属（便于从全局清单认领） */
export function getPurchaseLinesForProjectScope(
  projectId: string,
  opts?: { includeUnassigned?: boolean }
): PurchaseLine[] {
  const includeUnassigned = opts?.includeUnassigned ?? false;
  return load().filter((l) => {
    if (l.status === "cancelled") return false;
    if (l.projectId === projectId) return true;
    return includeUnassigned && l.projectId === null;
  });
}

export function getPurchaseCount(): number {
  return load().reduce((s, l) => s + (l.status === "cancelled" ? 0 : l.qty), 0);
}

export function getPurchaseTotalsForProject(projectId: string) {
  return getPurchaseTotals(getPurchaseLinesForProject(projectId));
}

/** 将未归属行认领到项目 */
export function assignLineToProject(lineId: string, projectId: string): PurchaseLine[] {
  const name = PM_PROJECTS.find((p) => p.id === projectId)?.name ?? null;
  return updatePurchaseLine(lineId, { projectId, projectName: name });
}

export function getPurchaseTotals(lines?: PurchaseLine[]) {
  const list = (lines ?? load()).filter((l) => l.status !== "cancelled");
  const amount = list.reduce((s, l) => s + l.price * l.qty, 0);
  const byStatus = PURCHASE_STATUS_FLOW.reduce(
    (acc, st) => {
      acc[st] = list.filter((l) => l.status === st).length;
      return acc;
    },
    {} as Record<PurchaseStatus, number>
  );
  return {
    lines: list.length,
    qty: list.reduce((s, l) => s + l.qty, 0),
    amount,
    byStatus,
  };
}

/** 加购：同 product + project 合并数量 */
export function addProductToPurchase(
  product: EcoProduct,
  opts?: { qty?: number; projectId?: string | null; projectName?: string | null }
): PurchaseLine[] {
  const qty = opts?.qty ?? 1;
  const projectId = opts?.projectId ?? null;
  const projectName =
    opts?.projectName ??
    (projectId ? (PM_PROJECTS.find((p) => p.id === projectId)?.name ?? null) : null);
  const lines = load();
  const existing = lines.find(
    (l) =>
      l.productId === product.id &&
      l.projectId === projectId &&
      l.status !== "cancelled" &&
      l.status !== "arrived"
  );
  let next: PurchaseLine[];
  if (existing) {
    next = lines.map((l) =>
      l.id === existing.id ? { ...l, qty: l.qty + qty } : l
    );
  } else {
    next = [
      lineFromProduct(product, {
        qty,
        projectId,
        projectName,
        status: "draft",
        addedAt: new Date().toISOString(),
      }),
      ...lines,
    ];
  }
  save(next);
  return next;
}

export function addComboToPurchase(
  productIds: string[],
  opts?: { projectId?: string | null }
): PurchaseLine[] {
  let lines = load();
  for (const pid of productIds) {
    const p = ECO_PRODUCTS.find((x) => x.id === pid);
    if (!p) continue;
    // 直接写，避免多次 emit；最后统一 save
    const projectId = opts?.projectId ?? null;
    const projectName = projectId
      ? (PM_PROJECTS.find((x) => x.id === projectId)?.name ?? null)
      : null;
    const existing = lines.find(
      (l) =>
        l.productId === p.id &&
        l.projectId === projectId &&
        l.status !== "cancelled" &&
        l.status !== "arrived"
    );
    if (existing) {
      lines = lines.map((l) =>
        l.id === existing.id ? { ...l, qty: l.qty + 1 } : l
      );
    } else {
      lines = [
        lineFromProduct(p, {
          qty: 1,
          projectId,
          projectName,
          status: "draft",
          addedAt: new Date().toISOString(),
        }),
        ...lines,
      ];
    }
  }
  save(lines);
  return lines;
}

export function updatePurchaseLine(
  id: string,
  patch: Partial<Pick<PurchaseLine, "qty" | "status" | "projectId" | "projectName" | "note">>
): PurchaseLine[] {
  const lines = load().map((l) => {
    if (l.id !== id) return l;
    const next = { ...l, ...patch };
    if (patch.projectId !== undefined && patch.projectName === undefined) {
      next.projectName = patch.projectId
        ? (PM_PROJECTS.find((p) => p.id === patch.projectId)?.name ?? null)
        : null;
    }
    if (typeof next.qty === "number") next.qty = Math.max(1, Math.min(99, next.qty));
    return next;
  });
  save(lines);
  return lines;
}

export function removePurchaseLine(id: string): PurchaseLine[] {
  const lines = load().filter((l) => l.id !== id);
  save(lines);
  return lines;
}

export function clearDraftLines(): PurchaseLine[] {
  const lines = load().filter((l) => l.status !== "draft");
  save(lines);
  return lines;
}

/** 批量提交：draft → quoted（示意） */
export function submitDraftAsQuoted(projectId?: string | null): PurchaseLine[] {
  const lines = load().map((l) => {
    if (l.status !== "draft") return l;
    if (projectId != null && l.projectId !== projectId) return l;
    return { ...l, status: "quoted" as const };
  });
  save(lines);
  return lines;
}

export function groupPurchaseByProject(lines: PurchaseLine[]) {
  const map = new Map<string, { key: string; label: string; lines: PurchaseLine[] }>();
  for (const l of lines) {
    const key = l.projectId ?? "__unassigned__";
    const label = l.projectName ?? "未归属项目";
    if (!map.has(key)) map.set(key, { key, label, lines: [] });
    map.get(key)!.lines.push(l);
  }
  return Array.from(map.values());
}

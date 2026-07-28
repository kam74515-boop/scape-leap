export const PORTAL_STEPS = [
  { key: "style", label: "风格方向" },
  { key: "render", label: "效果图" },
  { key: "materials", label: "选材清单" },
  { key: "quote", label: "报价确认" },
] as const;

export type PortalStepKey = (typeof PORTAL_STEPS)[number]["key"];
export type PortalStepStatus = "pending" | "confirmed" | "rejected";
export type PortalStepState = {
  status: PortalStepStatus;
  comment?: string;
  at?: string;
};
export type PortalProjectState = Record<PortalStepKey, PortalStepState>;

export type PublicPortalProject = {
  id: string;
  name: string;
  clientName: string;
  city: string;
  houseType: string;
  budgetWan: number;
  designFeeWan: number;
  stageLabel: string;
};

export type PublicPortalPayload = {
  project: PublicPortalProject;
  state: PortalProjectState;
  deliverables: {
    styles: {
      id: string;
      name: string;
      desc: string;
      image?: string;
      colors: string[];
      selected: boolean;
    }[];
    renders: {
      id: string;
      src: string;
      name: string;
    }[];
    materials: {
      id: string;
      name: string;
      brand: string;
      category: string;
      qty: number;
      price: number;
    }[];
    files: {
      id: string;
      name: string;
      kind: string;
      mime: string;
      sizeLabel: string;
      contentDataUrl: string;
    }[];
  };
};

export type PortalShare = {
  projectId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
};

export function defaultPortalState(): PortalProjectState {
  return {
    style: { status: "pending" },
    render: { status: "pending" },
    materials: { status: "pending" },
    quote: { status: "pending" },
  };
}

export function portalStatusLabel(status: PortalStepStatus): string {
  if (status === "confirmed") return "已确认";
  if (status === "rejected") return "已驳回";
  return "待确认";
}

export function portalStatusTone(status: PortalStepStatus): "success" | "danger" | "warning" {
  if (status === "confirmed") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

function apiBase() {
  return (globalThis as { __FS_API_BASE?: string }).__FS_API_BASE ?? "";
}

async function portalFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const error = new Error(`portal-api ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return (await response.json()) as T;
}

/** 每次生成都会轮换令牌，旧链接立即失效。 */
export function createPortalShare(projectId: string, ttlDays = 30): Promise<PortalShare> {
  return portalFetch(`/api/portal-shares/${encodeURIComponent(projectId)}`, {
    method: "POST",
    body: JSON.stringify({ ttlDays }),
  });
}

export function revokePortalShare(projectId: string): Promise<{ ok: true; revokedAt: string }> {
  return portalFetch(`/api/portal-shares/${encodeURIComponent(projectId)}`, { method: "DELETE" });
}

export function getPublicPortal(projectId: string, token: string): Promise<PublicPortalPayload> {
  return portalFetch(`/api/public/portal/${encodeURIComponent(projectId)}/${encodeURIComponent(token)}`);
}

export function submitPublicPortalStep(
  projectId: string,
  token: string,
  step: PortalStepKey,
  status: Exclude<PortalStepStatus, "pending">,
  comment?: string
): Promise<PublicPortalPayload> {
  return portalFetch(`/api/public/portal/${encodeURIComponent(projectId)}/${encodeURIComponent(token)}/steps/${step}`, {
    method: "PATCH",
    body: JSON.stringify({ status, comment }),
  });
}

import { useEffect, useMemo, useState } from "react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { TEAM } from "./workspace-mock";
import {
  createProject,
  isProjectIdentifierTaken,
  type CreateProjectInput,
} from "./projects-store";
import { initializeProjectProgress } from "./project-progress-store";
import { saveProject } from "./mock-data";
import { createCustomer, getCustomers, toggleCustomerProject } from "./customers-store";
import type { FormscapeProject } from "./types";
import { FsButton, FsField, FsModal, FsSteps, fsInputClass } from "./ui";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
};

type Draft = CreateProjectInput & {
  clientPhone: string;
  customerSource: string;
  area: number;
  rooms: string;
  style: string;
  timeline: string;
};

const STEPS = [
  { key: "project", label: "项目" },
  { key: "client", label: "客户" },
  { key: "home", label: "房屋预算" },
  { key: "team", label: "团队" },
];

function initialDraft(): Draft {
  return {
    name: "",
    identifier: "",
    clientName: "",
    clientPhone: "",
    customerSource: "其他",
    city: "",
    houseType: "",
    area: 0,
    rooms: "",
    style: "",
    timeline: "",
    budgetWan: 0,
    designFeeWan: 0,
    owner: TEAM[0]?.name ?? "林设计师",
    members: [],
  };
}

export function CreateProjectWizard({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setDraft(initialDraft());
    setError("");
  }, [open]);

  const houseSummary = useMemo(
    () => [draft.houseType.trim(), draft.area > 0 ? `${draft.area}㎡` : null].filter(Boolean).join(" · "),
    [draft.area, draft.houseType]
  );

  const validateStep = () => {
    if (step === 0) {
      if (!draft.name.trim()) return "请填写项目名称";
      if (!/^[A-Za-z0-9]{2,8}$/.test(draft.identifier.trim())) {
        return "项目编号请输入 2–8 位字母或数字";
      }
      if (isProjectIdentifierTaken(draft.identifier)) return "项目编号已存在";
      if (!draft.city.trim()) return "请填写项目城市";
    }
    if (step === 1 && !draft.clientName.trim()) return "请填写客户姓名";
    if (step === 2) {
      if (!draft.houseType.trim()) return "请填写房屋类型";
      if (draft.area <= 0) return "请填写有效面积";
      if (draft.budgetWan <= 0) return "请填写有效总预算";
      if (draft.designFeeWan <= 0) return "请填写有效设计费";
    }
    if (step === 3 && !draft.owner) return "请选择项目负责人";
    return "";
  };

  const next = () => {
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  };

  const submit = () => {
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }
    const project = createProject({
      ...draft,
      houseType: houseSummary,
    });
    initializeProjectProgress(project.id, project.designFeeWan);

    const profile: FormscapeProject = {
      id: project.id,
      name: project.name,
      identifier: project.identifier,
      stage: "requirements",
      profile: {
        clientName: draft.clientName.trim(),
        clientPhone: draft.clientPhone.trim() || undefined,
        houseType: draft.houseType.trim(),
        area: draft.area,
        budget: draft.budgetWan,
        style: draft.style.trim() || undefined,
        rooms: draft.rooms.trim() || undefined,
        city: draft.city.trim(),
        timeline: draft.timeline.trim() || undefined,
      },
      moodboard: [],
      materials: [],
      furniture: [],
      purchaseIds: [],
    };
    saveProject(profile);

    const existingCustomer = draft.clientPhone.trim()
      ? getCustomers().find((customer) => customer.phone === draft.clientPhone.trim())
      : undefined;
    const customer =
      existingCustomer ??
      createCustomer({
        name: draft.clientName,
        phone: draft.clientPhone,
        wechat: "",
        source: draft.customerSource,
        city: draft.city,
        stage: "线索",
        budgetWan: draft.budgetWan,
        note: `由项目「${project.name}」建项创建`,
      });
    if (!customer.projectIds.includes(project.id)) toggleCustomerProject(customer.id, project.id);

    setToast({
      type: TOAST_TYPE.SUCCESS,
      title: "项目已创建",
      message: "客户、项目档案与双轴进度已初始化",
    });
    onCreated(project.id);
    onClose();
  };

  return (
    <FsModal
      open={open}
      onClose={onClose}
      title="新建项目"
      width="md"
      footer={
        <>
          {step > 0 && (
            <FsButton variant="secondary" onClick={() => setStep((current) => current - 1)}>
              上一步
            </FsButton>
          )}
          {step < STEPS.length - 1 ? (
            <FsButton onClick={next}>下一步</FsButton>
          ) : (
            <FsButton onClick={submit}>创建并进入项目</FsButton>
          )}
        </>
      }
    >
      <FsSteps steps={STEPS} current={step} className="mb-5" />

      {step === 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <FsField label="项目名称" className="sm:col-span-2">
            <input
              autoFocus
              className={fsInputClass}
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="如 湖滨公寓 · 三口之家"
            />
          </FsField>
          <FsField label="项目编号">
            <input
              className={fsInputClass}
              value={draft.identifier}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  identifier: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8),
                }))
              }
              placeholder="如 HB"
            />
          </FsField>
          <FsField label="城市">
            <input
              className={fsInputClass}
              value={draft.city}
              onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))}
              placeholder="如 杭州"
            />
          </FsField>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <FsField label="客户姓名">
            <input
              autoFocus
              className={fsInputClass}
              value={draft.clientName}
              onChange={(event) => setDraft((current) => ({ ...current, clientName: event.target.value }))}
              placeholder="如 陈女士"
            />
          </FsField>
          <FsField label="联系电话">
            <input
              className={fsInputClass}
              value={draft.clientPhone}
              onChange={(event) => setDraft((current) => ({ ...current, clientPhone: event.target.value }))}
              placeholder="手机号或座机"
            />
          </FsField>
          <FsField label="客户来源" className="sm:col-span-2">
            <select
              className={fsInputClass}
              value={draft.customerSource}
              onChange={(event) => setDraft((current) => ({ ...current, customerSource: event.target.value }))}
            >
              {["朋友介绍", "老客户转介绍", "小红书", "抖音", "线下活动", "其他"].map((source) => (
                <option key={source}>{source}</option>
              ))}
            </select>
          </FsField>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <FsField label="房屋类型">
            <input
              autoFocus
              className={fsInputClass}
              value={draft.houseType}
              onChange={(event) => setDraft((current) => ({ ...current, houseType: event.target.value }))}
              placeholder="如 平层"
            />
          </FsField>
          <FsField label="建筑面积（㎡）">
            <input
              type="number"
              min="1"
              className={fsInputClass}
              value={draft.area || ""}
              onChange={(event) => setDraft((current) => ({ ...current, area: Number(event.target.value) }))}
            />
          </FsField>
          <FsField label="户型">
            <input
              className={fsInputClass}
              value={draft.rooms}
              onChange={(event) => setDraft((current) => ({ ...current, rooms: event.target.value }))}
              placeholder="如 三室两厅"
            />
          </FsField>
          <FsField label="风格偏好">
            <input
              className={fsInputClass}
              value={draft.style}
              onChange={(event) => setDraft((current) => ({ ...current, style: event.target.value }))}
              placeholder="可稍后完善"
            />
          </FsField>
          <FsField label="总预算（万）">
            <input
              type="number"
              min="0"
              step="0.1"
              className={fsInputClass}
              value={draft.budgetWan || ""}
              onChange={(event) =>
                setDraft((current) => ({ ...current, budgetWan: Number(event.target.value) }))
              }
            />
          </FsField>
          <FsField label="设计费（万）">
            <input
              type="number"
              min="0"
              step="0.1"
              className={fsInputClass}
              value={draft.designFeeWan || ""}
              onChange={(event) =>
                setDraft((current) => ({ ...current, designFeeWan: Number(event.target.value) }))
              }
            />
          </FsField>
          <FsField label="计划入住" className="sm:col-span-2">
            <input
              className={fsInputClass}
              value={draft.timeline}
              onChange={(event) => setDraft((current) => ({ ...current, timeline: event.target.value }))}
              placeholder="如 2026 年 12 月"
            />
          </FsField>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <FsField label="项目负责人">
            <select
              autoFocus
              className={fsInputClass}
              value={draft.owner}
              onChange={(event) => setDraft((current) => ({ ...current, owner: event.target.value }))}
            >
              {TEAM.map((member) => (
                <option key={member.id} value={member.name}>
                  {member.name} · {member.role}
                </option>
              ))}
            </select>
          </FsField>
          <div>
            <div className="mb-2 text-11 font-medium text-secondary">协作成员</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {TEAM.filter((member) => member.name !== draft.owner).map((member) => {
                const checked = draft.members.includes(member.name);
                return (
                  <label
                    key={member.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-subtle px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setDraft((current) => ({
                          ...current,
                          members: checked
                            ? current.members.filter((name) => name !== member.name)
                            : [...current.members, member.name],
                        }))
                      }
                    />
                    <span>
                      <span className="block text-12 font-medium text-primary">{member.name}</span>
                      <span className="block text-10 text-tertiary">{member.role}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="rounded-md bg-surface-2 px-3 py-2 text-11 text-secondary">
            创建后将进入“需求分析”，项目经营停留在“线索”。后续状态只由明确操作推进。
          </div>
        </div>
      )}

      {error && <div className="mt-3 rounded-md bg-danger-subtle px-3 py-2 text-11 text-danger-primary">{error}</div>}
    </FsModal>
  );
}

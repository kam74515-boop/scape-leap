/**
 * 业主 Client Portal（安全分享链接 · 只读 + 确认/驳回）
 *
 * 红线：业主不是主账号用户，本页是业主唯一触点——
 * 不挂 L1/L2 导航、不出现任何进入工作台的链接；
 * 「确认 / 有意见（批注）」是业主仅有的写操作（localStorage 回执）。
 * 移动端单列可用。
 */
import { useEffect, useState } from "react";
import { CheckCircle2, MessageSquareText } from "lucide-react";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import { cn } from "@plane/utils";
import { PageHead } from "@/components/core/page-title";
import {
  PORTAL_STEPS,
  defaultPortalState,
  getPublicPortal,
  portalStatusLabel,
  portalStatusTone,
  submitPublicPortalStep,
  type PublicPortalPayload,
  type PortalStepKey,
} from "./portal-api";
import { WORKSPACE_META } from "./workspace-mock";
import { FsButton, FsModal, FsSteps, FsTag, fsInputClass } from "./ui";

type Props = { projectId: string; token: string };

function formatTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FormscapeClientPortalPage({ projectId, token }: Props) {
  const [payload, setPayload] = useState<PublicPortalPayload | null>(null);
  const [access, setAccess] = useState<"loading" | "ready" | "denied">("loading");
  const [savingStep, setSavingStep] = useState<PortalStepKey | null>(null);
  // 「有意见」批注弹窗
  const [commentStep, setCommentStep] = useState<PortalStepKey | null>(null);
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    let cancelled = false;
    setAccess("loading");
    void getPublicPortal(projectId, token)
      .then((next) => {
        if (cancelled) return;
        setPayload(next);
        setAccess("ready");
      })
      .catch(() => {
        if (!cancelled) setAccess("denied");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, token]);

  const state = payload?.state ?? defaultPortalState();
  const project = payload?.project;

  const confirmStep = async (step: PortalStepKey) => {
    setSavingStep(step);
    try {
      const next = await submitPublicPortalStep(projectId, token, step, "confirmed");
      setPayload(next);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "已确认，设计师马上能看到" });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "提交失败", message: "链接可能已失效，请联系设计师" });
    } finally {
      setSavingStep(null);
    }
  };

  const openComment = (step: PortalStepKey) => {
    setCommentText(state[step].comment ?? "");
    setCommentStep(step);
  };

  const submitComment = async () => {
    if (!commentStep) return;
    if (!commentText.trim()) {
      setToast({ type: TOAST_TYPE.WARNING, title: "写一句想调整的地方吧" });
      return;
    }
    setSavingStep(commentStep);
    try {
      const next = await submitPublicPortalStep(projectId, token, commentStep, "rejected", commentText);
      setPayload(next);
      setCommentStep(null);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "意见已送达，设计师会尽快回复" });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "提交失败", message: "链接可能已失效，请联系设计师" });
    } finally {
      setSavingStep(null);
    }
  };

  // 胶囊步骤条：当前 = 第一个未确认的步骤；全部确认则全为 done
  const firstOpen = PORTAL_STEPS.findIndex((s) => state[s.key].status !== "confirmed");
  const currentStep = firstOpen === -1 ? PORTAL_STEPS.length : firstOpen;

  const scrollToStep = (index: number) => {
    const step = PORTAL_STEPS[index];
    if (!step) return;
    document.getElementById(`portal-step-${step.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (access === "loading") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface-1 px-6">
        <div className="text-12 text-tertiary">正在验证项目链接…</div>
      </div>
    );
  }

  if (access === "denied" || !project) {
    return (
      <>
        <PageHead title="项目进展 · 构境AI" />
        <div className="flex h-screen w-full items-center justify-center bg-surface-1 px-6">
          <div className="text-center">
            <div className="text-15 font-semibold text-primary">这个链接暂时打不开</div>
            <p className="mt-1.5 text-12 text-tertiary">项目可能已调整，请联系您的设计师重新发送链接。</p>
          </div>
        </div>
      </>
    );
  }

  const stepMeta = (key: PortalStepKey) => {
    const st = state[key];
    return (
      <div className="flex items-center gap-2">
        <FsTag tone={portalStatusTone(st.status)}>{portalStatusLabel(st.status)}</FsTag>
        {st.at && <span className="text-10 text-tertiary tabular-nums">{formatTime(st.at)}</span>}
      </div>
    );
  };

  const stepActions = (key: PortalStepKey) => {
    const st = state[key];
    return (
      <div className="mt-3 border-t border-subtle pt-3">
        {st.status === "rejected" && st.comment && (
          <div className="mb-3 rounded-lg bg-danger-subtle px-3 py-2 text-12 text-danger-primary">
            您的意见：{st.comment}
          </div>
        )}
        {st.status === "confirmed" ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-12 text-success-primary">
              <CheckCircle2 className="size-4" strokeWidth={1.75} />
              您已确认这一步
            </div>
            <FsButton variant="ghost" size="sm" disabled={savingStep === key} onClick={() => openComment(key)}>
              改主意了？提意见
            </FsButton>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <FsButton size="sm" disabled={savingStep === key} onClick={() => void confirmStep(key)}>
              <CheckCircle2 className="size-3.5" strokeWidth={1.75} />
              确认没问题
            </FsButton>
            <FsButton variant="secondary" size="sm" disabled={savingStep === key} onClick={() => openComment(key)}>
              <MessageSquareText className="size-3.5" strokeWidth={1.75} />
              有意见
            </FsButton>
          </div>
        )}
      </div>
    );
  };

  const deliverables = payload.deliverables;
  const quoteRows = [
    { name: "设计费", amountWan: project.designFeeWan },
    {
      name: "当前选材清单",
      amountWan: Number(
        (deliverables.materials.reduce((sum, item) => sum + item.price * item.qty, 0) / 10_000).toFixed(2)
      ),
    },
  ];
  const quoteTotal = Number(quoteRows.reduce((s, r) => s + r.amountWan, 0).toFixed(1));

  return (
    <>
      <PageHead title={`${project.name} · 项目进展`} />
      <div className="h-screen w-full overflow-y-auto overscroll-contain bg-surface-1">
        <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
          {/* 顶部：项目名 + 演示标注 + 四步胶囊 */}
          <header className="mb-5">
            <div className="text-11 text-tertiary">{WORKSPACE_META.name} · 为您准备的项目进展</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-20 font-semibold text-primary">{project.name}</h1>
              <FsTag tone="neutral">安全分享</FsTag>
            </div>
            <p className="mt-1 text-12 text-tertiary">
              看完每一步，点「确认没问题」或「有意见」，设计师就知道该怎么继续。
            </p>
            <FsSteps
              className="mt-3"
              steps={PORTAL_STEPS.map((s) => ({ key: s.key, label: s.label }))}
              current={currentStep}
              onStepClick={scrollToStep}
            />
          </header>

          <main className="space-y-4 pb-10">
            {/* 1 风格方向 */}
            <section id="portal-step-style" className="scroll-mt-4 rounded-xl border border-subtle bg-surface-1 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-15 font-semibold text-primary">风格方向</h2>
                {stepMeta("style")}
              </div>
              <p className="mt-1 text-12 text-tertiary">这里展示设计师已录入本项目的真实风格方向。</p>
              {deliverables.styles.length ? (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {deliverables.styles.map((style) => (
                    <figure key={style.id} className="overflow-hidden rounded-lg border border-subtle">
                      {style.image ? (
                        <img
                          src={style.image}
                          alt={style.name}
                          loading="lazy"
                          className="aspect-[4/3] w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-[4/3] items-center justify-center bg-surface-2 text-11 text-tertiary">
                          暂无意向图
                        </div>
                      )}
                      <figcaption className="px-2.5 py-2">
                        <div className="flex items-center gap-1.5 text-12 font-medium text-primary">
                          {style.name}
                          {style.selected && <FsTag tone="success">已选定</FsTag>}
                        </div>
                        <div className="mt-0.5 text-11 text-tertiary">{style.desc}</div>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-lg bg-surface-2 px-3 py-4 text-center text-12 text-tertiary">
                  设计师尚未发布风格方向
                </div>
              )}
              {stepActions("style")}
            </section>

            {/* 2 效果图 */}
            <section id="portal-step-render" className="scroll-mt-4 rounded-xl border border-subtle bg-surface-1 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-15 font-semibold text-primary">效果图</h2>
                {stepMeta("render")}
              </div>
              <p className="mt-1 text-12 text-tertiary">这里只展示设计师在「AI 渲染」阶段正式采用的成果。</p>
              {deliverables.renders.length ? (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {deliverables.renders.map((render) => (
                    <figure key={render.id} className="overflow-hidden rounded-lg border border-subtle">
                      <img
                        src={render.src}
                        alt={render.name}
                        loading="lazy"
                        className="aspect-[4/3] w-full object-cover"
                      />
                      <figcaption className="px-2.5 py-1.5 text-11 text-secondary">{render.name}</figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-lg bg-surface-2 px-3 py-4 text-center text-12 text-tertiary">
                  设计师尚未发布效果图
                </div>
              )}
              {stepActions("render")}
            </section>

            {/* 3 选材清单 */}
            <section
              id="portal-step-materials"
              className="scroll-mt-4 rounded-xl border border-subtle bg-surface-1 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-15 font-semibold text-primary">选材清单</h2>
                {stepMeta("materials")}
              </div>
              <p className="mt-1 text-12 text-tertiary">与项目采购清单同源，数量与金额随设计师侧更新。</p>
              <div className="mt-3 overflow-x-auto rounded-lg border border-subtle">
                <table className="w-full min-w-[420px] text-left text-12">
                  <thead className="border-b border-subtle text-11 font-medium text-tertiary">
                    <tr>
                      <th className="px-3 py-2">项目</th>
                      <th className="px-3 py-2">品牌</th>
                      <th className="px-3 py-2 text-right">数量</th>
                      <th className="px-3 py-2 text-right">单价（元）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliverables.materials.map((material) => (
                      <tr key={material.id} className="border-b border-subtle last:border-0">
                        <td className="px-3 py-2">
                          <span className="text-primary">{material.name}</span>
                          <FsTag tone="neutral" className="ml-1.5">
                            {material.category}
                          </FsTag>
                        </td>
                        <td className="px-3 py-2 text-secondary">{material.brand}</td>
                        <td className="px-3 py-2 text-right text-secondary tabular-nums">{material.qty} 件</td>
                        <td className="px-3 py-2 text-right text-primary tabular-nums">
                          {material.price.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {deliverables.files.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 text-12 font-medium text-primary">可下载交付文件</div>
                  <div className="space-y-1.5">
                    {deliverables.files.map((file) => (
                      <a
                        key={file.id}
                        href={file.contentDataUrl}
                        download={file.name}
                        className="flex items-center justify-between rounded-lg border border-subtle px-3 py-2 text-12 text-secondary hover:bg-surface-2"
                      >
                        <span className="truncate">{file.name}</span>
                        <span className="shrink-0 text-10 text-tertiary">
                          {file.kind} · {file.sizeLabel}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {stepActions("materials")}
            </section>

            {/* 4 报价确认 */}
            <section id="portal-step-quote" className="scroll-mt-4 rounded-xl border border-subtle bg-surface-1 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-15 font-semibold text-primary">报价确认</h2>
                {stepMeta("quote")}
              </div>
              <p className="mt-1 text-12 text-tertiary">整体费用的构成一目了然；确认后进入下一阶段安排。</p>
              <div className="mt-3 rounded-lg border border-subtle">
                {quoteRows.map((r) => (
                  <div
                    key={r.name}
                    className="flex items-center justify-between border-b border-subtle px-3 py-2.5 text-12 last:border-0"
                  >
                    <span className="text-secondary">{r.name}</span>
                    <span className="text-primary tabular-nums">{r.amountWan.toFixed(1)} 万</span>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-b-lg bg-surface-2 px-3 py-2.5 text-13 font-semibold">
                  <span className="text-primary">当前合计</span>
                  <span className="text-primary tabular-nums">{quoteTotal.toFixed(1)} 万</span>
                </div>
              </div>
              {stepActions("quote")}
            </section>

            <footer className="pt-2 text-center text-11 text-tertiary">
              <p>效果图与报价以正式交付文件为准 · 施工尺寸以现场实测为准</p>
              <p className="mt-1">由 构境AI 生成 · {WORKSPACE_META.name}</p>
            </footer>
          </main>
        </div>
      </div>

      {/* 批注弹窗（驳回 + 意见） */}
      <FsModal
        open={!!commentStep}
        onClose={() => setCommentStep(null)}
        title={`对「${PORTAL_STEPS.find((s) => s.key === commentStep)?.label ?? ""}」提意见`}
        footer={
          <>
            <FsButton variant="secondary" size="sm" onClick={() => setCommentStep(null)}>
              取消
            </FsButton>
            <FsButton
              size="sm"
              disabled={commentStep ? savingStep === commentStep : false}
              onClick={() => void submitComment()}
            >
              {commentStep && savingStep === commentStep ? "提交中…" : "提交意见"}
            </FsButton>
          </>
        }
      >
        <p className="mb-2 text-12 text-tertiary">写下想调整的地方，设计师会按这个方向修改。</p>
        <textarea
          className={cn(fsInputClass, "min-h-24 resize-y")}
          value={commentText}
          autoFocus
          placeholder="例如：客厅想再亮一点，沙发换成浅色"
          onChange={(e) => setCommentText(e.target.value)}
        />
      </FsModal>
    </>
  );
}

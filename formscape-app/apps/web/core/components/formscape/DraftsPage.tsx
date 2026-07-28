/**
 * 草稿 = 工作项草稿（AI/纪要生成，尚未正式创建到看板）
 * 发布 → 写入 tasks-store 并跳转项目任务；删除 → FsConfirm
 * 顶栏由 drafts/layout AppHeader 负责，页内不再套 FsPageHeader，避免双栏
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { FileEdit, Sparkles } from "@/icons";
import type { DraftItem } from "./pm-mock";
import { hideDraft, publishDraftAsTask, useDrafts } from "./tasks-store";
import { FsButton, FsConfirm, FsEmpty, FsMuted, FsTag } from "./ui";

type Props = { workspaceSlug: string };

export function FormscapeDraftsPage({ workspaceSlug }: Props) {
  const { drafts } = useDrafts();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<DraftItem | null>(null);

  const publish = (d: DraftItem) => {
    const task = publishDraftAsTask(d);
    if (!task) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "该草稿未关联项目",
        message: "先在项目里创建同名任务，或删除此草稿",
      });
      return;
    }
    setToast({
      type: TOAST_TYPE.SUCCESS,
      title: "已发布为任务",
      message: `${task.key} · ${task.title}`,
    });
    navigate(`/${workspaceSlug}/projects/${d.projectId}/issues`);
  };

  return (
    <div className="h-full overflow-y-auto bg-surface-1 px-3 py-4 md:px-4">
      <div className="mx-auto w-full max-w-[900px] space-y-3">
        <div className="rounded-lg border border-accent-primary/20 bg-accent-subtle/40 px-3 py-2 text-11 text-secondary">
          <span className="inline-flex items-center gap-1 font-medium text-primary">
            <Sparkles className="size-3.5" strokeWidth={1.75} /> 草稿箱
          </span>
          {" — "}
          从对话、纪要、清单生成的<strong className="text-primary">未发布工作项</strong>
          。发布后进入对应项目「任务」看板。
        </div>

        <FsMuted>共 {drafts.length} 条草稿 · Demo 数据</FsMuted>

        <div className="space-y-2">
          {drafts.map((d) => (
            <div
              key={d.id}
              className="flex flex-col gap-3 rounded-lg border border-subtle bg-surface-1 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex min-w-0 flex-1 gap-2.5">
                <FileEdit className="mt-0.5 size-4 shrink-0 text-placeholder" strokeWidth={1.75} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-13 font-medium text-primary">{d.title}</span>
                    <FsTag>{d.kind}</FsTag>
                  </div>
                  <div className="mt-1 text-11 text-tertiary">
                    {d.projectName ? (
                      <Link
                        to={`/${workspaceSlug}/projects/${d.projectId}/issues`}
                        className="text-accent-primary hover:underline"
                      >
                        {d.projectName}
                      </Link>
                    ) : (
                      "未关联项目"
                    )}
                    {" · "}
                    {d.updatedAt}
                  </div>
                  <div className="mt-1 text-11 text-placeholder">{d.note}</div>
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5 sm:flex-col sm:items-end">
                <FsButton size="sm" disabled={!d.projectId} onClick={() => publish(d)}>
                  发布为任务
                </FsButton>
                <FsButton size="sm" variant="secondary" onClick={() => setDeleting(d)}>
                  删除
                </FsButton>
              </div>
            </div>
          ))}
          {drafts.length === 0 && (
            <FsEmpty
              title="草稿箱清空了"
              body="AI 对话与纪要产出的工作项草稿会先落到这里，确认后再发布为任务。"
            />
          )}
        </div>
      </div>

      <FsConfirm
        open={!!deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            hideDraft(deleting.id);
            setToast({ type: TOAST_TYPE.SUCCESS, title: "草稿已删除", message: deleting.title });
          }
          setDeleting(null);
        }}
        title="删除草稿？"
        body={deleting ? `「${deleting.title}」将从草稿箱移除，不会创建任务。` : undefined}
        confirmLabel="删除"
        danger
      />
    </div>
  );
}

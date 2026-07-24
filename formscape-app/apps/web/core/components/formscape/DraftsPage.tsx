/**
 * 草稿 = 工作项草稿（AI/纪要生成，尚未正式创建到看板）
 * 顶栏由 drafts/layout AppHeader 负责，页内不再套 FsPageHeader，避免双栏
 */
import { Link } from "react-router";
import { FileEdit, Sparkles } from "@/icons";
import { DRAFT_ITEMS } from "./pm-mock";
import { FsMuted, FsTag } from "./ui";

type Props = { workspaceSlug: string };

export function FormscapeDraftsPage({ workspaceSlug }: Props) {
  return (
    <div className="h-full overflow-y-auto bg-surface-1 px-3 py-4 md:px-4">
      <div className="mx-auto w-full max-w-[900px] space-y-3">
        <div className="rounded-lg border border-accent-primary/20 bg-accent-subtle/40 px-3 py-2 text-11 text-secondary">
          <span className="inline-flex items-center gap-1 font-medium text-primary">
            <Sparkles className="size-3.5" /> 草稿箱
          </span>
          {" — "}
          从对话、纪要、清单生成的<strong className="text-primary">未发布工作项</strong>
          。发布后进入对应项目「任务」看板。
        </div>

        <FsMuted>共 {DRAFT_ITEMS.length} 条草稿 · Demo 列表</FsMuted>

        <div className="space-y-2">
          {DRAFT_ITEMS.map((d) => (
            <div
              key={d.id}
              className="flex flex-col gap-3 rounded-lg border border-subtle bg-surface-1 px-3 py-3 shadow-sm sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex min-w-0 flex-1 gap-2.5">
                <FileEdit className="mt-0.5 size-4 shrink-0 text-placeholder" />
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
                <button
                  type="button"
                  className="rounded-md bg-accent-primary px-2.5 py-1 text-11 font-medium text-on-color"
                >
                  发布为任务
                </button>
                <button
                  type="button"
                  className="rounded-md border border-subtle px-2.5 py-1 text-11 font-medium text-secondary"
                >
                  继续编辑
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

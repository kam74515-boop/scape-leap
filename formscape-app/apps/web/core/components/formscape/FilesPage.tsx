import { PageHead } from "@/components/core/page-title";
import { useFormscapeProject } from "./use-formscape-project";
import { FsMuted, FsPageBody, FsPageShell, FsTag } from "./ui";

type Props = { workspaceSlug: string; projectId: string };

const FILES = [
  { id: "f1", name: "量房平面图.pdf", kind: "图纸", size: "2.4 MB", date: "2026-07-10" },
  { id: "f2", name: "风格意向板-v2.png", kind: "效果图", size: "4.1 MB", date: "2026-07-18" },
  { id: "f3", name: "材料清单.xlsx", kind: "清单", size: "180 KB", date: "2026-07-19" },
  { id: "f4", name: "设计合同-草稿.docx", kind: "合同", size: "96 KB", date: "2026-07-08" },
];

export function FormscapeFilesPage({ projectId }: Props) {
  const { project } = useFormscapeProject();

  return (
    <>
      <PageHead title={`${project.name} · 文件`} />
      <FsPageShell>
        <FsPageBody>
          <div className="mb-3">
            <div className="text-13 font-semibold text-primary">文件</div>
            <FsMuted className="mt-0.5">图纸 · 效果图 · 合同 · 清单</FsMuted>
          </div>
          <div className="w-full space-y-1.5">
            {FILES.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-md border border-subtle bg-surface-1 px-3 py-2.5"
              >
                <div>
                  <div className="text-13 font-medium text-primary">{f.name}</div>
                  <div className="text-11 text-tertiary">
                    {f.size} · {f.date}
                  </div>
                </div>
                <FsTag>{f.kind}</FsTag>
              </div>
            ))}
            <FsMuted className="pt-2">Demo 列表 · 生产环境对接附件存储</FsMuted>
          </div>
        </FsPageBody>
      </FsPageShell>
    </>
  );
}

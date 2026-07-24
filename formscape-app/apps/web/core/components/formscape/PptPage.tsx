import { PageHead } from "@/components/core/page-title";
import { useFormscapeProject } from "./use-formscape-project";
import { FsCard, FsMuted, FsPageBody, FsPageShell, FsPrimaryLink, FsSecondaryLink } from "./ui";

type Props = { workspaceSlug: string; projectId: string };

const SLIDES = [
  { id: 1, title: "封面", desc: "项目名 · 客户 · 工作室" },
  { id: 2, title: "需求摘要", desc: "档案 · 预算 · 时间线" },
  { id: 3, title: "风格意向", desc: "Moodboard 精选 3 张" },
  { id: 4, title: "空间方案", desc: "白模 / 效果图" },
  { id: 5, title: "材料与报价", desc: "清单 + 设计费" },
  { id: 6, title: "下一步", desc: "确认节点 · Portal" },
];

export function FormscapePptPage({ workspaceSlug, projectId }: Props) {
  const { project } = useFormscapeProject();
  const base = `/${workspaceSlug}/projects/${projectId}`;

  return (
    <>
      <PageHead title={`${project.name} · 汇报`} />
      <FsPageShell>
        <FsPageBody>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-13 font-semibold text-primary">汇报 PPT</div>
              <FsMuted className="mt-0.5">从项目资产灌版 · Demo 幻灯片结构</FsMuted>
            </div>
            <div className="flex gap-2">
              <FsSecondaryLink to={`${base}/overview`}>返回概览</FsSecondaryLink>
              <FsPrimaryLink to={`${base}/stages/style`}>去风格素材</FsPrimaryLink>
            </div>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SLIDES.map((s) => (
              <FsCard key={s.id} className="flex min-h-36 flex-col">
                <div className="mb-2 text-11 font-medium text-placeholder">Slide {s.id}</div>
                <div className="text-13 font-semibold text-primary">{s.title}</div>
                <FsMuted className="mt-1 flex-1">{s.desc}</FsMuted>
                <div className="mt-3 text-11 text-tertiary">{project.name}</div>
              </FsCard>
            ))}
          </div>
          <FsMuted className="mt-4 text-center">
            正式版将支持 pptx 导出；当前为结构 Demo。
          </FsMuted>
        </FsPageBody>
      </FsPageShell>
    </>
  );
}

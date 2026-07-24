import { PageHead } from "@/components/core/page-title";
import { CUSTOMERS } from "./workspace-mock";
import { FsCard, FsMuted, FsPageBody, FsPageHeader, FsPageShell, FsTag, FsTextLink } from "./ui";

type Props = { workspaceSlug: string };

export function FormscapeCustomersPage({ workspaceSlug }: Props) {
  return (
    <>
      <PageHead title="客户 · 构境AI" />
      <FsPageShell>
        <FsPageHeader title="客户" description="轻量 CRM · 客户挂项目经营" />
        <FsPageBody>
          <div className="w-full space-y-2">
            <FsMuted className="mb-3">Demo 数据 · 客户主数据 + 商机状态</FsMuted>
            <div className="overflow-hidden rounded-lg border border-subtle">
              <table className="w-full text-left text-13">
                <thead className="border-b border-subtle bg-surface-1 text-11 font-medium text-tertiary">
                  <tr>
                    <th className="px-3 py-2.5">客户</th>
                    <th className="px-3 py-2.5">城市</th>
                    <th className="px-3 py-2.5">阶段</th>
                    <th className="px-3 py-2.5">关联项目</th>
                    <th className="px-3 py-2.5">预算</th>
                    <th className="px-3 py-2.5">更新</th>
                  </tr>
                </thead>
                <tbody>
                  {CUSTOMERS.map((c) => (
                    <tr key={c.id} className="border-b border-subtle last:border-0 hover:bg-surface-2/60">
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-primary">{c.name}</div>
                        <div className="text-11 text-tertiary">{c.phone}</div>
                      </td>
                      <td className="px-3 py-2.5 text-secondary">{c.city}</td>
                      <td className="px-3 py-2.5">
                        <FsTag>{c.stage}</FsTag>
                      </td>
                      <td className="px-3 py-2.5">
                        <FsTextLink to={`/${workspaceSlug}/projects/${c.projectId}/overview`}>
                          {c.projectName}
                        </FsTextLink>
                      </td>
                      <td className="px-3 py-2.5 text-secondary">{c.budgetWan} 万</td>
                      <td className="px-3 py-2.5 text-11 text-tertiary">{c.updatedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <FsCard className="mt-3">
              <div className="text-13 font-medium text-primary">说明</div>
              <FsMuted className="mt-1">
                产品目标为 Org 级客户库；落地可先压进项目 profile。本页为工作区 L1「客户」Demo。
              </FsMuted>
            </FsCard>
          </div>
        </FsPageBody>
      </FsPageShell>
    </>
  );
}

import { Link, useLocation } from "react-router";
import brandMark from "@/app/assets/brand/mark.svg?url";
import { PageHead } from "@/components/core/page-title";

const termsSections = [
  ["账号与访问", "你应妥善保管账号凭据，并仅向获授权的团队成员开放工作区。"],
  ["内容与数据", "你保留所上传设计资料的权利，并应确保有权处理相关客户与项目数据。"],
  ["合理使用", "不得利用服务实施违法活动、破坏系统安全或侵害第三方合法权益。"],
  ["服务变更", "我们可能为安全、稳定性和产品改进调整功能，并尽量提前说明重大变化。"],
];

const privacySections = [
  ["收集范围", "我们处理账号信息、项目数据、操作日志和必要的设备信息，以提供与保护服务。"],
  ["使用目的", "数据用于身份认证、项目协作、客户交付、故障排查、安全审计和产品改进。"],
  ["存储与保护", "生产数据存储于台湾区域 PostgreSQL，采用访问控制、加密传输和定期备份。"],
  ["你的权利", "你可以申请访问、更正、导出或删除个人信息；法律要求保留的审计记录除外。"],
];

export default function LegalPage() {
  const { pathname } = useLocation();
  const privacy = pathname.endsWith("/privacy");
  const title = privacy ? "隐私政策" : "服务条款";
  const sections = privacy ? privacySections : termsSections;

  return (
    <main className="min-h-screen bg-surface-1 px-5 py-8 text-primary">
      <PageHead title={`${title} · 构境AI`} />
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-2">
          <img src={brandMark} alt="" className="size-8 rounded-lg" />
          <span className="text-14 font-semibold">构境AI</span>
        </Link>
        <div className="mt-10 border-b border-subtle pb-6">
          <h1 className="text-28 font-semibold">{title}</h1>
          <p className="mt-2 text-13 text-tertiary">生效日期：2026 年 7 月 28 日</p>
        </div>
        <div className="space-y-7 py-8">
          {sections.map(([heading, body]) => (
            <section key={heading}>
              <h2 className="text-16 font-semibold">{heading}</h2>
              <p className="mt-2 text-14 leading-7 text-secondary">{body}</p>
            </section>
          ))}
        </div>
        <p className="border-t border-subtle pt-6 text-12 text-tertiary">联系邮箱：support@museart.cloud</p>
      </div>
    </main>
  );
}

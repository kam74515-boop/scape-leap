/**
 * 构境AI 生产错误页 — 取代 Plane 维护模式插画（去 Plane 影子）。
 * 视觉契约 = 设计规范 v3：线条插画（currentColor 随主题）+ 结果导向中文文案。
 */
// plane imports
import { Button } from "@plane/propel/button";
// layouts
import DefaultLayout from "@/layouts/default-layout";

const linkMap = [
  {
    key: "mail_to",
    label: "联系支持",
    value: "mailto:support@formscape.com",
  },
  {
    key: "home",
    label: "构境AI",
    value: "https://formscape.com",
  },
];

/** 构境线条插画 · 盾牌警示（currentColor，随主题） */
function FsErrorArt() {
  return (
    <svg viewBox="0 0 88 64" width="160" height="116" fill="none" className="text-placeholder" aria-hidden>
      <path
        d="M44 6l24 9v16c0 15-10 24-24 27-14-3-24-12-24-27V15l24-9z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M44 22v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="44" cy="43" r="1.8" fill="currentColor" />
    </svg>
  );
}

interface ProdErrorComponentProps {
  onGoHome: () => void;
}

export function ProdErrorComponent({ onGoHome }: ProdErrorComponentProps) {
  return (
    <DefaultLayout>
      <div className="relative container mx-auto flex h-full w-full max-w-xl flex-col items-center justify-center gap-2 gap-y-6 bg-surface-1 px-6 text-center">
        <FsErrorArt />
        <div className="relative mt-2 flex w-full flex-col gap-4">
          <div className="flex flex-col gap-2.5">
            <h1 className="text-left text-18 font-semibold text-primary">页面出了点问题</h1>
            <span className="text-left text-14 font-medium text-secondary">
              我们已记录这次异常并在处理。先刷新试试；如果还不行，联系我们。
            </span>
          </div>

          <div className="mt-1 flex items-center justify-start gap-6">
            {linkMap.map((link) => (
              <div key={link.key}>
                <a
                  href={link.value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-13 text-accent-primary hover:underline"
                >
                  {link.label}
                </a>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-start gap-6">
            <Button variant="primary" size="lg" onClick={onGoHome}>
              回到首页
            </Button>
          </div>
        </div>
      </div>
    </DefaultLayout>
  );
}

/**
 * 构境AI 空态线条插画（设计规范 v3：currentColor 描边、随主题、扁平）。
 * 取代 Plane 全套空态插画（去 Plane 影子）——asset-registry 的两个
 * getter 统一改从这里出图；按 assetKey 粗分 5 个语义变体。
 */

type LineArtProps = { className?: string };

/** 通用：图片 + 文档线稿（同 formscape ui.tsx FsEmptyIllustration 同族） */
export function FsLineArtGeneric({ className }: LineArtProps) {
  return (
    <svg viewBox="0 0 88 64" fill="none" className={className} aria-hidden>
      <rect x="6" y="10" width="52" height="40" rx="6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6 42l14-12 12 10 8-6 18 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="24" r="4" stroke="currentColor" strokeWidth="1.5" />
      <rect x="62" y="22" width="20" height="28" rx="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M67 30h10M67 36h10M67 42h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M74 10l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2 1.2-3z" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

/** 项目 / 看板：卡片列线稿 */
export function FsLineArtBoard({ className }: LineArtProps) {
  return (
    <svg viewBox="0 0 88 64" fill="none" className={className} aria-hidden>
      <rect x="8" y="10" width="20" height="44" rx="5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="34" y="10" width="20" height="30" rx="5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="60" y="10" width="20" height="38" rx="5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12" y="16" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.25" />
      <rect x="12" y="28" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.25" />
      <rect x="38" y="16" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.25" />
      <rect x="64" y="16" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.25" />
      <path d="M38 30h12M38 34h8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

/** 无权限 / 404 / 链接失效：盾牌 + 警示线稿 */
export function FsLineArtShield({ className }: LineArtProps) {
  return (
    <svg viewBox="0 0 88 64" fill="none" className={className} aria-hidden>
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

/** 搜索 / 空结果：放大镜线稿 */
export function FsLineArtSearch({ className }: LineArtProps) {
  return (
    <svg viewBox="0 0 88 64" fill="none" className={className} aria-hidden>
      <circle cx="38" cy="28" r="18" stroke="currentColor" strokeWidth="1.5" />
      <path d="M51 41l14 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M30 28h16M38 20v16" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

/** 收件箱 / 消息：托盘线稿 */
export function FsLineArtInbox({ className }: LineArtProps) {
  return (
    <svg viewBox="0 0 88 64" fill="none" className={className} aria-hidden>
      <path
        d="M10 14h68v36H10V14z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 38h20l6 6h16l6-6h20" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M26 22h20M26 28h12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

/** 按 assetKey 语义粗分变体（键名来自 Plane 资产类型，值已全面换构境插画） */
export function fsLineArtForKey(key: string): React.ComponentType<LineArtProps> {
  if (key.includes("access") || key.includes("404") || key.includes("invalid") || key.includes("error"))
    return FsLineArtShield;
  if (key.includes("search")) return FsLineArtSearch;
  if (key.includes("inbox") || key.includes("note") || key.includes("update") || key.includes("changelog"))
    return FsLineArtInbox;
  if (
    key.includes("project") ||
    key.includes("cycle") ||
    key.includes("module") ||
    key.includes("work-item") ||
    key.includes("epic") ||
    key.includes("view") ||
    key.includes("dashboard") ||
    key.includes("initiative") ||
    key.includes("teamspace") ||
    key.includes("archived") ||
    key.includes("draft")
  )
    return FsLineArtBoard;
  return FsLineArtGeneric;
}

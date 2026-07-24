/**
 * 画布懒加载占位 — 与 CanvasWorkspace 壳层对齐，避免闪一下空白
 */
export function CanvasWorkspaceSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-surface-1" aria-busy aria-label="画布加载中">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--border-subtle)_1px,transparent_0)] [background-size:20px_20px] opacity-60" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 rounded-lg border border-subtle bg-surface-1/90 px-5 py-4 shadow-sm backdrop-blur-sm">
          <div className="size-5 animate-spin rounded-full border-2 border-subtle border-t-accent-primary" />
          <div className="text-12 text-tertiary">加载画布引擎…</div>
        </div>
      </div>
      {/* 底栏占位，与真实 toolbar 高度接近 */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex h-10 -translate-x-1/2 items-center gap-1 rounded-xl border border-subtle bg-surface-1/80 px-3 opacity-70 shadow-sm backdrop-blur-sm">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="size-7 animate-pulse rounded-md bg-surface-2" />
        ))}
      </div>
    </div>
  );
}

import { X } from "@/icons";
import { cn } from "@plane/utils";
import type { CanvasBgPattern, CanvasSettings } from "../types";

type Props = {
  open: boolean;
  settings: CanvasSettings;
  onChange: (patch: Partial<CanvasSettings>) => void;
  onClose: () => void;
  onResetCanvas: () => void;
};

const PATTERNS: { id: CanvasBgPattern; label: string }[] = [
  { id: "dots", label: "点阵" },
  { id: "lines", label: "线格" },
  { id: "cross", label: "十字" },
  { id: "none", label: "纯色" },
];

export function SettingsModal({ open, settings, onChange, onClose, onResetCanvas }: Props) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 p-4">
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border border-subtle bg-surface-1 shadow-xl"
        role="dialog"
        aria-label="画布设置"
      >
        <div className="flex h-11 items-center justify-between border-b border-subtle px-3">
          <span className="text-13 font-semibold text-primary">画布设置</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-tertiary hover:bg-layer-transparent-hover"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <section>
            <div className="mb-2 text-11 font-semibold text-placeholder">背景</div>
            <div className="flex flex-wrap gap-1.5">
              {PATTERNS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChange({ bgPattern: p.id })}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-11 font-medium transition-colors",
                    settings.bgPattern === p.id
                      ? "bg-accent-primary text-on-color"
                      : "bg-surface-2 text-secondary hover:bg-layer-transparent-hover"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="mb-1 text-11 font-semibold text-placeholder">工具栏</div>
            <Toggle
              label="显示工具名称"
              checked={settings.showToolNames}
              onChange={(v) => onChange({ showToolNames: v })}
            />
            <Toggle
              label="图库 / 技能库互斥"
              checked={settings.panelsExclusive}
              onChange={(v) => onChange({ panelsExclusive: v })}
            />
            <Toggle
              label="吸附网格"
              checked={settings.snapToGrid}
              onChange={(v) => onChange({ snapToGrid: v })}
            />
            <Toggle
              label="显示小地图"
              checked={settings.showMinimap !== false}
              onChange={(v) => onChange({ showMinimap: v })}
            />
          </section>

          <section>
            <div className="mb-2 text-11 font-semibold text-placeholder">数据</div>
            <button
              type="button"
              onClick={() => {
                onResetCanvas();
                onClose();
              }}
              className="rounded-md border border-subtle px-3 py-1.5 text-11 font-medium text-secondary hover:bg-surface-2"
            >
              重置为项目 moodboard
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-subtle px-3 py-2">
      <span className="text-11 text-secondary">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-accent-primary" : "bg-surface-2"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-surface-1 shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </button>
    </label>
  );
}

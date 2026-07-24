import { Maximize2, Minus, Plus, Redo2, Undo2 } from "@/icons";

type Props = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
};

/** Lovspark 风格左下横向 pill 控件 */
export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: Props) {
  const pct = Math.round(zoom * 100);
  return (
    <div className="fs-zoom-controls">
      <button type="button" title="撤销" disabled={!canUndo} onClick={onUndo}>
        <Undo2 className="size-3.5" />
      </button>
      <button type="button" title="重做" disabled={!canRedo} onClick={onRedo}>
        <Redo2 className="size-3.5" />
      </button>
      <button type="button" title="缩小" onClick={onZoomOut}>
        <Minus className="size-3.5" />
      </button>
      <button type="button" title="重置 100%" onClick={onReset}>
        {pct}%
      </button>
      <button type="button" title="放大" onClick={onZoomIn}>
        <Plus className="size-3.5" />
      </button>
      <button type="button" title="适应画布" onClick={onFit}>
        <Maximize2 className="size-3.5" />
      </button>
    </div>
  );
}

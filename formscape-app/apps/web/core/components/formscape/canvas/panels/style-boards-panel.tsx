/**
 * L2 · 项目风格图板
 * - 分类多图板：风格 / 产品 / 材质 / 镜头
 * - pin 可落到工作画布作参考
 * - 预留 Pinterest / SU 镜头接入
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, ImagePlus, LayoutGrid, Plus, Trash2 } from "lucide-react";
import { cn } from "@plane/utils";
import { FsButton, FsConfirm, FsModal } from "../../ui";
import {
  STYLE_BOARDS_CHANGE_EVENT,
  STYLE_BOARD_CAT_LABEL,
  STYLE_PIN_KIND_LABEL,
  createStyleBoard,
  deleteStyleBoard,
  listStyleBoards,
  pinFromCamera,
  pinFromExternalLink,
  removePin,
  addPinToBoard,
  type StyleBoard,
  type StylePin,
} from "../../style-boards-store";
import { ecoFallbackGradient } from "../../ecology-mock";

type Props = {
  projectId: string;
  projectName?: string;
  onPlacePin: (pin: StylePin) => void;
  onPlaceBoard?: (board: StyleBoard) => void;
};

export function StyleBoardsPanel({ projectId, projectName, onPlacePin, onPlaceBoard }: Props) {
  const [tick, setTick] = useState(0);
  const boards = useMemo(() => {
    void tick;
    return listStyleBoards(projectId);
  }, [projectId, tick]);

  const [activeId, setActiveId] = useState<string>(() => boards[0]?.id ?? "");

  useEffect(() => {
    const onCh = () => setTick((t) => t + 1);
    window.addEventListener(STYLE_BOARDS_CHANGE_EVENT, onCh);
    return () => window.removeEventListener(STYLE_BOARDS_CHANGE_EVENT, onCh);
  }, []);

  useEffect(() => {
    if (!boards.find((b) => b.id === activeId) && boards[0]) {
      setActiveId(boards[0].id);
    }
  }, [boards, activeId]);

  const active = boards.find((b) => b.id === activeId) ?? boards[0];

  /** 新建图板：FsModal 输入（禁用原生 prompt） */
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("综合灵感");
  /** 删除图板：FsConfirm（禁用原生 confirm） */
  const [deleteOpen, setDeleteOpen] = useState(false);

  const confirmCreateBoard = useCallback(() => {
    const name = createName.trim();
    if (!name) return;
    const b = createStyleBoard(projectId, name, "mixed");
    setActiveId(b.id);
    setTick((t) => t + 1);
    setCreateOpen(false);
    setCreateName("综合灵感");
  }, [projectId, createName]);

  const addCameraDemo = useCallback(() => {
    if (!active) return;
    addPinToBoard(
      projectId,
      active.id,
      pinFromCamera({
        title: `SU 镜头 · ${active.pins.filter((p) => p.kind === "camera").length + 1}`,
        camera: {
          software: "sketchup",
          fov: 35,
          eye: [4.2, 1.6, 3.1],
          target: [0, 1.2, 0],
          note: "客厅主视角（Demo 占位，后续对接插件）",
        },
      })
    );
    setTick((t) => t + 1);
  }, [projectId, active]);

  const addPinterestDemo = useCallback(() => {
    if (!active) return;
    addPinToBoard(
      projectId,
      active.id,
      pinFromExternalLink({
        title: "Pinterest 收藏 · 暖白拱门",
        url: "https://www.pinterest.com/",
        sourceLabel: "Pinterest",
      })
    );
    setTick((t) => t + 1);
  }, [projectId, active]);

  const removeBoard = useCallback(() => {
    if (!active || boards.length <= 1) return;
    deleteStyleBoard(projectId, active.id);
    setTick((t) => t + 1);
    setDeleteOpen(false);
  }, [projectId, active, boards.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-1.5 px-0.5">
        <div className="text-11 font-semibold text-primary">项目图板</div>
        <div className="text-10 text-tertiary">
          {projectName ? `${projectName} · ` : ""}
          生态选品 / 材质 / 参考图 / 镜头 · 后续 Pinterest
        </div>
      </div>

      {/* 图板 tabs */}
      <div className="mb-2 flex flex-wrap items-center gap-1">
        {boards.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setActiveId(b.id)}
            className={cn(
              "rounded-full px-2 py-0.5 text-10 font-medium transition-colors duration-150 ease-out",
              active?.id === b.id
                ? "bg-accent-subtle text-accent-primary"
                : "bg-surface-2 text-tertiary hover:text-secondary"
            )}
            title={`${STYLE_BOARD_CAT_LABEL[b.category]} · ${b.pins.length} 项`}
          >
            {b.name}
            <span className="ml-1 opacity-60">{b.pins.length}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-10 text-secondary transition-colors duration-150 ease-out hover:bg-layer-transparent-hover"
          title="新建图板"
        >
          <Plus className="size-3" strokeWidth={1.75} />
          新建
        </button>
      </div>

      {active && (
        <div className="mb-2 flex flex-wrap items-center gap-1">
          <span className="text-10 text-placeholder">
            {STYLE_BOARD_CAT_LABEL[active.category]}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-10 text-secondary hover:bg-layer-transparent-hover"
            onClick={addCameraDemo}
            title="添加镜头设定（Demo）"
          >
            <Camera className="size-3" />
            镜头
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-10 text-secondary hover:bg-layer-transparent-hover"
            onClick={addPinterestDemo}
            title="模拟外站收藏（Pinterest 占位）"
          >
            <ImagePlus className="size-3" />
            外链
          </button>
          {active.pins.length > 0 && onPlaceBoard && (
            <button
              type="button"
              className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-10 font-medium text-accent-primary hover:bg-accent-subtle"
              onClick={() => onPlaceBoard(active)}
              title="整板落到画布作参考条"
            >
              <LayoutGrid className="size-3" />
              整板落画布
            </button>
          )}
          {boards.length > 1 && (
            <button
              type="button"
              className="ml-auto rounded-full px-2 py-0.5 text-10 text-tertiary transition-colors duration-150 ease-out hover:bg-danger-subtle hover:text-danger-primary"
              onClick={() => setDeleteOpen(true)}
            >
              删除板
            </button>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-0.5 pb-2">
        {!active?.pins.length && (
          <div className="py-8 text-center text-11 text-tertiary">
            图板为空
            <div className="mt-1 text-10 text-placeholder">
              从「生态库」点「加入图板」，或添加镜头 / 外链 Demo
            </div>
          </div>
        )}
        {active?.pins.map((pin) => (
          <PinRow
            key={pin.id}
            pin={pin}
            onPlace={() => onPlacePin(pin)}
            onRemove={() => {
              if (!active) return;
              removePin(projectId, active.id, pin.id);
              setTick((t) => t + 1);
            }}
          />
        ))}
      </div>

      {/* 新建图板（FsModal，替代原生 prompt） */}
      <FsModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="新建图板"
        footer={
          <>
            <FsButton variant="secondary" size="sm" onClick={() => setCreateOpen(false)}>
              取消
            </FsButton>
            <FsButton variant="primary" size="sm" disabled={!createName.trim()} onClick={confirmCreateBoard}>
              新建
            </FsButton>
          </>
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-12 text-tertiary">图板名称</span>
          <input
            autoFocus
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmCreateBoard();
            }}
            placeholder="例如：综合灵感"
            className="w-full rounded-lg border border-subtle bg-surface-1 px-3 py-2 text-13 text-primary outline-none transition-colors duration-150 ease-out placeholder:text-placeholder focus:border-accent-strong"
          />
        </label>
      </FsModal>

      {/* 删除图板（FsConfirm，替代原生 confirm） */}
      <FsConfirm
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={removeBoard}
        title={`删除图板「${active?.name ?? ""}」？`}
        body={`图板内 ${active?.pins.length ?? 0} 项收藏将一并移除，画布上已铺开的素材不受影响。`}
        confirmLabel="删除"
        danger
      />
    </div>
  );
}

function PinRow({
  pin,
  onPlace,
  onRemove,
}: {
  pin: StylePin;
  onPlace: () => void;
  onRemove: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div className="flex gap-2 rounded-md border border-subtle px-2 py-1.5 hover:border-accent-primary/40">
      <button type="button" onClick={onPlace} className="shrink-0" title="落到画布">
        {pin.src && !imgFailed ? (
          <img
            src={pin.src}
            alt=""
            className="size-11 rounded-md object-cover"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className="flex size-11 items-center justify-center rounded-md text-10 text-white/80"
            style={{
              background: pin.colors?.length
                ? `linear-gradient(135deg, ${pin.colors.join(",")})`
                : ecoFallbackGradient(pin.id),
            }}
          >
            {pin.kind === "camera" ? <Camera className="size-4" /> : null}
          </div>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onPlace} className="w-full text-left">
          <div className="truncate text-11 font-medium text-primary">{pin.title}</div>
          <div className="truncate text-10 text-tertiary">
            {STYLE_PIN_KIND_LABEL[pin.kind]}
            {pin.brand ? ` · ${pin.brand}` : ""}
            {pin.sourceLabel ? ` · ${pin.sourceLabel}` : ""}
            {typeof pin.price === "number" ? ` · ¥${pin.price.toLocaleString()}` : ""}
          </div>
          {pin.camera?.note && (
            <div className="mt-0.5 truncate text-10 text-placeholder">{pin.camera.note}</div>
          )}
          {pin.externalUrl && (
            <div className="mt-0.5 truncate text-10 text-accent-primary">{pin.externalUrl}</div>
          )}
        </button>
      </div>
      <button
        type="button"
        className="shrink-0 self-start rounded p-1 text-placeholder hover:bg-danger-subtle hover:text-danger-primary"
        title="从本图板移除"
        onClick={onRemove}
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

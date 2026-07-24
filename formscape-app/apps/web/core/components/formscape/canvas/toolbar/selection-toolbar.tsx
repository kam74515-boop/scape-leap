import type { ReactNode } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Lock,
  LockOpen,
  Sparkles,
  Trash2,
} from "lucide-react";
import { getQuickEditSkills } from "../skills/match-skill";

type Props = {
  count: number;
  locked: boolean;
  showImageActions?: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
  onBringFront?: () => void;
  onSendBack?: () => void;
  onRegenerate?: () => void;
  /** 交互式改图 */
  onStyleExtend?: () => void;
  onVariant?: () => void;
  onAskAi?: () => void;
  /** 对选中图应用技能（mock 落图） */
  onApplySkill?: (skillId: string) => void;
  /** 局部改图（蒙版壳） */
  onMaskEdit?: () => void;
  /** 多选图像水平并排对比 */
  onArrangeRow?: () => void;
  onAlign?: (mode: AlignMode) => void;
};

export type AlignMode =
  | "left"
  | "center-x"
  | "right"
  | "top"
  | "center-y"
  | "bottom";

/** 选中节点浮出工具条 */
export function SelectionToolbar({
  count,
  locked,
  showImageActions,
  onDuplicate,
  onDelete,
  onToggleLock,
  onBringFront,
  onSendBack,
  onRegenerate,
  onStyleExtend,
  onVariant,
  onAskAi,
  onApplySkill,
  onMaskEdit,
  onArrangeRow,
  onAlign,
}: Props) {
  if (count === 0) return null;
  const quickSkills = showImageActions && onApplySkill ? getQuickEditSkills() : [];

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
      <div className="pointer-events-auto flex max-w-[min(96vw,920px)] items-center gap-0.5 overflow-x-auto rounded-md border border-subtle bg-surface-1 px-1 py-0.5 shadow-sm">
        <span className="shrink-0 px-2 text-11 font-medium text-tertiary">
          {count > 1 ? `${count} 项` : "已选中"}
        </span>
        <span className="h-4 w-px shrink-0 bg-subtle" />
        <Btn title="复制 ⌘D" onClick={onDuplicate}>
          <Copy className="size-3.5" />
        </Btn>
        <Btn title={locked ? "解锁" : "锁定"} onClick={onToggleLock}>
          {locked ? <LockOpen className="size-3.5" /> : <Lock className="size-3.5" />}
        </Btn>
        {onBringFront && (
          <Btn title="置于顶层 ]" onClick={onBringFront}>
            <ArrowUpToLine className="size-3.5" />
          </Btn>
        )}
        {onSendBack && (
          <Btn title="置于底层 [" onClick={onSendBack}>
            <ArrowDownToLine className="size-3.5" />
          </Btn>
        )}
        {count >= 2 && onArrangeRow && showImageActions && (
          <>
            <span className="h-4 w-px shrink-0 bg-subtle" />
            <Btn title="水平并排对比" onClick={onArrangeRow}>
              <span className="text-[10px]">并排</span>
            </Btn>
          </>
        )}
        {count >= 2 && onAlign && (
          <>
            <span className="h-4 w-px shrink-0 bg-subtle" />
            <Btn title="左对齐" onClick={() => onAlign("left")}>
              <AlignStartVertical className="size-3.5" />
            </Btn>
            <Btn title="水平居中" onClick={() => onAlign("center-x")}>
              <AlignCenterVertical className="size-3.5" />
            </Btn>
            <Btn title="右对齐" onClick={() => onAlign("right")}>
              <AlignEndVertical className="size-3.5" />
            </Btn>
            <Btn title="顶对齐" onClick={() => onAlign("top")}>
              <AlignStartHorizontal className="size-3.5" />
            </Btn>
            <Btn title="垂直居中" onClick={() => onAlign("center-y")}>
              <AlignCenterHorizontal className="size-3.5" />
            </Btn>
            <Btn title="底对齐" onClick={() => onAlign("bottom")}>
              <AlignEndHorizontal className="size-3.5" />
            </Btn>
          </>
        )}
        {showImageActions && (
          <>
            <span className="h-4 w-px shrink-0 bg-subtle" />
            {onRegenerate && (
              <Btn title="再生成" onClick={onRegenerate}>
                <Sparkles className="size-3.5" />
                <span className="ml-0.5 text-[10px]">再生成</span>
              </Btn>
            )}
            {onStyleExtend && (
              <Btn title="风格延展" onClick={onStyleExtend}>
                <span className="text-[10px]">延展</span>
              </Btn>
            )}
            {onVariant && (
              <Btn title="出变体" onClick={onVariant}>
                <span className="text-[10px]">变体</span>
              </Btn>
            )}
            {onAskAi && (
              <Btn title="画布 Agent 改图" onClick={onAskAi}>
                <span className="text-[10px]">AI</span>
              </Btn>
            )}
            {onMaskEdit && (
              <Btn title="局部改图（蒙版）" onClick={onMaskEdit}>
                <span className="text-[10px]">局部</span>
              </Btn>
            )}
            {quickSkills.length > 0 && (
              <>
                <span className="h-4 w-px shrink-0 bg-subtle" />
                {quickSkills.map((s) => {
                  const short =
                    s.id === "architectural-multi-angle"
                      ? "多角度"
                      : s.id === "space-atmosphere-transformation"
                        ? "氛围"
                        : s.id === "material-replacement"
                          ? "材质"
                          : s.id === "white-model-rendering"
                            ? "白模"
                            : s.name.slice(0, 4);
                  return (
                    <Btn key={s.id} title={`技能：${s.name}`} onClick={() => onApplySkill?.(s.id)}>
                      <span className="text-[10px]">{short}</span>
                    </Btn>
                  );
                })}
              </>
            )}
          </>
        )}
        <Btn title="删除 ⌫" onClick={onDelete} danger>
          <Trash2 className="size-3.5" />
        </Btn>
      </div>
    </div>
  );
}

function Btn({
  title,
  onClick,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={
        danger
          ? "shrink-0 rounded-md p-1.5 text-danger-primary hover:bg-danger-subtle"
          : "shrink-0 rounded-md p-1.5 text-secondary hover:bg-layer-transparent-hover"
      }
    >
      {children}
    </button>
  );
}

import { memo, useState } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { MessageCircle } from "lucide-react";
import { cn } from "@plane/utils";
import { useCanvasNodeActions } from "../canvas-node-actions";
import type { CommentNodeData } from "../types";

type CommentNodeType = Node<CommentNodeData, "comment">;

function CommentNodeComponent({ id, data, selected }: NodeProps<CommentNodeType>) {
  const { patchNodeData } = useCanvasNodeActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.text);

  const commit = () => {
    setEditing(false);
    patchNodeData(id, { text: draft } as Partial<CommentNodeData>);
  };

  return (
    <div className="relative">
      <div
        className={cn(
          "flex size-8 items-center justify-center rounded-full border bg-surface-1 shadow-sm",
          selected
            ? "border-accent-primary shadow-[0_0_0_2px_color-mix(in_srgb,var(--bg-accent-primary)_40%,transparent)]"
            : "border-subtle"
        )}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setDraft(data.text);
          setEditing(true);
        }}
      >
        <MessageCircle className="size-4 text-accent-primary" />
      </div>
      {(selected || data.text || editing) && (
        <div className="absolute left-10 top-0 w-48 rounded-md border border-subtle bg-surface-1 p-2 shadow-sm">
          <div className="text-10 font-medium text-tertiary">{data.author || "我"}</div>
          {editing ? (
            <textarea
              autoFocus
              value={draft}
              rows={2}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setEditing(false);
                  setDraft(data.text);
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commit();
                }
              }}
              className="nodrag nopan nowheel mt-0.5 w-full resize-none bg-transparent text-11 text-primary outline-none"
              placeholder="写一条评论…"
            />
          ) : (
            <div
              className="mt-0.5 cursor-text text-11 text-primary"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setDraft(data.text);
                setEditing(true);
              }}
            >
              {data.text || "双击编辑评论…"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const CommentNode = memo(CommentNodeComponent);

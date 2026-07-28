import { memo, useState } from "react";
import { type Node, type NodeProps, NodeResizer } from "@xyflow/react";
import { cn } from "@plane/utils";
import { useCanvasNodeActions } from "../canvas-node-actions";
import type { TextNodeData } from "../types";
import { RESIZER_HANDLE, RESIZER_LINE, SELECTED_RING_SOFT } from "./selection-chrome";

type TextNodeType = Node<TextNodeData, "text">;

function TextNodeComponent({ id, data, selected }: NodeProps<TextNodeType>) {
  const { patchNodeData } = useCanvasNodeActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.text);

  const commit = () => {
    setEditing(false);
    patchNodeData(id, { text: draft } as Partial<TextNodeData>);
  };

  return (
    <div
      className={cn(
        "relative min-h-[32px] min-w-[80px] rounded-md px-2 py-1",
        selected && SELECTED_RING_SOFT
      )}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setDraft(data.text);
        setEditing(true);
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={60}
        minHeight={28}
        lineClassName={RESIZER_LINE}
        handleClassName={RESIZER_HANDLE}
      />
      {editing ? (
        <textarea
          autoFocus
          value={draft}
          rows={2}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onPointerDown={(e) => e.stopPropagation()}
          className="nodrag nopan nowheel w-full resize-none bg-transparent font-medium text-primary outline-none"
          style={{ fontSize: data.fontSize, fontWeight: data.bold ? 600 : 500 }}
        />
      ) : (
        <div
          className="whitespace-pre-wrap font-medium text-primary"
          style={{ fontSize: data.fontSize, fontWeight: data.bold ? 600 : 500 }}
        >
          {data.text || "双击编辑文字"}
        </div>
      )}
    </div>
  );
}

export const TextNode = memo(TextNodeComponent);

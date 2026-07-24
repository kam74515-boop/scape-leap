/**
 * 构境壳：L1 全高 · L2 大容器上下左右留白一致（flex 计算，避免 h-full+padding 裁切底边）
 */
import React from "react";
import { observer } from "mobx-react";
import { AppRailRoot } from "@/components/navigation";

/** 与参考图一致的面板外边距（上下必须相同） */
const PANEL_INSET = "0.5rem"; // 8px = Tailwind p-2

export const WorkspaceContentWrapper = observer(function WorkspaceContentWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex size-full min-h-0 overflow-hidden overscroll-none bg-canvas">
      <AppRailRoot />
      {/*
        不用 size-full + p-2：子项 h-full 会按「含 padding 的 100%」算高，底边被裁、上下视觉不一致。
        用 flex-1 + min-h-0，padding 只作用在 flex 项上，上下严格等距。
      */}
      <div
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        style={{
          paddingTop: PANEL_INSET,
          paddingBottom: PANEL_INSET,
          paddingRight: PANEL_INSET,
          paddingLeft: 0,
        }}
      >
        <div className="relative min-h-0 w-full flex-1 overflow-hidden overscroll-none">{children}</div>
      </div>
    </div>
  );
});

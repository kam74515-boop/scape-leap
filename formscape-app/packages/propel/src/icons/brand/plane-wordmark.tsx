/**
 * 构境AI 字标（原 PlaneWordmark）
 */
import * as React from "react";

import type { ISvgIcons } from "../type";

export function PlaneWordmark({ width = "120", height = "32", className, color = "currentColor" }: ISvgIcons) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 160 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="formscape"
    >
      <text
        x="0"
        y="28"
        fill={color}
        fontFamily="'PingFang SC','Noto Sans SC','Microsoft YaHei',system-ui,sans-serif"
        fontSize="26"
        fontWeight="650"
        letterSpacing="0.06em"
      >
        构境AI
      </text>
    </svg>
  );
}

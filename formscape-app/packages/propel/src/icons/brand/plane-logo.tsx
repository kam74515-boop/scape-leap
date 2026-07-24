/**
 * 构境AI brand mark（原 PlaneLogo 导出名保留，避免全仓改 import）
 */
import * as React from "react";

import type { ISvgIcons } from "../type";

/** 立方体 mark — 填充 currentColor，适配 light/dark */
export function PlaneLogo({ width = "40", height = "40", className, color = "currentColor" }: ISvgIcons) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 88 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="构境AI formscape"
    >
      <rect width="88" height="88" rx="20" fill={color} opacity="0.08" />
      <path
        fillRule="evenodd"
        d="M44 18 L67 31 L44 44 L21 31 Z M44 31 L55.5 37.5 L44 44 L32.5 37.5 Z"
        fill={color}
      />
      <path
        fillRule="evenodd"
        d="M21 31 L44 44 L44 70 L21 57 Z M32.5 37.5 L44 44 L44 57 L32.5 50.5 Z"
        fill={color}
        opacity="0.55"
      />
      <path
        fillRule="evenodd"
        d="M67 31 L44 44 L44 70 L67 57 Z M55.5 37.5 L44 44 L44 57 L55.5 50.5 Z"
        fill={color}
        opacity="0.35"
      />
    </svg>
  );
}

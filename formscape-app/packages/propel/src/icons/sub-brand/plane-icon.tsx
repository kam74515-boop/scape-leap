/**
 * 构境AI App Rail / 小图标（原 PlaneNewIcon）
 */
import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function PlaneNewIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  return (
    <IconWrapper color={color} {...rest}>
      {/* 缩放立方体 mark 进 16x16 视口 */}
      <g transform="translate(1.5,1.5) scale(0.148)">
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
      </g>
    </IconWrapper>
  );
}

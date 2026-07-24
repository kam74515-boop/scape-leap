/**
 * 统一图标渲染：默认 size=16、strokeWidth=1.5
 */
import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "@plane/utils";

const ICON_STROKE = 1.5;

type Props = Omit<LucideProps, "ref"> & {
  icon: LucideIcon;
  /** 像素尺寸，默认 16 */
  size?: number;
};

export function UiIcon({ icon: Icon, size = 16, className, strokeWidth = ICON_STROKE, ...rest }: Props) {
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      className={cn("shrink-0 text-current", className)}
      aria-hidden
      {...rest}
    />
  );
}

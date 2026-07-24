/**
 * 构境AI 加载标记
 */
import { useTheme } from "next-themes";
import mark from "@/app/assets/brand/mark.png?url";

export function LogoSpinner() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark" || resolvedTheme === "dark-contrast";

  return (
    <div className="flex items-center justify-center">
      <img
        src={mark}
        alt="构境AI"
        className={`h-10 w-10 object-contain sm:h-12 sm:w-12 ${isDark ? "opacity-95" : "opacity-100"}`}
      />
    </div>
  );
}

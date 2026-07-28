/**
 * 构境AI 加载标记
 * 注意：不得依赖 useTheme/resolvedTheme（服务端恒 undefined，
 * 客户端水合时已有值）——主题相关的分支会造成 hydration mismatch。
 * 品牌标为深色底板，双主题下均可见，固定 opacity-100。
 */
import mark from "@/app/assets/brand/mark.png?url";

export function LogoSpinner() {
  return (
    <div className="flex items-center justify-center">
      <img src={mark} alt="构境AI" className="h-10 w-10 object-contain opacity-100 sm:h-12 sm:w-12" />
    </div>
  );
}

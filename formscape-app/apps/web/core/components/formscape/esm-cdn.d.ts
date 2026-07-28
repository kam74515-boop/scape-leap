/**
 * CDN 动态导入声明：F23dPlanViewer 等用 esm.sh 按需加载 three（避免装包、@vite-ignore 跳过预打包）。
 * 返回 any —— 调用侧自行收窄。
 */
declare module "https://esm.sh/*";

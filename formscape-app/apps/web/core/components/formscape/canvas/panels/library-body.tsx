/**
 * 画布 L2 库内容
 * - 图板：项目风格图板（生态选品 / 参考 / 镜头）
 * - 图库：用户上传图 + AI 生成图（来自当前画布节点）
 * - 生态库：产品库（加入图板 / 落点画布）
 * - 技能库：封装的 AIGC 工作流 / 提示词
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Image as ImageIcon, Package, Search, Sparkles, Upload } from "@/icons";
import { LayoutGrid } from "lucide-react";
import { cn } from "@plane/utils";
import {
  ECO_PRODUCTS,
  ecoFallbackGradient,
  type EcoProduct,
} from "../../ecology-mock";
import type { CanvasSkillDef } from "../skills/registry";
import { SKILLS_BY_ID } from "../skills/registry";
import { listMockGallerySamples } from "../skills/mock-skill-assets";
import {
  CANVAS_DND_MIME,
  GEN_HISTORY_CHANGE_EVENT,
  clearGenHistory,
  encodeDndPayload,
  loadGenHistory,
  pushGenHistory,
} from "../skills/gen-history";
import type { LibSection } from "../canvas-library-context";
import type { FsCanvasNode } from "../use-canvas-document";
import type { ImageGenNodeData, ImageNodeData, VideoGenNodeData } from "../types";
import { SkillsLibraryGrid } from "./skills-library-grid";
import { StyleBoardsPanel } from "./style-boards-panel";
import type { StyleBoard, StylePin } from "../../style-boards-store";

export type LibContentSection = Exclude<LibSection, "boards">;

/** L2 顶栏：图板 · 图库 · 生态库 · 技能库（画布树另挂在 boards） */
export const LIB_CONTENT_TABS: {
  id: LibContentSection;
  label: string;
  icon: typeof ImageIcon;
  hint: string;
}[] = [
  { id: "styleboards", label: "图板", icon: LayoutGrid as typeof ImageIcon, hint: "项目风格图板" },
  { id: "images", label: "图库", icon: ImageIcon, hint: "上传与生成" },
  { id: "ecology", label: "生态库", icon: Package, hint: "产品库" },
  { id: "skills", label: "技能库", icon: Sparkles, hint: "AIGC 工作流" },
];

/** @deprecated 用 LIB_CONTENT_TABS */
export const LIB_TABS_NORMAL = LIB_CONTENT_TABS.filter((t) => t.id === "images");
/** @deprecated 用 LIB_CONTENT_TABS */
export const LIB_TABS_NODE = LIB_CONTENT_TABS.filter((t) => t.id === "skills" || t.id === "ecology");
export const LIB_TABS = LIB_CONTENT_TABS;

type GalleryFilter = "all" | "upload" | "generate" | "sample" | "history";

type GalleryItem = {
  id: string;
  nodeId: string;
  title: string;
  source: "upload" | "generate" | "library" | "agent";
  colors: string[];
  src?: string;
  subtitle: string;
};

function isGeneratedImageSource(source?: ImageNodeData["source"]): boolean {
  return source === "generate" || source === "agent" || source === "skill" || source === "video-frame";
}

/** 图库 = 上传图 + 生成图 + 样例/库图 */
function collectGallery(nodes: FsCanvasNode[]): GalleryItem[] {
  const out: GalleryItem[] = [];
  for (const n of nodes) {
    if (n.type === "image") {
      const d = n.data as ImageNodeData;
      const isUpload = d.source === "upload";
      const isGen = isGeneratedImageSource(d.source);
      const isLib = d.source === "library" || d.source === "moodboard";
      if (!isUpload && !isGen && !isLib) continue;
      out.push({
        id: n.id,
        nodeId: n.id,
        title: d.title || "未命名图像",
        source: isUpload ? "upload" : isLib ? "library" : "generate",
        colors: d.colors?.length ? d.colors : ["#E8E4DC", "#C9B8A0", "#5C5346"],
        src: d.src,
        subtitle: isUpload ? "上传" : isLib ? "样例" : "生成",
      });
    }
    if (n.type === "imagegen") {
      const d = n.data as ImageGenNodeData;
      if (d.status === "done" && d.results?.length) {
        d.results.forEach((r, i) => {
          out.push({
            id: `${n.id}-${r.id || i}`,
            nodeId: n.id,
            title: r.title || d.prompt || "生成图",
            source: "generate",
            colors: r.colors?.length ? r.colors : ["#EDE9FE", "#C4B5FD", "#7C3AED"],
            src: r.src,
            subtitle: d.results!.length > 1 ? `生成 · ${i + 1}/${d.results!.length}` : "生成 · 完成",
          });
        });
      } else {
        out.push({
          id: n.id,
          nodeId: n.id,
          title: (d.resultTitle || d.prompt)?.trim() || "图片生成",
          source: "generate",
          colors: d.resultColors?.length ? d.resultColors : ["#EDE9FE", "#C4B5FD", "#7C3AED"],
          subtitle:
            d.status === "done"
              ? "生成 · 完成"
              : d.status === "running" || d.status === "queued"
                ? "生成中"
                : "生成 · 待跑",
        });
      }
    }
    if (n.type === "videogen") {
      const d = n.data as VideoGenNodeData;
      out.push({
        id: n.id,
        nodeId: n.id,
        title: (d.resultTitle || d.prompt)?.trim() || "视频生成",
        source: "generate",
        colors: d.resultColors?.length ? d.resultColors : ["#ECFDF5", "#6EE7B7", "#059669"],
        subtitle:
          d.status === "done"
            ? "视频 · 完成"
            : d.status === "running" || d.status === "queued"
              ? "视频生成中"
              : "视频 · 待跑",
      });
    }
  }
  return out;
}

type Props = {
  section: LibContentSection;
  nodes?: FsCanvasNode[];
  selectedIds?: string[];
  projectId?: string;
  projectName?: string;
  onSelectNode?: (id: string) => void;
  onAddImage: (item: {
    title: string;
    tags: string[];
    colors: string[];
    source: "library" | "upload" | "agent" | "generate";
    src?: string;
  }) => void;
  onAddProduct?: (item: {
    title: string;
    tags: string[];
    brand?: string;
    price?: number;
    colors?: string[];
    src?: string;
  }) => void;
  onAddProductToStyleBoard?: (item: {
    title: string;
    tags: string[];
    brand?: string;
    price?: number;
    colors?: string[];
    src?: string;
    productId?: string;
    material?: string;
    asMaterial?: boolean;
  }) => void;
  onPlaceStylePin?: (pin: StylePin) => void;
  onPlaceStyleBoard?: (board: StyleBoard) => void;
  onPickSkill: (skill: CanvasSkillDef) => void;
  onUpload?: () => void;
  onAddImageGen?: (model?: string) => void;
  onAddVideoGen?: (model?: string) => void;
};

export function LibraryBody({
  section,
  nodes = [],
  selectedIds = [],
  projectId,
  projectName,
  onSelectNode,
  onAddImage,
  onAddProduct,
  onAddProductToStyleBoard,
  onPlaceStylePin,
  onPlaceStyleBoard,
  onPickSkill,
  onUpload,
  onAddImageGen,
}: Props) {
  const [q, setQ] = useState("");
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>("all");
  const [historyTick, setHistoryTick] = useState(0);

  useEffect(() => {
    if (galleryFilter === "history") setHistoryTick((t) => t + 1);
  }, [galleryFilter]);

  // 生成落图 / 样例导入 / 清空 → 图库「历史」即时刷新
  useEffect(() => {
    const onChange = () => setHistoryTick((t) => t + 1);
    window.addEventListener(GEN_HISTORY_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(GEN_HISTORY_CHANGE_EVENT, onChange);
  }, []);

  const history = useMemo(() => {
    void historyTick;
    const list = loadGenHistory();
    if (!q.trim()) return list;
    const qq = q.trim().toLowerCase();
    return list.filter(
      (h) =>
        h.title.toLowerCase().includes(qq) ||
        (h.skillId && h.skillId.toLowerCase().includes(qq))
    );
  }, [q, historyTick]);

  const gallery = useMemo(() => {
    if (galleryFilter === "sample" || galleryFilter === "history") return [] as GalleryItem[];
    let list = collectGallery(nodes);
    if (galleryFilter === "upload") list = list.filter((i) => i.source === "upload");
    if (galleryFilter === "generate") list = list.filter((i) => i.source === "generate");
    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      list = list.filter(
        (i) => i.title.toLowerCase().includes(qq) || i.subtitle.toLowerCase().includes(qq)
      );
    }
    return list;
  }, [nodes, galleryFilter, q]);

  const samples = useMemo(() => {
    const list = listMockGallerySamples().map((s) => {
      const skill = SKILLS_BY_ID[s.skillId];
      return {
        ...s,
        title: skill?.name ?? s.skillId,
        colors: skill?.colors ?? s.colors,
      };
    });
    if (!q.trim()) return list;
    const qq = q.trim().toLowerCase();
    return list.filter(
      (s) => s.title.toLowerCase().includes(qq) || s.skillId.toLowerCase().includes(qq)
    );
  }, [q]);

  const products = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return ECO_PRODUCTS.filter(
      (p) =>
        !qq ||
        p.name.toLowerCase().includes(qq) ||
        p.brand.toLowerCase().includes(qq) ||
        p.category.toLowerCase().includes(qq) ||
        p.style.toLowerCase().includes(qq)
    );
  }, [q]);

  const searchPlaceholder =
    section === "images"
      ? "搜索上传 / 生成图…"
      : section === "ecology"
        ? "搜索产品 / 品牌 / 品类…"
        : section === "styleboards"
          ? "搜索图板…"
          : "搜索技能 / 工作流…";

  if (section === "styleboards") {
    if (!projectId) {
      return (
        <div className="py-10 text-center text-11 text-tertiary">
          请先打开项目子画布，以绑定项目图板
        </div>
      );
    }
    return (
      <StyleBoardsPanel
        projectId={projectId}
        projectName={projectName}
        onPlacePin={(pin) => onPlaceStylePin?.(pin)}
        onPlaceBoard={(board) => onPlaceStyleBoard?.(board)}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-1.5 px-0.5">
        <div className="text-11 font-semibold text-primary">
          {section === "images" && "图库"}
          {section === "ecology" && "生态库"}
          {section === "skills" && "技能库"}
        </div>
        <div className="text-10 text-tertiary">
          {section === "images" && "用户上传与 AI 生成的图像"}
          {section === "ecology" && "加入项目图板 · 或落到工作画布"}
          {section === "skills" && "AIGC 工作流 / 提示词 · 双列卡片"}
        </div>
      </div>

      <div className="mb-2 flex shrink-0 items-center gap-1.5 rounded-md border border-subtle bg-surface-1 px-2 py-1.5">
        <Search className="size-3.5 shrink-0 text-tertiary" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-11 text-primary outline-none placeholder:text-placeholder"
        />
      </div>

      {section === "images" && (
        <div className="mb-2 flex shrink-0 flex-wrap gap-1">
          {(
            [
              ["all", "全部"],
              ["upload", "上传"],
              ["generate", "生成"],
              ["sample", "样例"],
              ["history", "历史"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setGalleryFilter(id)}
              className={cn(
                "rounded-full px-2 py-0.5 text-10 font-medium transition-colors duration-150 ease-out",
                galleryFilter === id
                  ? "bg-accent-subtle text-accent-primary"
                  : "bg-surface-2 text-tertiary hover:text-secondary"
              )}
            >
              {label}
            </button>
          ))}
          {onUpload && (
            <button
              type="button"
              onClick={onUpload}
              className="ml-auto inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-10 font-medium text-secondary hover:bg-layer-transparent-hover"
              title="上传图像 ⌘⇧K"
            >
              <Upload className="size-3" />
              上传
            </button>
          )}
          {onAddImageGen && (
            <button
              type="button"
              onClick={() => onAddImageGen()}
              className="inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-10 font-medium text-secondary hover:bg-layer-transparent-hover"
              title="放置图片生成器 A"
            >
              生成
            </button>
          )}
        </div>
      )}

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-0.5 pb-2",
          section === "skills" ? "" : "space-y-1"
        )}
      >
        {section === "images" && (
          <>
            {galleryFilter === "sample" ? (
              <div className="grid grid-cols-2 gap-1.5">
                {samples.map((item) => (
                  <LibThumb
                    key={item.id}
                    title={item.title}
                    subtitle="样例 · 拖/点落图"
                    src={item.src}
                    colors={item.colors}
                    onClick={() => {
                      onAddImage({
                        title: item.title,
                        tags: ["sample", item.skillId],
                        colors: item.colors,
                        source: "library",
                        src: item.src,
                      });
                      pushGenHistory({
                        title: item.title,
                        src: item.src,
                        colors: item.colors,
                        skillId: item.skillId,
                        source: "sample",
                      });
                      setHistoryTick((t) => t + 1);
                    }}
                    dnd={{
                      title: item.title,
                      tags: ["sample", item.skillId],
                      colors: item.colors,
                      source: "library",
                      skillId: item.skillId,
                      src: item.src,
                    }}
                  />
                ))}
                {samples.length === 0 && <Empty>无样例（检查 formscape-skill-mocks）</Empty>}
              </div>
            ) : galleryFilter === "history" ? (
              <>
                <div className="mb-1.5 flex items-center justify-between px-0.5">
                  <span className="text-10 text-placeholder">{history.length} 条</span>
                  {history.length > 0 && (
                    <button
                      type="button"
                      className="text-10 text-tertiary hover:text-danger-primary"
                      onClick={() => {
                        clearGenHistory();
                        setHistoryTick((t) => t + 1);
                      }}
                    >
                      清空
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {history.map((item) => (
                    <LibThumb
                      key={item.id}
                      title={item.title}
                      subtitle={
                        item.skillId
                          ? SKILLS_BY_ID[item.skillId]?.name || item.source
                          : item.source
                      }
                      src={item.src}
                      colors={item.colors}
                      onClick={() =>
                        onAddImage({
                          title: item.title,
                          tags: ["history", item.skillId].filter(Boolean) as string[],
                          colors: item.colors,
                          source: item.source === "upload" ? "upload" : "generate",
                          src: item.src,
                        })
                      }
                      dnd={{
                        title: item.title,
                        tags: ["history", item.skillId].filter(Boolean) as string[],
                        colors: item.colors,
                        source: item.source === "upload" ? "upload" : "generate",
                        skillId: item.skillId,
                        src: item.src,
                      }}
                    />
                  ))}
                </div>
                {history.length === 0 && (
                  <Empty>
                    暂无生成历史
                    <div className="mt-1 text-10 text-placeholder">
                      一键落图 / 样例导入后会出现在这里
                    </div>
                  </Empty>
                )}
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  {gallery.map((item) => {
                    const selected = selectedIds.includes(item.nodeId);
                    return (
                      <LibThumb
                        key={item.id}
                        title={item.title}
                        subtitle={item.subtitle}
                        src={item.src}
                        colors={item.colors}
                        selected={selected}
                        onClick={() => onSelectNode?.(item.nodeId)}
                        dnd={
                          item.src
                            ? {
                                title: item.title,
                                tags: [item.source],
                                colors: item.colors,
                                source:
                                  item.source === "upload"
                                    ? "upload"
                                    : item.source === "library"
                                      ? "library"
                                      : "generate",
                                src: item.src,
                              }
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
                {gallery.length === 0 && (
                  <Empty>
                    暂无图像
                    <div className="mt-1 text-10 text-placeholder">
                      上传 / 生成后会出现在此；也可切到「样例」先体验
                    </div>
                    <button
                      type="button"
                      className="mt-2 text-10 font-medium text-accent-primary hover:underline"
                      onClick={() => setGalleryFilter("sample")}
                    >
                      查看 14 技能样例图
                    </button>
                  </Empty>
                )}
              </>
            )}
          </>
        )}

        {section === "ecology" && (
          <>
            <div className="space-y-1">
              {products.map((p) => (
                <EcoProductRow
                  key={p.id}
                  product={p}
                  onPlaceCanvas={() =>
                    onAddProduct?.({
                      title: p.name,
                      tags: [p.category, p.style].filter(Boolean),
                      brand: p.brand,
                      price: p.price,
                      colors: p.colors,
                      src: p.image,
                    })
                  }
                  onAddToBoard={() =>
                    onAddProductToStyleBoard?.({
                      title: p.name,
                      tags: [p.category, p.style, p.material].filter(Boolean),
                      brand: p.brand,
                      price: p.price,
                      colors: p.colors,
                      src: p.image,
                      productId: p.id,
                      material: p.material,
                      asMaterial: /材质|板|砖|木|石|漆|布|面料/i.test(
                        `${p.category} ${p.material}`
                      ),
                    })
                  }
                />
              ))}
            </div>
            {products.length === 0 && <Empty>无匹配产品</Empty>}
          </>
        )}

        {section === "skills" && (
          <SkillsLibraryGrid query={q} onPickSkill={onPickSkill} />
        )}
      </div>
    </div>
  );
}

function EcoProductRow({
  product,
  onPlaceCanvas,
  onAddToBoard,
}: {
  product: EcoProduct;
  onPlaceCanvas: () => void;
  onAddToBoard: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div className="flex gap-2 rounded-md border border-subtle px-2 py-2 hover:border-accent-primary/50">
      <button type="button" onClick={onPlaceCanvas} className="shrink-0" title="落到画布">
        {product.image && !imgFailed ? (
          <img
            src={product.image}
            alt=""
            className="size-10 rounded-md object-cover"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className="size-10 rounded-md"
            style={{ background: ecoFallbackGradient(product.id) }}
          />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onPlaceCanvas} className="w-full text-left">
          <div className="truncate text-11 font-medium text-primary">{product.name}</div>
          <div className="truncate text-10 text-tertiary">
            {product.brand}
            {product.category ? ` · ${product.category}` : ""}
          </div>
        </button>
        {typeof product.price === "number" && (
          <div className="text-10 font-medium text-accent-primary">
            ¥{product.price.toLocaleString()}
          </div>
        )}
        <div className="mt-1 flex gap-1">
          <button
            type="button"
            onClick={onAddToBoard}
            className="rounded px-1.5 py-0.5 text-10 font-medium text-accent-primary hover:bg-accent-subtle"
          >
            加入图板
          </button>
          <button
            type="button"
            onClick={onPlaceCanvas}
            className="rounded px-1.5 py-0.5 text-10 text-tertiary hover:bg-layer-transparent-hover hover:text-secondary"
          >
            落画布
          </button>
        </div>
      </div>
    </div>
  );
}

function LibThumb({
  title,
  subtitle,
  src,
  colors,
  selected,
  onClick,
  dnd,
}: {
  title: string;
  subtitle: string;
  src?: string;
  colors: string[];
  selected?: boolean;
  onClick: () => void;
  dnd?: {
    title: string;
    tags: string[];
    colors: string[];
    source: "library" | "upload" | "agent" | "generate";
    skillId?: string;
    src?: string;
  };
}) {
  return (
    <button
      type="button"
      title={`${title} · 拖到画布或点击`}
      draggable={!!dnd}
      onDragStart={(e) => {
        if (!dnd) return;
        e.dataTransfer.setData(CANVAS_DND_MIME, encodeDndPayload(dnd));
        e.dataTransfer.setData("text/plain", encodeDndPayload(dnd));
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={onClick}
      className={cn(
        "overflow-hidden rounded-md border text-left transition-colors",
        selected
          ? "border-accent-primary ring-1 ring-accent-primary/30"
          : "border-subtle hover:border-accent-primary"
      )}
    >
      {src ? (
        <img src={src} alt="" className="h-14 w-full object-cover" loading="lazy" draggable={false} />
      ) : (
        <div
          className="h-14"
          style={{ background: `linear-gradient(135deg, ${colors.join(",")})` }}
        />
      )}
      <div className="px-1.5 py-1">
        <div className="truncate text-10 font-medium text-primary">{title}</div>
        <div className="text-10 text-tertiary">{subtitle}</div>
      </div>
    </button>
  );
}

function Empty({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("py-8 text-center text-11 text-tertiary", className)}>{children}</div>;
}

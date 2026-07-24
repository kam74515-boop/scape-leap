/**
 * 画布 L2 库内容
 * - 图库：用户上传图 + AI 生成图（来自当前画布节点）
 * - 生态库：产品库管理（单品等，落点到画布）
 * - 技能库：封装的 AIGC 工作流 / 提示词
 */
import { useMemo, useState, type ReactNode } from "react";
import { Image as ImageIcon, Package, Search, Sparkles, Upload } from "@/icons";
import { cn } from "@plane/utils";
import {
  ECO_PRODUCTS,
  ecoFallbackGradient,
  type EcoProduct,
} from "../../ecology-mock";
import type { CanvasSkillDef } from "../skills/registry";
import type { LibSection } from "../canvas-library-context";
import type { FsCanvasNode } from "../use-canvas-document";
import type { ImageGenNodeData, ImageNodeData, VideoGenNodeData } from "../types";
import { SkillsLibraryGrid } from "./skills-library-grid";

export type LibContentSection = Exclude<LibSection, "boards">;

/** L2 顶栏：图库 · 生态库 · 技能库（画布树另挂在 boards） */
export const LIB_CONTENT_TABS: {
  id: LibContentSection;
  label: string;
  icon: typeof ImageIcon;
  hint: string;
}[] = [
  { id: "images", label: "图库", icon: ImageIcon, hint: "上传与生成" },
  { id: "ecology", label: "生态库", icon: Package, hint: "产品库" },
  { id: "skills", label: "技能库", icon: Sparkles, hint: "AIGC 工作流" },
];

/** @deprecated 用 LIB_CONTENT_TABS */
export const LIB_TABS_NORMAL = LIB_CONTENT_TABS.filter((t) => t.id === "images");
/** @deprecated 用 LIB_CONTENT_TABS */
export const LIB_TABS_NODE = LIB_CONTENT_TABS.filter((t) => t.id === "skills" || t.id === "ecology");
export const LIB_TABS = LIB_CONTENT_TABS;

type GalleryFilter = "all" | "upload" | "generate";

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

/** 图库 = 上传图 + 生成图（不含生态/纯灵感 library 落点） */
function collectGallery(nodes: FsCanvasNode[]): GalleryItem[] {
  const out: GalleryItem[] = [];
  for (const n of nodes) {
    if (n.type === "image") {
      const d = n.data as ImageNodeData;
      const isUpload = d.source === "upload";
      const isGen = isGeneratedImageSource(d.source);
      if (!isUpload && !isGen) continue;
      out.push({
        id: n.id,
        nodeId: n.id,
        title: d.title || "未命名图像",
        source: isUpload ? "upload" : "generate",
        colors: d.colors?.length ? d.colors : ["#E8E4DC", "#C9B8A0", "#5C5346"],
        src: d.src,
        subtitle: isUpload ? "上传" : "生成",
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
  onPickSkill: (skill: CanvasSkillDef) => void;
  onUpload?: () => void;
  onAddImageGen?: (model?: string) => void;
  onAddVideoGen?: (model?: string) => void;
};

export function LibraryBody({
  section,
  nodes = [],
  selectedIds = [],
  onSelectNode,
  onAddProduct,
  onPickSkill,
  onUpload,
  onAddImageGen,
}: Props) {
  const [q, setQ] = useState("");
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>("all");

  const gallery = useMemo(() => {
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
        : "搜索技能 / 工作流…";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-1.5 px-0.5">
        <div className="text-11 font-semibold text-primary">
          {section === "images" && "图库"}
          {section === "ecology" && "生态库"}
          {section === "skills" && "技能库"}
        </div>
        <div className="text-[10px] text-tertiary">
          {section === "images" && "用户上传与 AI 生成的图像"}
          {section === "ecology" && "产品库管理 · 点击落点到画布"}
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
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setGalleryFilter(id)}
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
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
              className="ml-auto inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[10px] font-medium text-secondary hover:bg-layer-transparent-hover"
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
              className="inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[10px] font-medium text-secondary hover:bg-layer-transparent-hover"
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
            <div className="grid grid-cols-2 gap-1.5">
              {gallery.map((item) => {
                const selected = selectedIds.includes(item.nodeId);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectNode?.(item.nodeId)}
                    className={cn(
                      "overflow-hidden rounded-md border text-left transition-colors",
                      selected
                        ? "border-accent-primary ring-1 ring-accent-primary/30"
                        : "border-subtle hover:border-accent-primary"
                    )}
                  >
                    {item.src ? (
                      <img src={item.src} alt="" className="h-14 w-full object-cover" loading="lazy" />
                    ) : (
                      <div
                        className="h-14"
                        style={{ background: `linear-gradient(135deg, ${item.colors.join(",")})` }}
                      />
                    )}
                    <div className="px-1.5 py-1">
                      <div className="truncate text-[10px] font-medium text-primary">{item.title}</div>
                      <div className="text-[9px] text-tertiary">{item.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {gallery.length === 0 && (
              <Empty>
                暂无图像
                <div className="mt-1 text-[10px] text-placeholder">
                  上传图片或用 A 生成后，会出现在图库
                </div>
              </Empty>
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
                  onAdd={() =>
                    onAddProduct?.({
                      title: p.name,
                      tags: [p.category, p.style].filter(Boolean),
                      brand: p.brand,
                      price: p.price,
                      colors: p.colors,
                      src: p.image,
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

function EcoProductRow({ product, onAdd }: { product: EcoProduct; onAdd: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex w-full gap-2 rounded-md border border-subtle px-2 py-2 text-left hover:border-accent-primary hover:bg-layer-transparent-hover"
    >
      {product.image && !imgFailed ? (
        <img
          src={product.image}
          alt=""
          className="size-10 shrink-0 rounded-md object-cover"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div
          className="size-10 shrink-0 rounded-md"
          style={{ background: ecoFallbackGradient(product.id) }}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-11 font-medium text-primary">{product.name}</div>
        <div className="truncate text-[10px] text-tertiary">
          {product.brand}
          {product.category ? ` · ${product.category}` : ""}
        </div>
        {typeof product.price === "number" && (
          <div className="text-[10px] font-medium text-accent-primary">
            ¥{product.price.toLocaleString()}
          </div>
        )}
      </div>
    </button>
  );
}

function Empty({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("py-8 text-center text-11 text-tertiary", className)}>{children}</div>;
}

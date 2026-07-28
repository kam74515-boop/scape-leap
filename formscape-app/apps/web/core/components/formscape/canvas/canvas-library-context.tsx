/**
 * 画布 L2 库桥
 * 顶栏分区：画布 | 图板 | 图库 | 生态库 | 技能库
 * - 图板：项目风格图板（生态选品/材质/参考/镜头）
 * - 图库：用户上传图 + 生成图（来自画布节点）
 * - 生态库：产品库（加入图板 / 落点画布）
 * - 技能库：封装的 AIGC 工作流 / 提示词
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_VIEW_MODE, isNodeViewMode, type CanvasViewMode } from "./canvas-mode";
import type { CanvasSkillDef } from "./skills/registry";
import type { FsCanvasNode } from "./use-canvas-document";

/** L2 画布顶栏分区 */
export type LibSection = "boards" | "styleboards" | "images" | "ecology" | "skills";

export type CanvasLibraryBridge = {
  nodes: FsCanvasNode[];
  selectedIds: string[];
  /** 当前画布绑定的项目 id（图板归属） */
  projectId?: string;
  projectName?: string;
  onSelectNode: (id: string) => void;
  /** 图库/灵感类落点（保留兼容） */
  onAddImage: (item: {
    title: string;
    tags: string[];
    colors: string[];
    source: "library" | "upload" | "agent" | "generate";
    src?: string;
  }) => void;
  /** 生态库产品落点到画布 */
  onAddProduct: (item: {
    title: string;
    tags: string[];
    brand?: string;
    price?: number;
    colors?: string[];
    src?: string;
  }) => void;
  /** 生态库产品加入项目图板 */
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
  /** 图板 pin 落到画布 */
  onPlaceStylePin?: (pin: {
    id: string;
    kind: string;
    title: string;
    src?: string;
    colors?: string[];
    tags?: string[];
  }) => void;
  /** 整板 pin 落到画布 */
  onPlaceStyleBoard?: (board: {
    id: string;
    name: string;
    pins: Array<{
      id: string;
      kind: string;
      title: string;
      src?: string;
      colors?: string[];
      tags?: string[];
    }>;
  }) => void;
  onPickSkill: (skill: CanvasSkillDef) => void;
  onAddImageGen: (model?: string) => void;
  onAddVideoGen: (model?: string) => void;
  /** 触发画布上传 */
  onUpload?: () => void;
};

type Ctx = {
  section: LibSection;
  setSection: (s: LibSection) => void;
  canvasActive: boolean;
  bridge: CanvasLibraryBridge | null;
  registerBridge: (b: CanvasLibraryBridge | null) => void;
  openSection: (s: LibSection) => void;
  viewMode: CanvasViewMode;
  setViewMode: (m: CanvasViewMode) => void;
  isNodeMode: boolean;
};

const CanvasLibraryContext = createContext<Ctx | null>(null);

export function CanvasLibraryProvider({ children }: { children: ReactNode }) {
  const [section, setSection] = useState<LibSection>("boards");
  const [canvasActive, setCanvasActive] = useState(false);
  const [bridge, setBridge] = useState<CanvasLibraryBridge | null>(null);
  const [viewMode, setViewModeState] = useState<CanvasViewMode>(DEFAULT_VIEW_MODE);
  const bridgeRef = useRef<CanvasLibraryBridge | null>(null);

  const registerBridge = useCallback((b: CanvasLibraryBridge | null) => {
    bridgeRef.current = b;
    setBridge(b);
    setCanvasActive(!!b);
  }, []);

  const openSection = useCallback((s: LibSection) => {
    setSection(s);
  }, []);

  const setViewMode = useCallback((m: CanvasViewMode) => {
    setViewModeState(m);
  }, []);

  const isNodeMode = isNodeViewMode(viewMode);

  const value = useMemo(
    () => ({
      section,
      setSection,
      canvasActive,
      bridge,
      registerBridge,
      openSection,
      viewMode,
      setViewMode,
      isNodeMode,
    }),
    [section, canvasActive, bridge, registerBridge, openSection, viewMode, setViewMode, isNodeMode]
  );

  return <CanvasLibraryContext.Provider value={value}>{children}</CanvasLibraryContext.Provider>;
}

export function useCanvasLibrary() {
  const ctx = useContext(CanvasLibraryContext);
  if (!ctx) throw new Error("useCanvasLibrary must be used within CanvasLibraryProvider");
  return ctx;
}

/** 非画布页可安全调用 */
export function useCanvasLibraryOptional() {
  return useContext(CanvasLibraryContext);
}

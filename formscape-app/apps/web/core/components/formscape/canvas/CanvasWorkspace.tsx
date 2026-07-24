import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useNodesState,
  useReactFlow,
  type OnSelectionChangeParams,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { cn } from "@plane/utils";
import type { FormscapeProject } from "../types";
import { useFormscapeAi } from "../ai-context";
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useCanvasLibrary } from "./canvas-library-context";
import { NODE_MODE_ONLY_TYPES } from "./canvas-mode";
import { CanvasNodeActionsProvider } from "./canvas-node-actions";
import { CANVAS_SHORTCUTS, isEditableTarget, isMod } from "./canvas-shortcuts";
import { SHAPE_FILLS, STICKY_COLORS } from "./constants";
import { canvasNodeTypes } from "./nodes";
import { CanvasContextMenu, type ContextMenuState } from "./panels/context-menu";
import "./canvas-shell.css";
import { MaskEditOverlay, type MaskEditTarget } from "./panels/mask-edit-overlay";
import { SettingsModal } from "./panels/settings-modal";
import { SkillRail } from "./panels/skill-rail";
import type { CanvasSkillDef } from "./skills/registry";
import { SKILLS_BY_ID } from "./skills/registry";
import { CanvasToolbar } from "./toolbar/canvas-toolbar";
import { SelectionToolbar, type AlignMode } from "./toolbar/selection-toolbar";
import { ZoomControls } from "./toolbar/zoom-controls";
import type {
  CanvasTool,
  ImageGenNodeData,
  ImageNodeData,
  ShapeKind,
  VideoGenNodeData,
} from "./types";
import { buildDemoImageResults } from "./gen-demo";
import { sizeForAspect } from "./models/catalog";
import {
  CANVAS_DND_MIME,
  decodeDndPayload,
  pushGenHistoryMany,
} from "./skills/gen-history";
import { listMockGallerySamples } from "./skills/mock-skill-assets";
import { newId, useCanvasDocument, type FsCanvasNode } from "./use-canvas-document";

const DEFAULT_IMAGE_GEN = {
  kind: "imagegen" as const,
  prompt: "",
  status: "idle" as const,
  model: "formscape-style",
  aspect: "1:1",
  count: 1,
  quality: "standard" as const,
  refs: [] as ImageGenNodeData["refs"],
  selectedResultIndex: 0,
};

const DEFAULT_VIDEO_GEN = {
  kind: "videogen" as const,
  prompt: "",
  status: "idle" as const,
  model: "formscape-motion",
  aspect: "16:9",
  duration: 6,
  videoMode: "text" as const,
  withAudio: false,
  cameraMove: "push-in",
  refs: [] as VideoGenNodeData["refs"],
};

type Props = { project: FormscapeProject };

function bgVariant(pattern: string): BackgroundVariant | null {
  if (pattern === "none") return null;
  if (pattern === "lines") return BackgroundVariant.Lines;
  if (pattern === "cross") return BackgroundVariant.Cross;
  return BackgroundVariant.Dots;
}

function CanvasInner({ project }: Props) {
  const { registerCanvasBridge, setOpen: setAiOpen } = useFormscapeAi();
  const { registerBridge, openSection, section: libSection, isNodeMode } = useCanvasLibrary();
  const { sidebarCollapsed, toggleSidebar } = useAppTheme();
  const {
    nodes: initialNodes,
    viewport: savedViewport,
    setViewport,
    settings,
    setSettings,
    resetToMoodboard,
  } = useCanvasDocument(project);

  const [nodes, setNodes, onNodesChange] = useNodesState<FsCanvasNode>(initialNodes);
  /** 节点模式专属类型（当前为空）；生成器在普通模式始终展示 */
  const displayNodes = useMemo(
    () =>
      NODE_MODE_ONLY_TYPES.size === 0 || isNodeMode
        ? nodes
        : nodes.filter((n) => !NODE_MODE_ONLY_TYPES.has(n.type ?? "")),
    [nodes, isNodeMode]
  );
  const [tool, setTool] = useState<CanvasTool>("select");
  const [activeSkill, setActiveSkill] = useState<CanvasSkillDef | null>(null);
  const [skillBusy, setSkillBusy] = useState(false);
  /** 画布操作条提示（交互反馈，非真 API） */
  const [canvasToast, setCanvasToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showCanvasToast = useCallback((msg: string, ms = 2200) => {
    setCanvasToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setCanvasToast(null), ms);
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [spacePan, setSpacePan] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<FsCanvasNode[][]>([]);
  const [future, setFuture] = useState<FsCanvasNode[][]>([]);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState>(null);
  const [maskEdit, setMaskEdit] = useState<MaskEditTarget | null>(null);
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rect");
  const skipHistory = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const clipboard = useRef<FsCanvasNode[]>([]);
  /** Lovspark：A / + 武装后，下一次点画布才落生成节点 */
  const pendingGenRef = useRef<{
    media: "image" | "video";
    model?: string;
    prompt?: string;
    skillId?: string;
  } | null>(null);
  /** 视口刚平移/缩放：吞掉同手势触发的下一次 pane click */
  const suppressPlaceClick = useRef(false);
  const suppressPlaceTimer = useRef<number | null>(null);
  /** Space 临时平移（与 state 同步，供 keyup/blur 安全清理） */
  const spacePanRef = useRef(false);

  const { fitView, zoomIn, zoomOut, setViewport: setRfViewport, screenToFlowPosition, getViewport } =
    useReactFlow();

  // 仅在切换项目时重载图；禁止依赖 initialNodes/savedViewport，
  // 否则平移缩放写 viewport 会把节点打回旧快照 → 一点就闪掉
  const loadedProjectId = useRef<string | null>(null);
  useEffect(() => {
    if (loadedProjectId.current === project.id) return;
    loadedProjectId.current = project.id;
    skipHistory.current = true;
    setNodes(initialNodes);
    setHistory([]);
    setFuture([]);
    if (savedViewport) {
      void setRfViewport(savedViewport);
      setZoom(savedViewport.zoom);
    } else {
      requestAnimationFrame(() => fitView({ padding: 0.2 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只跟 project.id 走
  }, [project.id]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const doc = {
          version: 1 as const,
          projectId: project.id,
          nodes: nodes.map((n) => ({
            id: n.id,
            type: (n.type ?? "image") as FsCanvasNode["type"],
            position: n.position,
            data: n.data,
            width: typeof n.style?.width === "number" ? n.style.width : undefined,
            height: typeof n.style?.height === "number" ? n.style.height : undefined,
            parentId: n.parentId,
          })),
          edges: [] as { id: string; source: string; target: string }[],
          viewport: getViewport(),
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem("formscape.canvas.doc.v2", JSON.stringify(doc));
        localStorage.setItem("formscape.canvas.doc.v1", JSON.stringify(doc));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [nodes, project.id, getViewport]);

  const pushHistory = useCallback(() => {
    if (skipHistory.current) {
      skipHistory.current = false;
      return;
    }
    setHistory((h) => [...h.slice(-40), nodes]);
    setFuture([]);
  }, [nodes]);

  const applyNodes = useCallback(
    (updater: (prev: FsCanvasNode[]) => FsCanvasNode[]) => {
      pushHistory();
      setNodes(updater);
    },
    [pushHistory, setNodes]
  );

  const onSelectionChange = useCallback(({ nodes: sel }: OnSelectionChangeParams) => {
    setSelectedIds(sel.map((n) => n.id));
  }, []);

  const onMoveEnd = useCallback(
    (_: unknown, vp: Viewport) => {
      setZoom(vp.zoom);
      setViewport(vp);
    },
    [setViewport]
  );

  const centerPosition = useCallback(() => {
    const el = document.querySelector(".fs-canvas-flow") as HTMLElement | null;
    if (!el) return { x: 200, y: 160 };
    const r = el.getBoundingClientRect();
    return screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }, [screenToFlowPosition]);

  const addNode = useCallback(
    (
      partial: Omit<FsCanvasNode, "id"> & { id?: string },
      opts?: { keepTool?: boolean }
    ) => {
      const id = partial.id ?? newId(partial.type ?? "n");
      const pos = partial.position ?? centerPosition();
      const node = { ...partial, id, position: pos, selected: true } as FsCanvasNode;
      applyNodes((prev) => [...prev.map((n) => ({ ...n, selected: false })), node] as FsCanvasNode[]);
      setSelectedIds([id]);
      // keepTool=true：放置类工具粘滞（Lovspark stickyKeys）；否则回选择
      if (!opts?.keepTool) setTool("select");
      return id;
    },
    [applyNodes, centerPosition]
  );

  const addImageAt = useCallback(
    (
      item: {
        title: string;
        tags: string[];
        colors: string[];
        source?: ImageNodeData["source"];
        skillId?: string;
        src?: string;
      },
      position?: { x: number; y: number }
    ) => {
      addNode({
        type: "image",
        position: position ?? centerPosition(),
        data: {
          kind: "image",
          title: item.title,
          tags: item.tags,
          colors: item.colors,
          source: item.source ?? "library",
          skillId: item.skillId,
          src: item.src,
        },
        style: { width: 208, height: 168 },
      });
    },
    [addNode, centerPosition]
  );

  const addImageAtRef = useRef(addImageAt);
  addImageAtRef.current = addImageAt;

  /** 生成器结果 → 图片节点（一键落图） */
  const promoteImageGenResults = useCallback(
    (
      genNode: FsCanvasNode,
      opts?: { mode?: "selected" | "all"; resultIndex?: number; removeGen?: boolean }
    ): string[] => {
      const d = genNode.data as ImageGenNodeData;
      const all = d.results?.length
        ? d.results
        : [
            {
              id: newId("res"),
              title: d.resultTitle || d.prompt || "生成图",
              colors: d.resultColors || ["#EDE6D9", "#C4A574", "#6B5B4F"],
            },
          ];
      const mode = opts?.mode ?? "all";
      const idx = opts?.resultIndex ?? d.selectedResultIndex ?? 0;
      const picked = mode === "all" ? all : [all[Math.min(idx, all.length - 1)] ?? all[0]];
      const dim = sizeForAspect(d.aspect || "1:1", 200);
      const nodeW = Number(genNode.style?.width) || dim.width;
      // 一键落图：结果直接叠在生成器位置（移除生成器时不偏移）
      // 多结果：水平并排对比（不折行）
      const removeGen = opts?.removeGen ?? d.removeAfterPromote ?? !!d.autoPromoteOnDone;
      const base = removeGen
        ? { x: genNode.position.x, y: genNode.position.y }
        : { x: genNode.position.x + nodeW + 40, y: genNode.position.y };
      const gap = 20;
      const addedIds: string[] = [];

      applyNodes((prev) => {
        let next = prev.map((n) => ({ ...n, selected: false }));
        if (removeGen) next = next.filter((n) => n.id !== genNode.id);
        const added: FsCanvasNode[] = picked.map((r, i) => {
          const id = newId("img");
          addedIds.push(id);
          return {
            id,
            type: "image",
            position: {
              x: base.x + i * (dim.width + gap),
              y: base.y,
            },
            selected: true,
            data: {
              kind: "image" as const,
              title: r.title,
              tags: ["generate", d.model, d.skillId, d.aspect].filter(Boolean) as string[],
              colors: r.colors,
              source: "generate" as const,
              skillId: d.skillId,
              src: r.src,
            },
            style: { width: dim.width, height: dim.height },
          };
        });
        return [...next, ...added] as FsCanvasNode[];
      });
      if (addedIds.length) setSelectedIds(addedIds);
      // 写入生成历史（图库「历史」）
      pushGenHistoryMany(
        picked.map((r) => ({
          title: r.title,
          src: r.src,
          colors: r.colors,
          skillId: d.skillId,
          source: "generate" as const,
        }))
      );
      return addedIds;
    },
    [applyNodes]
  );

  const promoteImageGenResultsRef = useRef(promoteImageGenResults);
  promoteImageGenResultsRef.current = promoteImageGenResults;

  /** Lovspark：A / + 只「武装」工具，下一次点画布才落节点（普通模式可用） */
  const armImageGen = useCallback(
    (promptOrModel?: string, modelArg?: string, skillId?: string) => {
      let prompt: string | undefined;
      let model: string | undefined;
      if (promptOrModel && !modelArg && !skillId) {
        if (
          ["formscape-style", "structure-safe", "fast-draft", "flux-pro", "render-hd"].includes(promptOrModel)
        ) {
          model = promptOrModel;
        } else {
          prompt = promptOrModel;
        }
      } else {
        if (promptOrModel) prompt = promptOrModel;
        if (modelArg) model = modelArg;
      }
      pendingGenRef.current = { media: "image", model, prompt, skillId };
      setTool("imagegen");
    },
    []
  );

  const armVideoGen = useCallback((promptOrModel?: string, modelArg?: string) => {
    let prompt: string | undefined;
    let model: string | undefined;
    if (promptOrModel && !modelArg) {
      if (["formscape-motion", "storyboard-clip", "walkthrough"].includes(promptOrModel)) {
        model = promptOrModel;
      } else {
        prompt = promptOrModel;
      }
    } else {
      if (promptOrModel) prompt = promptOrModel;
      if (modelArg) model = modelArg;
    }
    pendingGenRef.current = { media: "video", model, prompt };
    setTool("videogen");
  }, []);

  /** 技能/右键等：已知坐标时直接落点（非 A 工具流） */
  const placeImageGenAt = useCallback(
    (
      position: { x: number; y: number },
      opts?: {
        model?: string;
        prompt?: string;
        skillId?: string;
        aspect?: string;
        count?: number;
        refs?: ImageGenNodeData["refs"];
        autoPromoteOnDone?: boolean;
        removeAfterPromote?: boolean;
      }
    ) => {
      const skill = opts?.skillId ? SKILLS_BY_ID[opts.skillId] : undefined;
      const aspect = opts?.aspect ?? skill?.defaultAspect ?? DEFAULT_IMAGE_GEN.aspect;
      const dim = sizeForAspect(aspect, 240);
      return addNode({
        type: "imagegen",
        position,
        data: {
          ...DEFAULT_IMAGE_GEN,
          prompt: opts?.prompt ?? skill?.name ?? DEFAULT_IMAGE_GEN.prompt,
          model: opts?.model ?? skill?.model ?? DEFAULT_IMAGE_GEN.model,
          skillId: opts?.skillId,
          aspect,
          count: opts?.count ?? skill?.defaultCount ?? DEFAULT_IMAGE_GEN.count,
          refs: opts?.refs ?? [],
          resultColors: skill?.colors,
          autoPromoteOnDone: opts?.autoPromoteOnDone,
          removeAfterPromote: opts?.removeAfterPromote,
        },
        style: { width: dim.width, height: dim.height },
      });
    },
    [addNode]
  );

  const placeVideoGenAt = useCallback(
    (position: { x: number; y: number }, opts?: { model?: string; prompt?: string }) => {
      addNode({
        type: "videogen",
        position,
        data: {
          ...DEFAULT_VIDEO_GEN,
          prompt: opts?.prompt ?? DEFAULT_VIDEO_GEN.prompt,
          model: opts?.model ?? DEFAULT_VIDEO_GEN.model,
        },
        style: { width: 240 },
      });
    },
    [addNode]
  );

  // 兼容旧调用名（技能再生成等仍可 center 落点）
  const addImageGen = useCallback(
    (promptOrModel?: string, modelArg?: string, skillId?: string) => {
      armImageGen(promptOrModel, modelArg, skillId);
    },
    [armImageGen]
  );

  const addVideoGen = useCallback(
    (promptOrModel?: string, modelArg?: string) => {
      armVideoGen(promptOrModel, modelArg);
    },
    [armVideoGen]
  );

  /** 进行中的生成任务：jobId → 可 clear 的 timer 列表 */
  const genJobsRef = useRef<Map<string, { timers: number[]; jobId: string }>>(new Map());

  const cancelImageGen = useCallback(
    (id: string) => {
      const job = genJobsRef.current.get(id);
      if (job) {
        job.timers.forEach((t) => window.clearTimeout(t));
        job.timers.forEach((t) => window.clearInterval(t));
        genJobsRef.current.delete(id);
      }
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id && n.type === "imagegen"
            ? {
                ...n,
                data: {
                  ...(n.data as ImageGenNodeData),
                  status: "idle",
                  progress: 0,
                  jobId: undefined,
                  error: undefined,
                },
              }
            : n
        )
      );
    },
    [setNodes]
  );

  const runImageGen = useCallback(
    (id: string) => {
      // 先取消同节点旧任务
      const prevJob = genJobsRef.current.get(id);
      if (prevJob) {
        prevJob.timers.forEach((t) => {
          window.clearTimeout(t);
          window.clearInterval(t);
        });
        genJobsRef.current.delete(id);
      }

      const jobId = newId("job");
      const timers: number[] = [];
      genJobsRef.current.set(id, { timers, jobId });

      const stillActive = () => genJobsRef.current.get(id)?.jobId === jobId;

      let quality: "draft" | "standard" | "hd" = "standard";
      applyNodes((prev) =>
        prev.map((n) => {
          if (n.id !== id || n.type !== "imagegen") return n;
          const d = n.data as ImageGenNodeData;
          const q = d.quality;
          if (q === "draft" || q === "hd" || q === "standard") quality = q;
          const dim = sizeForAspect(d.aspect || "1:1", 240);
          return {
            ...n,
            style: { ...n.style, width: dim.width, height: dim.height },
            data: {
              ...d,
              status: "queued",
              progress: 4,
              jobId,
              error: undefined,
            },
          };
        })
      );

      timers.push(
        window.setTimeout(() => {
          if (!stillActive()) return;
          setNodes((prev) =>
            prev.map((n) =>
              n.id === id && n.type === "imagegen"
                ? {
                    ...n,
                    data: {
                      ...(n.data as ImageGenNodeData),
                      status: "running",
                      progress: 12,
                    },
                  }
                : n
            )
          );
        }, 280)
      );

      let p = 12;
      const interval = window.setInterval(() => {
        if (!stillActive()) {
          window.clearInterval(interval);
          return;
        }
        p = Math.min(94, p + 8 + Math.floor(Math.random() * 6));
        setNodes((prev) =>
          prev.map((n) =>
            n.id === id && n.type === "imagegen"
              ? { ...n, data: { ...(n.data as ImageGenNodeData), progress: p } }
              : n
          )
        );
      }, 180);
      timers.push(interval);

      // 质量越高略慢
      const delayByQuality = { draft: 1100, standard: 1700, hd: 2600 } as const;
      const delay = delayByQuality[quality] ?? 1700;

      timers.push(
        window.setTimeout(() => {
          if (!stillActive()) return;
          window.clearInterval(interval);
          let finished: FsCanvasNode | null = null;
          let shouldAutoPromote = false;
          setNodes((prev) =>
            prev.map((n) => {
              if (n.id !== id || n.type !== "imagegen") return n;
              const d = n.data as ImageGenNodeData;
              const skill = d.skillId ? SKILLS_BY_ID[d.skillId] : undefined;
              const { results, seed } = buildDemoImageResults({
                prompt: d.prompt || skill?.name || "生成图",
                count: d.count || 1,
                skillId: d.skillId,
                skillColors: skill?.colors,
              });
              const dim = sizeForAspect(d.aspect || "1:1", 240);
              const next: FsCanvasNode = {
                ...n,
                style: { ...n.style, width: dim.width, height: dim.height },
                data: {
                  ...d,
                  status: "done",
                  progress: 100,
                  jobId: undefined,
                  seed,
                  results,
                  selectedResultIndex: 0,
                  resultColors: results[0].colors,
                  resultTitle: results[0].title,
                },
              };
              finished = next;
              shouldAutoPromote = !!d.autoPromoteOnDone;
              return next;
            })
          );
          genJobsRef.current.delete(id);
          // 一键落图：生成完成后自动 promote 为图片节点
          if (shouldAutoPromote && finished) {
            window.setTimeout(() => {
              if (finished) promoteImageGenResultsRef.current(finished, { mode: "all" });
            }, 40);
          }
        }, delay)
      );
    },
    [applyNodes, setNodes]
  );

  const runVideoGen = useCallback(
    (id: string) => {
      applyNodes((prev) =>
        prev.map((n) =>
          n.id === id && n.type === "videogen"
            ? { ...n, data: { ...(n.data as VideoGenNodeData), status: "queued", progress: 4 } }
            : n
        )
      );
      window.setTimeout(() => {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === id && n.type === "videogen"
              ? { ...n, data: { ...(n.data as VideoGenNodeData), status: "running", progress: 10 } }
              : n
          )
        );
      }, 400);
      let p = 10;
      const timer = window.setInterval(() => {
        p = Math.min(90, p + 8);
        setNodes((prev) =>
          prev.map((n) =>
            n.id === id && n.type === "videogen"
              ? { ...n, data: { ...(n.data as VideoGenNodeData), progress: p } }
              : n
          )
        );
      }, 200);
      window.setTimeout(() => {
        window.clearInterval(timer);
        setNodes((prev) =>
          prev.map((n) => {
            if (n.id !== id || n.type !== "videogen") return n;
            const d = n.data as VideoGenNodeData;
            return {
              ...n,
              data: {
                ...d,
                status: "done",
                progress: 100,
                resultColors: ["#1E3A5F", "#3B82F6", "#93C5FD"],
                resultTitle: `${d.prompt.slice(0, 20) || "空间视频"} · ${d.duration}s`,
              },
            };
          })
        );
      }, 2400);
    },
    [applyNodes, setNodes]
  );

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const addImageAtPromoteRef = useRef(addImageAt);
  addImageAtPromoteRef.current = addImageAt;
  const applyNodesRef = useRef(applyNodes);
  applyNodesRef.current = applyNodes;

  useEffect(() => {
    const onGenerate = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string; media?: string } | string>).detail;
      const id = typeof detail === "string" ? detail : detail?.id;
      const media = typeof detail === "string" ? "image" : detail?.media ?? "image";
      if (!id) return;
      if (media === "video") runVideoGen(id);
      else runImageGen(id);
    };
    const onCancel = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string; media?: string }>).detail;
      if (!detail?.id) return;
      if (detail.media === "video") {
        // 视频任务简化：直接 idle
        setNodes((prev) =>
          prev.map((n) =>
            n.id === detail.id && n.type === "videogen"
              ? {
                  ...n,
                  data: { ...(n.data as VideoGenNodeData), status: "idle", progress: 0 },
                }
              : n
          )
        );
        return;
      }
      cancelImageGen(detail.id);
    };
    const onPromote = (e: Event) => {
      const detail = (e as CustomEvent<{
        id: string;
        media?: string;
        mode?: "selected" | "all";
        resultIndex?: number;
      }>).detail;
      if (!detail?.id) return;
      const src = nodesRef.current.find((n) => n.id === detail.id);
      if (!src) return;
      if (src.type === "imagegen") {
        promoteImageGenResultsRef.current(src, {
          mode: detail.mode ?? "selected",
          resultIndex: detail.resultIndex,
          removeGen: false,
        });
      } else if (src.type === "videogen") {
        const d = src.data as VideoGenNodeData;
        addImageAtPromoteRef.current(
          {
            title: d.resultTitle || "视频封面帧",
            tags: ["video-frame", d.model, `${d.duration}s`],
            colors: d.resultColors || ["#1E3A5F", "#3B82F6", "#93C5FD"],
            source: "video-frame",
          },
          { x: src.position.x + 300, y: src.position.y }
        );
      }
    };
    window.addEventListener("fs-canvas-generate", onGenerate);
    window.addEventListener("fs-canvas-cancel", onCancel);
    window.addEventListener("fs-canvas-promote", onPromote);
    return () => {
      window.removeEventListener("fs-canvas-generate", onGenerate);
      window.removeEventListener("fs-canvas-cancel", onCancel);
      window.removeEventListener("fs-canvas-promote", onPromote);
    };
  }, [runImageGen, runVideoGen, cancelImageGen, setNodes]);

  const isPanMode = tool === "pan" || spacePan;
  const isPlaceTool =
    tool === "sticky" ||
    tool === "text" ||
    tool === "frame" ||
    tool === "shape" ||
    tool === "comment" ||
    tool === "imagegen" ||
    tool === "videogen";

  const placeFromClick = useCallback(
    (event: ReactMouseEvent) => {
      if (!isPlaceTool || isPanMode) return;
      const raw = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const keepTool = CANVAS_SHORTCUTS.stickyKeys;

      // Lovspark：A / ⌘E 武装后，点击落生成节点，然后回选择
      if (tool === "imagegen") {
        const pend = pendingGenRef.current;
        pendingGenRef.current = null;
        placeImageGenAt(
          { x: raw.x - 120, y: raw.y - 120 },
          {
            model: pend?.model,
            prompt: pend?.prompt,
            skillId: pend?.skillId,
          }
        );
        return;
      }
      if (tool === "videogen") {
        const pend = pendingGenRef.current;
        pendingGenRef.current = null;
        placeVideoGenAt(
          { x: raw.x - 120, y: raw.y - 120 },
          { model: pend?.model, prompt: pend?.prompt }
        );
        return;
      }

      const position = raw;

      if (tool === "sticky") {
        addNode(
          {
            type: "sticky",
            position,
            data: {
              kind: "sticky",
              text: "新便签",
              color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)],
            },
            style: { width: 180, height: 140 },
          },
          { keepTool }
        );
        return;
      }
      if (tool === "text") {
        addNode(
          {
            type: "text",
            position,
            data: { kind: "text", text: "标题文字", fontSize: 18 },
            style: { width: 160, height: 40 },
          },
          { keepTool }
        );
        return;
      }
      if (tool === "frame") {
        addNode(
          {
            type: "frame",
            position,
            data: { kind: "frame", label: "画板", tint: "rgba(139,92,246,0.04)" },
            style: { width: 360, height: 240 },
            zIndex: -1,
          },
          { keepTool }
        );
        return;
      }
      if (tool === "shape") {
        addNode(
          {
            type: "shape",
            position,
            data: {
              kind: "shape",
              shape: shapeKind,
              fill: SHAPE_FILLS[Math.floor(Math.random() * SHAPE_FILLS.length)],
              stroke: "#6366F1",
            },
            style: { width: 120, height: 80 },
          },
          { keepTool }
        );
        return;
      }
      if (tool === "comment") {
        addNode(
          {
            type: "comment",
            position,
            data: { kind: "comment", text: "新评论", author: "我" },
          },
          { keepTool }
        );
      }
    },
    [
      tool,
      shapeKind,
      screenToFlowPosition,
      addNode,
      isPlaceTool,
      isPanMode,
      placeImageGenAt,
      placeVideoGenAt,
    ]
  );

  /** Lovspark F：在视口中心立即创建 Frame */
  const spawnFrameAtCenter = useCallback(() => {
    const position = centerPosition();
    addNode({
      type: "frame",
      position: { x: position.x - 180, y: position.y - 120 },
      data: { kind: "frame", label: "画板", tint: "rgba(139,92,246,0.04)" },
      style: { width: 360, height: 240 },
      zIndex: -1,
    });
  }, [addNode, centerPosition]);

  const onPickSkill = useCallback((skill: CanvasSkillDef) => {
    // 列表在 L2；选中后仅打开参数轨（生成表单）
    setActiveSkill(skill);
  }, []);

  const onSkillGenerate = useCallback(
    (payload: {
      skill: CanvasSkillDef;
      prompt: string;
      model: string;
      count: number;
      values: Record<string, string | number>;
    }) => {
      setSkillBusy(true);
      const base = centerPosition();
      const ids: string[] = [];
      const newNodes: FsCanvasNode[] = [];
      const aspect = String(payload.values.aspect ?? "1:1");
      const isVideo = payload.skill.category === "video";

      if (isVideo) {
        const id = newId("videogen");
        ids.push(id);
        const vAspect = aspect === "1:1" ? "16:9" : aspect;
        const dim = sizeForAspect(vAspect, 260);
        const videoModel =
          payload.model.includes("motion") ||
          payload.model.includes("clip") ||
          payload.model.includes("walk") ||
          payload.model === "formscape-motion" ||
          payload.model === "storyboard-clip" ||
          payload.model === "walkthrough"
            ? payload.model
            : "formscape-motion";
        newNodes.push({
          id,
          type: "videogen",
          position: { x: base.x, y: base.y },
          selected: true,
          data: {
            ...DEFAULT_VIDEO_GEN,
            prompt: payload.prompt,
            model: videoModel,
            aspect: vAspect,
            duration: Number(payload.values.duration ?? 6) || 6,
          },
          style: { width: dim.width, height: dim.height },
        });
        applyNodes((prev) => [...prev.map((n) => ({ ...n, selected: false })), ...newNodes] as FsCanvasNode[]);
        setSelectedIds(ids);
        setActiveSkill(null);
        setSkillBusy(false);
        window.setTimeout(() => runVideoGen(id), 80);
        return;
      }

      // 一键落图：单节点多结果 + 完成后自动 promote 为图片节点
      const id = newId("imagegen");
      ids.push(id);
      const dim = sizeForAspect(aspect, 240);
      newNodes.push({
        id,
        type: "imagegen",
        position: { x: base.x - dim.width / 2, y: base.y - dim.height / 2 },
        selected: true,
        data: {
          ...DEFAULT_IMAGE_GEN,
          prompt: payload.prompt,
          model: payload.model,
          skillId: payload.skill.id,
          resultColors: payload.skill.colors,
          count: Math.min(4, Math.max(1, payload.count)),
          aspect,
          autoPromoteOnDone: true,
          removeAfterPromote: true,
        },
        style: { width: dim.width, height: dim.height },
      });
      applyNodes((prev) => [...prev.map((n) => ({ ...n, selected: false })), ...newNodes] as FsCanvasNode[]);
      setSelectedIds(ids.slice(0, 1));
      setActiveSkill(null);
      setSkillBusy(true);
      showCanvasToast(`技能「${payload.skill.name}」生成中…`, 4000);
      window.setTimeout(() => {
        runImageGen(id);
        // Demo 完成后 toast（略晚于 gen delay）
        window.setTimeout(() => {
          setSkillBusy(false);
          showCanvasToast("已一键落图到画布");
        }, 2200);
      }, 80);
    },
    [applyNodes, centerPosition, runImageGen, runVideoGen, showCanvasToast]
  );

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    pushHistory();
    setNodes((ns) => ns.filter((n) => !selectedIds.includes(n.id)));
    setSelectedIds([]);
  }, [selectedIds, pushHistory, setNodes]);

  /** 方向键微调（Shift = 10px） */
  const nudgeSelected = useCallback(
    (dx: number, dy: number) => {
      if (selectedIds.length === 0) return;
      applyNodes((prev) =>
        prev.map((n) =>
          selectedIds.includes(n.id)
            ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
            : n
        )
      );
    },
    [selectedIds, applyNodes]
  );

  /** 多选对齐 */
  const alignSelected = useCallback(
    (mode: AlignMode) => {
      if (selectedIds.length < 2) return;
      const selected = nodes.filter((n) => selectedIds.includes(n.id));
      if (selected.length < 2) return;
      const bounds = selected.map((n) => {
        const w = typeof n.style?.width === "number" ? n.style.width : 160;
        const h = typeof n.style?.height === "number" ? n.style.height : 120;
        return { id: n.id, x: n.position.x, y: n.position.y, w, h };
      });
      const minX = Math.min(...bounds.map((b) => b.x));
      const maxX = Math.max(...bounds.map((b) => b.x + b.w));
      const minY = Math.min(...bounds.map((b) => b.y));
      const maxY = Math.max(...bounds.map((b) => b.y + b.h));
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;

      applyNodes((prev) =>
        prev.map((n) => {
          const b = bounds.find((x) => x.id === n.id);
          if (!b) return n;
          let x = n.position.x;
          let y = n.position.y;
          if (mode === "left") x = minX;
          if (mode === "right") x = maxX - b.w;
          if (mode === "center-x") x = midX - b.w / 2;
          if (mode === "top") y = minY;
          if (mode === "bottom") y = maxY - b.h;
          if (mode === "center-y") y = midY - b.h / 2;
          return { ...n, position: { x, y } };
        })
      );
    },
    [selectedIds, nodes, applyNodes]
  );

  /** 多选图像水平并排对比 */
  const arrangeSelectedRow = useCallback(() => {
    const selected = nodes
      .filter((n) => selectedIds.includes(n.id) && (n.type === "image" || n.type === "imagegen"))
      .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
    if (selected.length < 2) return;
    const gap = 20;
    const startX = Math.min(...selected.map((n) => n.position.x));
    const startY = Math.min(...selected.map((n) => n.position.y));
    let x = startX;
    const posMap = new Map<string, { x: number; y: number }>();
    for (const n of selected) {
      const w = typeof n.style?.width === "number" ? n.style.width : 200;
      posMap.set(n.id, { x, y: startY });
      x += w + gap;
    }
    applyNodes((prev) =>
      prev.map((n) => {
        const p = posMap.get(n.id);
        return p ? { ...n, position: p } : n;
      })
    );
    showCanvasToast(`已并排 ${selected.length} 张`);
  }, [nodes, selectedIds, applyNodes, showCanvasToast]);

  const duplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const copies: FsCanvasNode[] = [];
    for (const id of selectedIds) {
      const src = nodes.find((n) => n.id === id);
      if (!src) continue;
      copies.push({
        ...src,
        id: newId(src.type ?? "n"),
        position: { x: src.position.x + 24, y: src.position.y + 24 },
        selected: true,
        data: { ...src.data },
      });
    }
    applyNodes((prev) => [...prev.map((n) => ({ ...n, selected: false })), ...copies] as FsCanvasNode[]);
    setSelectedIds(copies.map((c) => c.id));
  }, [selectedIds, nodes, applyNodes]);

  const copySelected = useCallback(() => {
    clipboard.current = nodes.filter((n) => selectedIds.includes(n.id)).map((n) => ({ ...n, data: { ...n.data } }));
  }, [nodes, selectedIds]);

  const pasteClipboard = useCallback(
    (at?: { x: number; y: number }) => {
      if (clipboard.current.length === 0) return;
      const origin = at ?? centerPosition();
      const base = clipboard.current[0].position;
      const copies = clipboard.current.map((src, i) => ({
        ...src,
        id: newId(src.type ?? "n"),
        position: {
          x: origin.x + (src.position.x - base.x) + i * 8,
          y: origin.y + (src.position.y - base.y) + i * 8,
        },
        selected: true,
        data: { ...src.data },
      }));
      applyNodes((prev) => [...prev.map((n) => ({ ...n, selected: false })), ...copies] as FsCanvasNode[]);
      setSelectedIds(copies.map((c) => c.id));
    },
    [applyNodes, centerPosition]
  );

  const toggleLock = useCallback(() => {
    applyNodes((prev) =>
      prev.map((n) => {
        if (!selectedIds.includes(n.id) || n.type !== "image") return n;
        const d = n.data as ImageNodeData;
        return { ...n, data: { ...d, locked: !d.locked }, draggable: !!d.locked };
      })
    );
  }, [applyNodes, selectedIds]);

  /** ] 置顶 */
  const bringFront = useCallback(() => {
    applyNodes((prev) => {
      const maxZ = Math.max(0, ...prev.map((n) => n.zIndex ?? 0));
      return prev.map((n) => (selectedIds.includes(n.id) ? { ...n, zIndex: maxZ + 1 } : n));
    });
  }, [applyNodes, selectedIds]);

  /** [ 置底 */
  const sendBack = useCallback(() => {
    applyNodes((prev) => {
      const minZ = Math.min(0, ...prev.map((n) => n.zIndex ?? 0));
      return prev.map((n) => (selectedIds.includes(n.id) ? { ...n, zIndex: minZ - 1 } : n));
    });
  }, [applyNodes, selectedIds]);

  /** ⌘] 上移一层 */
  const bringForward = useCallback(() => {
    applyNodes((prev) =>
      prev.map((n) =>
        selectedIds.includes(n.id) ? { ...n, zIndex: (n.zIndex ?? 0) + 1 } : n
      )
    );
  }, [applyNodes, selectedIds]);

  /** ⌘[ 下移一层 */
  const sendBackward = useCallback(() => {
    applyNodes((prev) =>
      prev.map((n) =>
        selectedIds.includes(n.id) ? { ...n, zIndex: (n.zIndex ?? 0) - 1 } : n
      )
    );
  }, [applyNodes, selectedIds]);

  /** 从节点取参考图（改图/技能复用源图） */
  const refFromNode = useCallback((n: FsCanvasNode): ImageGenNodeData["refs"] => {
    if (n.type === "image") {
      const d = n.data as ImageNodeData;
      if (!d.src && !d.colors?.length) return [];
      return [
        {
          id: newId("ref"),
          title: (d.title || "源图").slice(0, 16),
          colors: d.colors?.length ? d.colors : ["#E8E4DC", "#C9B8A0", "#5C5346"],
          src: d.src,
        },
      ];
    }
    if (n.type === "imagegen") {
      const d = n.data as ImageGenNodeData;
      const r = d.results?.[d.selectedResultIndex ?? 0];
      if (r?.src || r?.colors) {
        return [
          {
            id: newId("ref"),
            title: (r.title || "源结果").slice(0, 16),
            colors: r.colors,
            src: r.src,
          },
        ];
      }
      if (d.refs?.length) return d.refs.slice(0, 1);
    }
    return [];
  }, []);

  /** 交互式改图：再生成 / 风格延展 / 变体 → 自动跑并一键落图 */
  const editSelectedImage = useCallback(
    (mode: "regen" | "style" | "variant" | "agent") => {
      const img = nodes.find(
        (n) =>
          selectedIds.includes(n.id) &&
          (n.type === "image" || n.type === "imagegen" || n.type === "videogen")
      );
      if (!img) return;
      if (mode === "agent") {
        setAiOpen(true);
        return;
      }
      const at = { x: img.position.x + 260, y: img.position.y };
      if (img.type === "videogen") {
        const d = img.data as VideoGenNodeData;
        placeVideoGenAt(at, { prompt: `再生成：${d.prompt || "空间视频"}`, model: d.model });
        return;
      }
      if (img.type === "imagegen") {
        const d = img.data as ImageGenNodeData;
        if (mode === "regen" || mode === "variant") {
          // 原地再跑并自动落图
          applyNodes((prev) =>
            prev.map((n) =>
              n.id === img.id
                ? {
                    ...n,
                    data: {
                      ...(n.data as ImageGenNodeData),
                      autoPromoteOnDone: true,
                      removeAfterPromote: true,
                      count: mode === "variant" ? 2 : d.count || 1,
                      prompt:
                        mode === "variant"
                          ? `变体：${d.prompt || "图像"}`
                          : d.prompt || "再生成",
                    },
                  }
                : n
            )
          );
          window.setTimeout(() => runImageGen(img.id), 30);
          return;
        }
      }
      const d = img.data as ImageNodeData | ImageGenNodeData;
      const title = "title" in d ? d.title : d.prompt;
      const prompt =
        mode === "style"
          ? `风格延展：${title}`
          : mode === "variant"
            ? `变体：${title}`
            : `再生成：${title}`;
      const skillId =
        ("skillId" in d && d.skillId) ||
        (mode === "style" ? "space-atmosphere-transformation" : undefined);
      const id = placeImageGenAt(at, {
        prompt,
        model: "model" in d && d.model ? d.model : "formscape-style",
        skillId,
        count: mode === "variant" ? 2 : 1,
        aspect: "aspect" in d ? d.aspect : undefined,
        refs: refFromNode(img),
        autoPromoteOnDone: true,
        removeAfterPromote: true,
      });
      window.setTimeout(() => runImageGen(id), 40);
      showCanvasToast(
        mode === "variant" ? "变体生成中…" : mode === "style" ? "风格延展中…" : "再生成中…",
        2500
      );
    },
    [
      nodes,
      selectedIds,
      placeImageGenAt,
      placeVideoGenAt,
      runImageGen,
      setAiOpen,
      applyNodes,
      refFromNode,
      showCanvasToast,
    ]
  );

  /** 选中图 → 应用 14 技能之一（源图作 ref，mock 落图） */
  const applySkillToSelected = useCallback(
    (skillId: string) => {
      const skill = SKILLS_BY_ID[skillId];
      if (!skill) return;
      const img = nodes.find(
        (n) => selectedIds.includes(n.id) && (n.type === "image" || n.type === "imagegen")
      );
      const at = img
        ? { x: img.position.x + 280, y: img.position.y }
        : centerPosition();
      const refs = img ? refFromNode(img) : [];
      const id = placeImageGenAt(at, {
        prompt: skill.name,
        skillId: skill.id,
        model: skill.model,
        aspect: skill.defaultAspect,
        count: skill.defaultCount,
        refs,
        autoPromoteOnDone: true,
        removeAfterPromote: true,
      });
      showCanvasToast(`技能「${skill.name}」生成中…`, 3500);
      window.setTimeout(() => runImageGen(id), 40);
    },
    [nodes, selectedIds, placeImageGenAt, centerPosition, refFromNode, runImageGen, showCanvasToast]
  );

  const regenerateSelected = useCallback(() => {
    editSelectedImage("regen");
  }, [editSelectedImage]);

  /** 打开局部改图蒙版壳 */
  const openMaskEdit = useCallback(() => {
    const img = nodes.find(
      (n) => selectedIds.includes(n.id) && (n.type === "image" || n.type === "imagegen")
    );
    if (!img) {
      showCanvasToast("请先选中一张图片");
      return;
    }
    if (img.type === "image") {
      const d = img.data as ImageNodeData;
      setMaskEdit({
        nodeId: img.id,
        title: d.title || "图像",
        src: d.src,
        colors: d.colors?.length ? d.colors : ["#E8E4DC", "#C9B8A0", "#5C5346"],
        skillId: d.skillId,
      });
      return;
    }
    const d = img.data as ImageGenNodeData;
    const r = d.results?.[d.selectedResultIndex ?? 0];
    setMaskEdit({
      nodeId: img.id,
      title: r?.title || d.prompt || "生成图",
      src: r?.src,
      colors: r?.colors || d.resultColors || ["#EDE9FE", "#C4B5FD", "#7C3AED"],
      skillId: d.skillId,
    });
  }, [nodes, selectedIds, showCanvasToast]);

  /** 蒙版确认 → mock 落图（源图 + mask 作 ref） */
  const onMaskEditConfirm = useCallback(
    (payload: {
      nodeId: string;
      maskDataUrl: string;
      instruction: string;
      skillId?: string;
    }) => {
      const srcNode = nodes.find((n) => n.id === payload.nodeId);
      const at = srcNode
        ? { x: srcNode.position.x + 280, y: srcNode.position.y }
        : centerPosition();
      const baseRefs = srcNode ? refFromNode(srcNode) : [];
      const maskRef = {
        id: newId("ref"),
        title: "蒙版",
        colors: ["#111111", "#ef4444", "#ffffff"],
        src: payload.maskDataUrl,
      };
      const skillId = payload.skillId || "space-atmosphere-transformation";
      const skill = SKILLS_BY_ID[skillId];
      const id = placeImageGenAt(at, {
        prompt: `局部改图：${payload.instruction}`,
        skillId,
        model: skill?.model ?? "structure-safe",
        count: 1,
        refs: [...baseRefs, maskRef],
        autoPromoteOnDone: true,
        removeAfterPromote: true,
      });
      setMaskEdit(null);
      showCanvasToast("局部改图生成中…", 3500);
      window.setTimeout(() => runImageGen(id), 40);
    },
    [nodes, centerPosition, refFromNode, placeImageGenAt, runImageGen, showCanvasToast]
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [nodes, ...f].slice(0, 40));
      skipHistory.current = true;
      setNodes(prev);
      return h.slice(0, -1);
    });
  }, [nodes, setNodes]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const [next, ...rest] = f;
      setHistory((h) => [...h, nodes].slice(-40));
      skipHistory.current = true;
      setNodes(next);
      return rest;
    });
  }, [nodes, setNodes]);

  const onUploadFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      Array.from(files).forEach((file, i) => {
        if (!file.type.startsWith("image/")) return;
        const url = URL.createObjectURL(file);
        const pos = centerPosition();
        addImageAt(
          {
            title: file.name.replace(/\.[^.]+$/, "") || "上传图片",
            tags: ["upload"],
            colors: ["#E5E7EB", "#D1D5DB", "#9CA3AF"],
            source: "upload",
            src: url,
          },
          { x: pos.x + i * 40, y: pos.y + i * 24 }
        );
      });
    },
    [addImageAt, centerPosition]
  );

  /** 切到 L2 某分区；侧栏收起时自动展开 */
  const focusL2Section = useCallback(
    (section: "boards" | "images" | "ecology" | "skills") => {
      openSection(section);
      if (sidebarCollapsed) toggleSidebar();
      if (settings.panelsExclusive && section !== "skills") {
        setActiveSkill(null);
      }
    },
    [openSection, sidebarCollapsed, toggleSidebar, settings.panelsExclusive]
  );

  /** L → L2 图库（上传 + 生成） */
  const toggleLibrary = useCallback(() => {
    focusL2Section("images");
  }, [focusL2Section]);

  /** S → L2 技能库（AIGC 工作流 / 提示词） */
  const toggleSkills = useCallback(() => {
    focusL2Section("skills");
  }, [focusL2Section]);

  // 注册 L2 库桥 + 画布 Agent 桥
  useEffect(() => {
    const selectNode = (id: string) => {
      setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === id })));
      setSelectedIds([id]);
      const target = nodesRef.current.find((n) => n.id === id);
      if (target) {
        const vp = getViewport();
        void setRfViewport({
          x: -target.position.x * vp.zoom + 200,
          y: -target.position.y * vp.zoom + 120,
          zoom: vp.zoom,
        });
      }
    };
    registerBridge({
      nodes,
      selectedIds,
      onSelectNode: selectNode,
      onAddImage: (item) => addImageAt(item),
      onAddProduct: (item) =>
        addImageAt({
          title: item.title,
          tags: [...item.tags, item.brand].filter(Boolean) as string[],
          colors: item.colors?.length ? item.colors : ["#F0EDE6", "#D0C8B8", "#7A7060"],
          source: "library",
          src: item.src,
        }),
      onPickSkill,
      onAddImageGen: (model) => addImageGen(model),
      onAddVideoGen: (model) => addVideoGen(model),
      onUpload: () => fileRef.current?.click(),
    });

    registerCanvasBridge({
      projectName: project.name,
      placeResult: (payload) =>
        addImageAtRef.current({
          title: payload.title,
          tags: payload.tags,
          colors: payload.colors,
          source: "agent",
          src: payload.src,
        }),
      getSnapshot: () => {
        const ns = nodesRef.current;
        const sel = ns.filter((n) => n.selected);
        return {
          nodeCount: ns.length,
          selectedCount: sel.length,
          selectedTypes: sel.map((n) => n.type ?? "unknown"),
          selectedTitles: sel.map((n) => {
            const d = n.data as { title?: string; prompt?: string };
            return d.title || d.prompt || n.type || n.id;
          }),
        };
      },
      placeImageGen: (opts) => {
        const skill = opts?.skillId ? SKILLS_BY_ID[opts.skillId] : undefined;
        const id = placeImageGenAt(centerPosition(), {
          prompt: opts?.prompt ?? skill?.name ?? "生成",
          model: opts?.model ?? skill?.model,
          skillId: opts?.skillId,
          count: opts?.count ?? skill?.defaultCount,
          aspect: opts?.aspect ?? skill?.defaultAspect,
          autoPromoteOnDone: true,
          removeAfterPromote: true,
        });
        if (opts?.autoRun !== false) {
          window.setTimeout(() => runImageGen(id), 60);
        }
        return id;
      },
      editSelected: (instruction) => {
        const img = nodesRef.current.find(
          (n) => n.selected && (n.type === "image" || n.type === "imagegen")
        );
        if (!img) return false;
        const d = img.data as ImageNodeData | ImageGenNodeData;
        const title = "title" in d ? d.title : d.prompt;
        const at = { x: img.position.x + 260, y: img.position.y };
        const id = placeImageGenAt(at, {
          prompt: `${instruction}：${title || "选中图像"}`,
          model: "formscape-style",
          skillId: "skillId" in d ? d.skillId : "space-atmosphere-transformation",
          refs: refFromNode(img),
          autoPromoteOnDone: true,
          removeAfterPromote: true,
        });
        window.setTimeout(() => runImageGen(id), 80);
        return true;
      },
    });

    return () => {
      registerBridge(null);
      registerCanvasBridge(null);
    };
  }, [
    registerBridge,
    registerCanvasBridge,
    project.name,
    nodes,
    selectedIds,
    setNodes,
    getViewport,
    setRfViewport,
    addImageAt,
    addImageGen,
    addVideoGen,
    onPickSkill,
    applyNodes,
    centerPosition,
    placeImageGenAt,
    runImageGen,
    refFromNode,
  ]);

  /**
   * 快捷键 — 对齐 Lovspark KeyboardManager + ViewportManager.Space
   * 输入框内仅放行 mod 组合键（撤销等）
   */
  useEffect(() => {
    const hidePanels = () => {
      setActiveSkill(null);
      setCtxMenu(null);
    };

    const onKey = (e: KeyboardEvent) => {
      const typing = isEditableTarget(e.target);
      const mod = isMod(e);
      const key = e.key;
      const k = key.toLowerCase();

      // —— Space 临时平移（ViewportManager）：输入框内不接管 ——
      if (e.code === "Space") {
        if (typing) return;
        e.preventDefault();
        if (!e.repeat) {
          spacePanRef.current = true;
          setSpacePan(true);
        }
        return;
      }

      // 输入中：只允许 mod 组合（撤销/重做/复制粘贴等）
      if (typing && !mod) return;

      // —— 编辑类 ——
      if (mod && k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (mod && (k === "y" || (k === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && k === "d") {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (mod && k === "c") {
        e.preventDefault();
        copySelected();
        return;
      }
      if (mod && k === "v") {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if (mod && k === "a") {
        e.preventDefault();
        setNodes((ns) => {
          setSelectedIds(ns.map((n) => n.id));
          return ns.map((n) => ({ ...n, selected: true }));
        });
        return;
      }

      // —— 图层 ——
      if (mod && key === "]") {
        e.preventDefault();
        bringForward();
        return;
      }
      if (mod && key === "[") {
        e.preventDefault();
        sendBackward();
        return;
      }
      if (!mod && key === "]") {
        e.preventDefault();
        bringFront();
        return;
      }
      if (!mod && key === "[") {
        e.preventDefault();
        sendBack();
        return;
      }

      // —— 缩放：⌘+/-/1/0 ——
      if (mod && (key === "=" || key === "+")) {
        e.preventDefault();
        void zoomIn();
        return;
      }
      if (mod && key === "-") {
        e.preventDefault();
        void zoomOut();
        return;
      }
      if (mod && key === "1") {
        e.preventDefault();
        void fitView({ padding: 0.2 });
        return;
      }
      if (mod && key === "0") {
        e.preventDefault();
        void setRfViewport({ x: 0, y: 0, zoom: 1 });
        setZoom(1);
        return;
      }

      // —— 媒体：⌘E 视频生成 / ⌘⇧K 上传 ——
      if (mod && k === "e" && !e.shiftKey) {
        e.preventDefault();
        hidePanels();
        armVideoGen();
        return;
      }
      if (mod && k === "k" && e.shiftKey) {
        e.preventDefault();
        fileRef.current?.click();
        return;
      }

      // 输入中到此为止（非 mod 单键不处理）
      if (typing) return;

      // —— 删除 ——
      if (key === "Backspace" || key === "Delete") {
        e.preventDefault();
        deleteSelected();
        return;
      }

      // —— 方向键微调 ——
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
        if (selectedIds.length === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (key === "ArrowUp") nudgeSelected(0, -step);
        if (key === "ArrowDown") nudgeSelected(0, step);
        if (key === "ArrowLeft") nudgeSelected(-step, 0);
        if (key === "ArrowRight") nudgeSelected(step, 0);
        return;
      }

      // —— V / Esc → 选择（Esc 额外收面板）——
      if (k === "v" || key === "Escape") {
        e.preventDefault();
        setTool("select");
        spacePanRef.current = false;
        setSpacePan(false);
        if (key === "Escape") {
          setSettingsOpen(false);
          hidePanels();
        }
        return;
      }

      // —— H → 平移（P 不是平移！）——
      if (k === "h") {
        e.preventDefault();
        setTool("pan");
        return;
      }

      // —— F → 立即创建 Frame ——
      if (k === "f") {
        e.preventDefault();
        spawnFrameAtCenter();
        return;
      }

      // —— R / T / C / N 放置工具 ——
      if (k === "r") {
        e.preventDefault();
        setTool("shape");
        return;
      }
      if (k === "t") {
        e.preventDefault();
        setTool("text");
        return;
      }
      if (k === "c") {
        e.preventDefault();
        setTool("comment");
        return;
      }
      if (k === "n") {
        e.preventDefault();
        setTool("sticky");
        return;
      }

      // —— A 图片生成（再点画布）· S 技能（L2）· L 图库 ——
      if (k === "a") {
        e.preventDefault();
        hidePanels();
        armImageGen();
        return;
      }
      if (k === "s") {
        e.preventDefault();
        setActiveSkill(null);
        setCtxMenu(null);
        focusL2Section("skills");
        return;
      }
      if (k === "l") {
        e.preventDefault();
        hidePanels();
        focusL2Section("images");
        return;
      }
      if (key === "Tab") {
        e.preventDefault();
        setAiOpen(true);
        return;
      }

      // B 画笔 / P 钢笔：Lovspark 有、Formscape 暂未实现
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spacePanRef.current = false;
        setSpacePan(false);
      }
    };

    const onBlur = () => {
      spacePanRef.current = false;
      setSpacePan(false);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [
    undo,
    redo,
    duplicateSelected,
    deleteSelected,
    copySelected,
    pasteClipboard,
    zoomIn,
    zoomOut,
    fitView,
    setRfViewport,
    armImageGen,
    armVideoGen,
    setAiOpen,
    setNodes,
    bringFront,
    sendBack,
    bringForward,
    sendBackward,
    spawnFrameAtCenter,
    focusL2Section,
    nudgeSelected,
    selectedIds.length,
    isNodeMode,
  ]);

  const selectedLocked = nodes
    .filter((n) => selectedIds.includes(n.id) && n.type === "image")
    .every((n) => (n.data as ImageNodeData).locked);

  const showImageActions = nodes.some(
    (n) =>
      selectedIds.includes(n.id) && (n.type === "image" || n.type === "imagegen" || n.type === "videogen")
  );

  const variant = bgVariant(settings.bgPattern);

  const onPaneContextMenu = useCallback(
    (e: ReactMouseEvent | MouseEvent) => {
      e.preventDefault();
      const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setCtxMenu({ x: e.clientX, y: e.clientY, flowX: flow.x, flowY: flow.y });
    },
    [screenToFlowPosition]
  );

  const onNodeContextMenu = useCallback(
    (e: ReactMouseEvent, node: { id: string; type?: string }) => {
      e.preventDefault();
      e.stopPropagation();
      const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === node.id })));
      setSelectedIds([node.id]);
      setCtxMenu({
        x: e.clientX,
        y: e.clientY,
        flowX: flow.x,
        flowY: flow.y,
        nodeId: node.id,
        nodeType: node.type,
      });
    },
    [screenToFlowPosition, setNodes]
  );

  /** 空白画布：导入 4 张 popular 技能样例并排 */
  const seedMockSamples = useCallback(
    (origin?: { x: number; y: number }) => {
      const popular = listMockGallerySamples()
        .map((s) => {
          const skill = SKILLS_BY_ID[s.skillId];
          return {
            ...s,
            title: skill?.name ?? s.title,
            colors: skill?.colors ?? s.colors,
            popular: !!skill?.popular,
          };
        })
        .filter((s) => s.popular || s.src)
        .slice(0, 4);
      if (!popular.length) {
        showCanvasToast("无可用样例（检查 formscape-skill-mocks）");
        return;
      }
      const base = origin ?? centerPosition();
      const w = 200;
      const h = 160;
      const gap = 24;
      const startX = base.x - ((popular.length - 1) * (w + gap)) / 2;
      const ids: string[] = [];
      applyNodes((prev) => {
        const cleared = prev.map((n) => ({ ...n, selected: false }));
        const added: FsCanvasNode[] = popular.map((s, i) => {
          const id = newId("img");
          ids.push(id);
          return {
            id,
            type: "image",
            position: { x: startX + i * (w + gap), y: base.y - h / 2 },
            selected: true,
            data: {
              kind: "image" as const,
              title: s.title,
              tags: ["sample", s.skillId],
              colors: s.colors,
              source: "library" as const,
              skillId: s.skillId,
              src: s.src,
            },
            style: { width: w, height: h },
          };
        });
        return [...cleared, ...added] as FsCanvasNode[];
      });
      if (ids.length) setSelectedIds(ids);
      pushGenHistoryMany(
        popular.map((s) => ({
          title: s.title,
          src: s.src,
          colors: s.colors,
          skillId: s.skillId,
          source: "sample" as const,
        }))
      );
      showCanvasToast(`已导入 ${popular.length} 张样例`);
      window.setTimeout(() => void fitView({ padding: 0.25 }), 80);
    },
    [applyNodes, centerPosition, showCanvasToast, fitView]
  );

  const onCtxAction = useCallback(
    (action: string) => {
      if (!ctxMenu) return;
      const at = { x: ctxMenu.flowX, y: ctxMenu.flowY };
      if (action.startsWith("skill:")) {
        applySkillToSelected(action.slice("skill:".length));
        return;
      }
      if (action.startsWith("place-skill:")) {
        const skillId = action.slice("place-skill:".length);
        const skill = SKILLS_BY_ID[skillId];
        if (!skill) return;
        const id = placeImageGenAt(at, {
          prompt: skill.name,
          skillId: skill.id,
          model: skill.model,
          aspect: skill.defaultAspect,
          count: skill.defaultCount,
          autoPromoteOnDone: true,
          removeAfterPromote: true,
        });
        showCanvasToast(`技能「${skill.name}」生成中…`, 3500);
        window.setTimeout(() => runImageGen(id), 40);
        return;
      }
      switch (action) {
        case "paste":
          pasteClipboard(at);
          break;
        case "duplicate":
          duplicateSelected();
          break;
        case "delete":
          deleteSelected();
          break;
        case "regen":
          editSelectedImage("regen");
          break;
        case "style-extend":
          editSelectedImage("style");
          break;
        case "variant":
          editSelectedImage("variant");
          break;
        case "mask-edit":
          openMaskEdit();
          break;
        case "seed-samples":
          seedMockSamples(at);
          break;
        case "fit":
          void fitView({ padding: 0.2 });
          break;
        case "zoom-in":
          void zoomIn();
          break;
        case "zoom-out":
          void zoomOut();
          break;
        case "add-imagegen":
          placeImageGenAt(at);
          break;
        case "add-videogen":
          placeVideoGenAt(at);
          break;
        case "add-text":
          addNode({
            type: "text",
            position: at,
            data: { kind: "text", text: "标题文字", fontSize: 18 },
            style: { width: 160, height: 40 },
          });
          break;
        case "add-sticky":
          addNode({
            type: "sticky",
            position: at,
            data: { kind: "sticky", text: "新便签", color: STICKY_COLORS[0] },
            style: { width: 180, height: 140 },
          });
          break;
        case "upload":
          fileRef.current?.click();
          break;
        case "lock":
          toggleLock();
          break;
        case "bring-front":
          bringFront();
          break;
        case "send-back":
          sendBack();
          break;
        default:
          break;
      }
    },
    [
      ctxMenu,
      pasteClipboard,
      duplicateSelected,
      deleteSelected,
      fitView,
      zoomIn,
      zoomOut,
      addNode,
      placeImageGenAt,
      placeVideoGenAt,
      toggleLock,
      bringFront,
      applySkillToSelected,
      editSelectedImage,
      openMaskEdit,
      seedMockSamples,
      runImageGen,
      showCanvasToast,
      sendBack,
      isNodeMode,
    ]
  );

  const onDropFiles = useCallback(
    (e: ReactDragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      // 图库 / 样例 / 历史 MIME 拖拽
      const raw =
        e.dataTransfer.getData(CANVAS_DND_MIME) || e.dataTransfer.getData("text/plain");
      const payload = decodeDndPayload(raw);
      if (payload) {
        addImageAt(
          {
            title: payload.title,
            tags: payload.tags,
            colors: payload.colors,
            source: payload.source,
            skillId: payload.skillId,
            src: payload.src,
          },
          { x: pos.x - 100, y: pos.y - 80 }
        );
        showCanvasToast("已从库落到画布");
        return;
      }
      const files = e.dataTransfer.files;
      if (!files?.length) return;
      Array.from(files).forEach((file, i) => {
        if (!file.type.startsWith("image/")) return;
        const url = URL.createObjectURL(file);
        addImageAt(
          {
            title: file.name.replace(/\.[^.]+$/, "") || "上传图片",
            tags: ["upload"],
            colors: ["#E5E7EB", "#D1D5DB", "#9CA3AF"],
            source: "upload",
            src: url,
          },
          { x: pos.x + i * 40, y: pos.y + i * 24 }
        );
      });
      showCanvasToast("已上传到画布");
    },
    [screenToFlowPosition, addImageAt, showCanvasToast]
  );

  return (
    <CanvasNodeActionsProvider setNodes={setNodes}>
    <div
      className="fs-canvas-root relative size-full overflow-hidden bg-surface-1"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={onDropFiles}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onUploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <ReactFlow
        className={cn(
          "fs-canvas-flow h-full w-full",
          isPanMode && "fs-canvas-panning",
          isPlaceTool && "fs-canvas-placing"
        )}
        nodes={displayNodes}
        edges={[]}
        onNodesChange={onNodesChange}
        onSelectionChange={onSelectionChange}
        onNodeDragStart={() => {
          pushHistory();
        }}
        onMoveStart={() => {
          // 视口开始变化：标记随后 ~80ms 内的 click 不当作落点
          suppressPlaceClick.current = true;
          if (suppressPlaceTimer.current) window.clearTimeout(suppressPlaceTimer.current);
        }}
        onMoveEnd={(...args) => {
          onMoveEnd(...args);
          if (suppressPlaceTimer.current) window.clearTimeout(suppressPlaceTimer.current);
          suppressPlaceTimer.current = window.setTimeout(() => {
            suppressPlaceClick.current = false;
            suppressPlaceTimer.current = null;
          }, 80);
        }}
        onPaneClick={(e) => {
          setCtxMenu(null);
          if (suppressPlaceClick.current) {
            suppressPlaceClick.current = false;
            if (suppressPlaceTimer.current) {
              window.clearTimeout(suppressPlaceTimer.current);
              suppressPlaceTimer.current = null;
            }
            return;
          }
          placeFromClick(e);
        }}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onNodeDoubleClick={(_e, node) => {
          if (node.type === "image" || node.type === "imagegen") {
            setSelectedIds([node.id]);
            setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === node.id })));
            // 双击 = 风格延展（交互改图入口）
            window.setTimeout(() => editSelectedImage("style"), 0);
          }
        }}
        nodeTypes={canvasNodeTypes}
        fitView={!savedViewport}
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.15}
        maxZoom={3}
        snapToGrid={settings.snapToGrid}
        snapGrid={[16, 16]}
        /*
          Lovspark / Figma 交互：
          - 滚轮：缩放（panOnScroll=false，避免与 zoom 抢事件）
          - 选择工具：左键空白拖=框选，左键节点拖=移动
          - 平移工具 / 空格：左键拖=平移
          - 中键/右键：始终可平移
          - 多选：⌘/Ctrl+点选（对齐 Lovspark SelectTool）
        */
        /* 空白处拖拽框选；节点上的表单由 nodrag + 父级 setNodes 写回，避免闪回 */
        selectionOnDrag={tool === "select" && !isPanMode}
        panOnDrag={isPanMode ? true : [1, 2]}
        selectionMode={SelectionMode.Partial}
        selectNodesOnDrag={false}
        nodesDraggable={!isPanMode && !isPlaceTool}
        nodesConnectable={false}
        elementsSelectable={!isPlaceTool && !isPanMode}
        edgesFocusable={false}
        /** 仅挂载视口内节点 DOM，节点多时显著减负 */
        onlyRenderVisibleElements
        nodeDragThreshold={5}
        panOnScroll={false}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        preventScrolling
        deleteKeyCode={null}
        multiSelectionKeyCode={["Meta", "Control"]}
        selectionKeyCode={null}
        panActivationKeyCode={null}
        noDragClassName="nodrag"
        noPanClassName="nopan"
        noWheelClassName="nowheel"
        proOptions={{ hideAttribution: true }}
        style={{ cursor: isPanMode ? "grab" : isPlaceTool ? "crosshair" : "default" }}
      >
        {variant && (
          <Background variant={variant} gap={20} size={1} color="var(--border-subtle)" className="!bg-surface-1" />
        )}
        {settings.showMinimap !== false && !activeSkill && (
          <MiniMap
            className="!bottom-4 !right-3 !left-auto !m-0"
            maskColor="color-mix(in srgb, var(--bg-surface-2) 75%, transparent)"
            nodeColor={() => "var(--bg-accent-primary)"}
            pannable
            zoomable
          />
        )}
      </ReactFlow>

      <SelectionToolbar
        count={selectedIds.length}
        locked={!!selectedLocked && selectedIds.length > 0}
        showImageActions={showImageActions}
        onDuplicate={duplicateSelected}
        onDelete={deleteSelected}
        onToggleLock={toggleLock}
        onBringFront={bringFront}
        onSendBack={sendBack}
        onRegenerate={regenerateSelected}
        onStyleExtend={() => editSelectedImage("style")}
        onVariant={() => editSelectedImage("variant")}
        onAskAi={() => editSelectedImage("agent")}
        onApplySkill={applySkillToSelected}
        onMaskEdit={openMaskEdit}
        onArrangeRow={arrangeSelectedRow}
        onAlign={alignSelected}
      />

      {maskEdit && (
        <MaskEditOverlay
          target={maskEdit}
          onClose={() => setMaskEdit(null)}
          onConfirm={onMaskEditConfirm}
        />
      )}

      {!activeSkill && (
        <ZoomControls
          zoom={zoom}
          onZoomIn={() => void zoomIn()}
          onZoomOut={() => void zoomOut()}
          onFit={() => void fitView({ padding: 0.2 })}
          onReset={() => {
            void setRfViewport({ x: 0, y: 0, zoom: 1 });
            setZoom(1);
          }}
          onUndo={undo}
          onRedo={redo}
          canUndo={history.length > 0}
          canRedo={future.length > 0}
        />
      )}

      {displayNodes.length === 0 && !isPlaceTool && !activeSkill && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="max-w-sm rounded-lg border border-dashed border-subtle bg-surface-1/95 px-6 py-8 text-center shadow-sm backdrop-blur-sm">
            <div className="text-13 font-semibold text-primary">空白画布</div>
            <p className="mt-1.5 text-11 text-tertiary">
              <kbd className="rounded bg-surface-2 px-1">S</kbd> 技能 ·{" "}
              <kbd className="rounded bg-surface-2 px-1">A</kbd> 生成 ·{" "}
              <kbd className="rounded bg-surface-2 px-1">L</kbd> 图库 · Tab AI
            </p>
            <div className="pointer-events-auto mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => seedMockSamples()}
                className="rounded-md bg-accent-primary px-3 py-1.5 text-11 font-medium text-on-color hover:opacity-90"
              >
                一键导入 4 张样例
              </button>
              <button
                type="button"
                onClick={() => openSection("skills")}
                className="rounded-md border border-subtle bg-surface-1 px-3 py-1.5 text-11 font-medium text-secondary hover:bg-layer-transparent-hover"
              >
                打开技能库
              </button>
            </div>
          </div>
        </div>
      )}

      {canvasToast && (
        <div className="pointer-events-none absolute left-1/2 top-14 z-40 -translate-x-1/2">
          <div className="rounded-md border border-subtle bg-surface-1 px-3 py-1.5 text-11 font-medium text-primary shadow-md">
            {canvasToast}
            {skillBusy && <span className="ml-1.5 text-tertiary">Demo</span>}
          </div>
        </div>
      )}

      <CanvasToolbar
        tool={tool}
        onToolChange={setTool}
        libraryOpen={libSection === "images"}
        skillsOpen={libSection === "skills"}
        onToggleLibrary={toggleLibrary}
        onToggleSkills={toggleSkills}
        onAddImageGen={() => addImageGen()}
        onAddVideoGen={() => addVideoGen()}
        onUpload={() => fileRef.current?.click()}
        onOpenSettings={() => setSettingsOpen(true)}
        nodeMode
      />

      {tool === "shape" && (
        <div className="pointer-events-auto absolute bottom-[64px] left-1/2 z-30 flex -translate-x-1/2 gap-0.5 rounded-md border border-subtle bg-surface-1 p-1 shadow-sm">
          {(["rect", "ellipse", "line", "arrow"] as ShapeKind[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setShapeKind(s)}
              className={
                shapeKind === s
                  ? "rounded-md bg-accent-subtle px-2.5 py-1 text-11 font-medium text-accent-primary"
                  : "rounded-md px-2.5 py-1 text-11 font-medium text-secondary hover:bg-layer-transparent-hover"
              }
            >
              {{ rect: "矩形", ellipse: "椭圆", line: "直线", arrow: "箭头" }[s]}
            </button>
          ))}
        </div>
      )}

      {/* 技能参数轨：从 L2 / S 选技能后展开 */}
      <SkillRail
        skill={activeSkill}
        onClose={() => setActiveSkill(null)}
        onGenerate={onSkillGenerate}
        busy={skillBusy}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onChange={setSettings}
        onClose={() => setSettingsOpen(false)}
        onResetCanvas={() => resetToMoodboard()}
      />

      <CanvasContextMenu
        menu={ctxMenu}
        onClose={() => setCtxMenu(null)}
        onAction={onCtxAction}
        nodeMode
      />

      {isPlaceTool && (
        <div className="pointer-events-none absolute bottom-[4.25rem] left-1/2 z-10 -translate-x-1/2 rounded-md border border-subtle bg-surface-1 px-2.5 py-1 text-11 text-tertiary shadow-sm">
          {tool === "imagegen"
            ? "点击画布放置图片生成器 · Esc 取消"
            : tool === "videogen"
              ? "点击画布放置视频生成器 · Esc 取消"
              : "点击画布放置 · Esc/V 回选择 · 空格临时平移"}
        </div>
      )}
    </div>
    </CanvasNodeActionsProvider>
  );
}

export function CanvasWorkspace(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

/**
 * 构境 AI 统一状态
 * - L2 壳右侧停靠面板开关
 * - 全局对话（跨页面保留）
 * - 画布桥：在画布页注册「放到画布」能力
 * - 项目 harness：project 边界 + tools/skills（对标 refs/grok-build）
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useParams, usePathname } from "next/navigation";
import { runHarnessTurn } from "./agent/runtime";
import type { ProjectHarnessContext, ToolTrace } from "./agent/types";
import { getProjectProgress } from "./project-progress-store";
import { getProjectById } from "./projects-store";
import {
  archiveSession,
  listAiSessions,
  loadAiMsgs,
  loadAiSessionId,
  newAiSessionId,
  persistAiSessionId,
  saveAiMsgs,
  saveAiSessions,
  sessionTitleFrom,
  type AiSessionArchive,
} from "./ai-sessions";

export type { AiSessionArchive } from "./ai-sessions";
export { listAiSessions } from "./ai-sessions";

export type FormscapeAiMsg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "agent"; text: string; toolTrace?: ToolTrace[] }
  | { id: string; role: "thinking" };

export type CanvasPlacePayload = {
  title: string;
  colors: string[];
  tags: string[];
  src?: string;
};

/** 画布 Agent 桥 — 全局 Agent 未做；画布页专用能力 */
export type CanvasAiBridge = {
  projectName: string;
  placeResult: (payload: CanvasPlacePayload) => void;
  /** 画布快照（节点/选中） */
  getSnapshot?: () => {
    nodeCount: number;
    selectedCount: number;
    selectedTypes: string[];
    selectedTitles: string[];
  };
  /** 放置图片生成器并可选立即跑（Demo 全 mock） */
  placeImageGen?: (opts?: {
    prompt?: string;
    model?: string;
    skillId?: string;
    count?: number;
    aspect?: string;
    autoRun?: boolean;
  }) => string | null;
  /** 对当前选中图做交互改图（旁落生成器） */
  editSelected?: (instruction: string) => boolean;
};

type FormscapeAiContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  canvasActive: boolean;
  canvasProjectName: string | null;
  /** 当前 harness 项目上下文 */
  harness: ProjectHarnessContext;
  registerCanvasBridge: (bridge: CanvasAiBridge | null) => void;
  placeToCanvas: (payload?: CanvasPlacePayload) => boolean;
  msgs: FormscapeAiMsg[];
  busy: boolean;
  send: (text: string) => void;
  /** 归档当前对话并开新会话 */
  clearMsgs: () => void;
  /** 历史会话（localStorage） */
  listSessions: () => AiSessionArchive[];
  /** 加载某条历史到当前面板 */
  loadSession: (id: string) => boolean;
  /** 删除一条历史 */
  deleteSession: (id: string) => void;
};

const FormscapeAiContext = createContext<FormscapeAiContextValue | null>(null);

const DEFAULT_PLACE: CanvasPlacePayload = {
  title: "AI 建议稿",
  tags: ["agent", "草稿"],
  colors: ["#EDE9FE", "#C4B5FD", "#8B5CF6"],
};

export function FormscapeAiProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const pathname = usePathname() ?? "";
  const workspaceSlug = params.workspaceSlug?.toString() ?? "formscape";
  const routeProjectId = params.projectId?.toString() ?? null;

  const [open, setOpenState] = useState(false);
  const [msgs, setMsgs] = useState<FormscapeAiMsg[]>(() => loadAiMsgs() as FormscapeAiMsg[]);
  const [busy, setBusy] = useState(false);
  const [canvasActive, setCanvasActive] = useState(false);
  const [canvasProjectName, setCanvasProjectName] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(loadAiSessionId);
  const bridgeRef = useRef<CanvasAiBridge | null>(null);
  const busyRef = useRef(false);
  const harnessRef = useRef<ProjectHarnessContext | null>(null);
  const msgsRef = useRef(msgs);
  useEffect(() => {
    msgsRef.current = msgs;
    saveAiMsgs(msgs);
  }, [msgs]);

  // 从路由 / 画布推导项目上下文
  const harness = useMemo<ProjectHarnessContext>(() => {
    let projectId: string | null = routeProjectId;
    // 画布 ?project= 由 bridge 名称兜底；路由优先
    if (!projectId && canvasActive && canvasProjectName) {
      // 仅有名称时不强行解析 id
      projectId = null;
    }
    const pm = projectId ? getProjectById(projectId) : undefined;
    let focusStage = null as ProjectHarnessContext["focusStage"];
    if (projectId) {
      try {
        focusStage = getProjectProgress(projectId).focusStage;
      } catch {
        focusStage = (pm?.stageId as ProjectHarnessContext["focusStage"]) ?? null;
      }
    }
    // 从路径解析 stages/:id
    const stageMatch = pathname.match(/\/stages\/([a-z_]+)/);
    if (stageMatch) {
      focusStage = stageMatch[1] as ProjectHarnessContext["focusStage"];
    }
    return {
      workspaceSlug,
      projectId,
      projectName: pm?.name ?? canvasProjectName,
      focusStage,
      canvasActive,
      sessionId,
    };
  }, [workspaceSlug, routeProjectId, canvasActive, canvasProjectName, pathname, sessionId]);

  useEffect(() => {
    harnessRef.current = harness;
  }, [harness]);

  const setOpen = useCallback((v: boolean) => {
    setOpenState(v);
  }, []);

  const toggle = useCallback(() => {
    setOpenState((v) => !v);
  }, []);

  const registerCanvasBridge = useCallback((bridge: CanvasAiBridge | null) => {
    bridgeRef.current = bridge;
    // 同步给 harness tools（非 React 上下文）
    void import("./canvas/canvas-ai-bridge-registry").then((m) => m.setCanvasAiBridge(bridge));
    setCanvasActive(!!bridge);
    setCanvasProjectName(bridge?.projectName ?? null);
  }, []);

  const placeToCanvas = useCallback((payload?: CanvasPlacePayload) => {
    const b = bridgeRef.current;
    if (!b) return false;
    b.placeResult(payload ?? DEFAULT_PLACE);
    return true;
  }, []);



  const clearMsgs = useCallback(() => {
    archiveSession(sessionId, msgsRef.current);
    const nextId = newAiSessionId();
    setSessionId(nextId);
    persistAiSessionId(nextId);
    setMsgs([]);
    saveAiMsgs([]);
  }, [sessionId]);

  const listSessions = useCallback(() => listAiSessions(), []);

  const loadSession = useCallback(
    (id: string) => {
      const hit = listAiSessions().find((s) => s.id === id);
      if (!hit) return false;
      const cur = msgsRef.current.filter((m) => m.role !== "thinking");
      if (cur.length > 0 && sessionId !== id) {
        archiveSession(sessionId, cur);
      }
      setSessionId(hit.id);
      persistAiSessionId(hit.id);
      setMsgs(hit.msgs as FormscapeAiMsg[]);
      saveAiMsgs(hit.msgs);
      return true;
    },
    [sessionId]
  );

  const deleteSession = useCallback((id: string) => {
    saveAiSessions(listAiSessions().filter((s) => s.id !== id));
  }, []);

  const send = useCallback((text: string) => {
    const t = text.trim();
    if (!t || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);

    const uid = `u-${Date.now()}`;
    const tid = `t-${Date.now()}`;
    setMsgs((m) => [...m, { id: uid, role: "user", text: t }, { id: tid, role: "thinking" }]);

    const ctx = harnessRef.current ?? {
      workspaceSlug: "formscape",
      projectId: null,
      projectName: null,
      focusStage: null,
      canvasActive: false,
      sessionId,
    };

    void (async () => {
      try {
        const result = await runHarnessTurn(ctx, t);
        const aid = `a-${Date.now()}`;
        setMsgs((m) =>
          m
            .filter((x) => x.id !== tid)
            .concat({
              id: aid,
              role: "agent",
              text: result.text,
              toolTrace: result.toolTrace,
            })
        );
      } catch (e) {
        const aid = `a-${Date.now()}`;
        setMsgs((m) =>
          m
            .filter((x) => x.id !== tid)
            .concat({
              id: aid,
              role: "agent",
              text: `Harness 执行失败：${e instanceof Error ? e.message : String(e)}`,
            })
        );
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    })();
  }, [sessionId]);

  const value = useMemo<FormscapeAiContextValue>(
    () => ({
      open,
      setOpen,
      toggle,
      canvasActive,
      canvasProjectName,
      harness,
      registerCanvasBridge,
      placeToCanvas,
      msgs,
      busy,
      send,
      clearMsgs,
      listSessions,
      loadSession,
      deleteSession,
    }),
    [
      open,
      setOpen,
      toggle,
      canvasActive,
      canvasProjectName,
      harness,
      registerCanvasBridge,
      placeToCanvas,
      msgs,
      busy,
      send,
      clearMsgs,
      listSessions,
      loadSession,
      deleteSession,
    ]
  );

  return <FormscapeAiContext.Provider value={value}>{children}</FormscapeAiContext.Provider>;
}

export function useFormscapeAi(): FormscapeAiContextValue {
  const ctx = useContext(FormscapeAiContext);
  if (!ctx) {
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      console.warn("[formscape AI] useFormscapeAi 在 Provider 外调用，toggle/send 为空操作");
    }
    return {
      open: false,
      setOpen: () => undefined,
      toggle: () => undefined,
      canvasActive: false,
      canvasProjectName: null,
      harness: {
        workspaceSlug: "formscape",
        projectId: null,
        projectName: null,
        focusStage: null,
        canvasActive: false,
        sessionId: "none",
      },
      registerCanvasBridge: () => undefined,
      placeToCanvas: () => false,
      msgs: [],
      busy: false,
      send: () => undefined,
      clearMsgs: () => undefined,
      listSessions: () => [],
      loadSession: () => false,
      deleteSession: () => undefined,
    };
  }
  return ctx;
}

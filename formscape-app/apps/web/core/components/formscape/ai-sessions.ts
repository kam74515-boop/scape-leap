/**
 * AI 对话持久化（SQLite via fs-data-client，无 React/Next 依赖）
 * 供 ai-context 与 shipped 单测共用
 * 真源 = 服务端 SQLite（/api/fs/ai_sessions|ai_inbox）
 */
import { ensureFsHydrated, putFsDoc, readFsCache, registerFsEntity, replaceFsDocs } from "./fs-data-client";

export type AiStoredMsg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "agent"; text: string; toolTrace?: { tool: string }[] }
  | { id: string; role: "thinking" };

export type AiSessionArchive = {
  id: string;
  title: string;
  updatedAt: string;
  msgs: AiStoredMsg[];
};

export const AI_SESSIONS_CHANGE_EVENT = "fs-ai-sessions-change";
export const MAX_ARCHIVED = 20;

const AI_INBOX_MSGS_ID = "current-msgs";
const AI_INBOX_SESSION_ID = "current-session-id";

registerFsEntity("ai_sessions", AI_SESSIONS_CHANGE_EVENT);
registerFsEntity("ai_inbox", AI_SESSIONS_CHANGE_EVENT);
ensureFsHydrated(["ai_sessions", "ai_inbox"]);

export function newAiSessionId() {
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

type AiInboxDoc = { id: string; value: unknown };

function inboxGet<T>(id: string): T | null {
  const doc = readFsCache<AiInboxDoc>("ai_inbox").find((d) => d.id === id);
  return doc ? (doc.value as T) : null;
}

function inboxSet(id: string, value: unknown) {
  putFsDoc("ai_inbox", { id, value });
}

export function loadAiMsgs(): AiStoredMsg[] {
  const list = inboxGet<AiStoredMsg[]>(AI_INBOX_MSGS_ID);
  return Array.isArray(list) ? list.filter((m) => m.role !== "thinking") : [];
}

export function saveAiMsgs(msgs: AiStoredMsg[]) {
  inboxSet(AI_INBOX_MSGS_ID, msgs.filter((m) => m.role !== "thinking"));
}

export function loadAiSessionId(): string {
  const id = inboxGet<string>(AI_INBOX_SESSION_ID);
  if (id) return id;
  const next = newAiSessionId();
  inboxSet(AI_INBOX_SESSION_ID, next);
  return next;
}

export function persistAiSessionId(id: string) {
  inboxSet(AI_INBOX_SESSION_ID, id);
}

export function listAiSessions(): AiSessionArchive[] {
  return readFsCache<AiSessionArchive>("ai_sessions");
}

export function saveAiSessions(list: AiSessionArchive[]) {
  replaceFsDocs("ai_sessions", list.slice(0, MAX_ARCHIVED));
}

export function sessionTitleFrom(msgs: AiStoredMsg[]): string {
  const firstUser = msgs.find((m) => m.role === "user");
  const t = firstUser && "text" in firstUser ? firstUser.text.trim() : "";
  if (!t) return "空对话";
  return t.length > 28 ? `${t.slice(0, 28)}…` : t;
}

export function archiveSession(id: string, msgs: AiStoredMsg[]): AiSessionArchive[] {
  const clean = msgs.filter((m) => m.role !== "thinking");
  if (clean.length === 0) return listAiSessions();
  const archive: AiSessionArchive = {
    id,
    title: sessionTitleFrom(clean),
    updatedAt: new Date().toISOString(),
    msgs: clean,
  };
  const prev = listAiSessions().filter((s) => s.id !== id);
  const next = [archive, ...prev];
  saveAiSessions(next);
  return next;
}

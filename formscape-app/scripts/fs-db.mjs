/**
 * 构境 SQLite 仓储层（node:sqlite，零原生依赖）。
 * 文档式存储：entities(entity, id, data JSON, updated_at)。
 * 纯 I/O 小单元：HTTP 层（mock-api.mjs）与 vitest 都直接驱动这里。
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SEED_CUSTOMERS,
  SEED_DEMO_PROJECT,
  SEED_DRAFTS,
  SEED_FILES,
  SEED_MEMBERS,
  SEED_PROJECTS,
  SEED_SPACE_SCENE,
  seedProgress,
  seedPurchaseLines,
  seedStyleBoards,
  seedTasks,
} from "./fs-seed.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DB_PATH = path.resolve(__dirname, "../data/formscape.db");

/** 允许的业务实体（路由白名单） */
export const ENTITIES = [
  "tasks",
  "drafts",
  "drafts_hidden",
  "customers",
  "members",
  "projects",
  "purchase_lines",
  "style_boards",
  "style_stage",
  "render_stage",
  "progress",
  "space_scene",
  "canvas_docs",
  "ai_sessions",
  "ai_inbox",
  "files",
  "files_hidden",
  "construction",
  "extra_projects",
  "portal_state",
  "space_uploads",
  "demo_project",
  "gen_history",
  "canvas_boards",
];

const now = () => new Date().toISOString();

export function openFsDb(dbPath = process.env.FS_DB_PATH || DEFAULT_DB_PATH) {
  if (dbPath !== ":memory:") mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      entity TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (entity, id)
    );
    CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
    CREATE TABLE IF NOT EXISTS portal_shares (
      project_id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    );
  `);
  const seeded = db.prepare("SELECT v FROM meta WHERE k = 'seeded'").get();
  if (!seeded) {
    reseedFsDb(db);
  }
  return db;
}

/** 全量重播种子（建库初始化 / 测试与开发重置用） */
export function reseedFsDb(db) {
  const seeds = {
    tasks: seedTasks(),
    drafts: SEED_DRAFTS,
    drafts_hidden: [],
    customers: SEED_CUSTOMERS,
    members: SEED_MEMBERS,
    projects: SEED_PROJECTS,
    purchase_lines: seedPurchaseLines(),
    style_boards: seedStyleBoards(),
    style_stage: [],
    render_stage: [],
    progress: seedProgress(),
    space_scene: [SEED_SPACE_SCENE],
    canvas_docs: [],
    ai_sessions: [],
    ai_inbox: [],
    files: SEED_FILES,
    files_hidden: [],
    construction: [],
    extra_projects: [],
    portal_state: [],
    space_uploads: [],
    demo_project: [SEED_DEMO_PROJECT],
    gen_history: [],
    canvas_boards: [],
  };
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM entities");
    db.exec("DELETE FROM portal_shares");
    const ins = db.prepare("INSERT INTO entities (entity, id, data, updated_at) VALUES (?, ?, ?, ?)");
    for (const [entity, docs] of Object.entries(seeds)) {
      for (const doc of docs) {
        ins.run(entity, String(doc.id), JSON.stringify(doc), now());
      }
    }
    db.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('seeded', ?)").run(now());
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function listDocs(db, entity) {
  return db
    .prepare("SELECT data FROM entities WHERE entity = ? ORDER BY rowid")
    .all(entity)
    .map((r) => JSON.parse(r.data));
}

export function getDoc(db, entity, id) {
  const row = db.prepare("SELECT data FROM entities WHERE entity = ? AND id = ?").get(entity, String(id));
  return row ? JSON.parse(row.data) : null;
}

export function putDoc(db, entity, id, data) {
  db.prepare(
    "INSERT OR REPLACE INTO entities (entity, id, data, updated_at) VALUES (?, ?, ?, ?)"
  ).run(entity, String(id), JSON.stringify(data), now());
  return data;
}

export function deleteDoc(db, entity, id) {
  const r = db.prepare("DELETE FROM entities WHERE entity = ? AND id = ?").run(entity, String(id));
  return r.changes > 0;
}

/** 整体替换某实体集合（store 全量保存场景），docs 须含 id */
export function replaceDocs(db, entity, docs) {
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM entities WHERE entity = ?").run(entity);
    const ins = db.prepare("INSERT INTO entities (entity, id, data, updated_at) VALUES (?, ?, ?, ?)");
    for (const doc of docs) ins.run(entity, String(doc.id), JSON.stringify(doc), now());
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return docs.length;
}

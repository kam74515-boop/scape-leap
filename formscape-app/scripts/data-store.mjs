/**
 * 构境业务数据仓储。
 *
 * - 生产：PostgreSQL JSONB，支持事务、并发、索引与 pgvector。
 * - 本地：保留 node:sqlite 零配置回退，方便前端开发和单元测试。
 */
/* eslint-disable no-await-in-loop -- PostgreSQL transaction statements must preserve insertion order. */
import { existsSync } from "node:fs";
import { Pool } from "pg";
import {
  ENTITIES,
  deleteDoc as deleteSqliteDoc,
  getDoc as getSqliteDoc,
  listDocs as listSqliteDocs,
  openFsDb,
  putDoc as putSqliteDoc,
  replaceDocs as replaceSqliteDocs,
  reseedFsDb,
} from "./fs-db.mjs";

export { ENTITIES };

let storePromise;

function now() {
  return new Date().toISOString();
}

function postgresConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  return {
    connectionString,
    max: Number(process.env.DATABASE_POOL_SIZE || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "scapeleap-api",
  };
}

async function initializePostgres(pool) {
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS entities (
      entity TEXT NOT NULL,
      id TEXT NOT NULL,
      data JSONB NOT NULL,
      position BIGSERIAL NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (entity, id)
    );
    CREATE INDEX IF NOT EXISTS entities_entity_position_idx ON entities (entity, position);
    CREATE INDEX IF NOT EXISTS entities_data_gin_idx ON entities USING GIN (data jsonb_path_ops);

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS portal_shares (
      project_id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS portal_shares_expires_at_idx ON portal_shares (expires_at);
  `);
}

async function seedPostgres(store) {
  const sourcePath = process.env.FS_SQLITE_MIGRATION_PATH || process.env.FS_DB_PATH;
  const source =
    sourcePath && sourcePath !== ":memory:" && existsSync(sourcePath) ? openFsDb(sourcePath) : openFsDb(":memory:");
  const sourceKind = sourcePath && sourcePath !== ":memory:" && existsSync(sourcePath) ? "sqlite-migration" : "seed";
  const client = await store.pool.connect();

  try {
    await client.query("BEGIN");
    for (const entity of ENTITIES) {
      for (const doc of listSqliteDocs(source, entity)) {
        await client.query(
          `INSERT INTO entities (entity, id, data, updated_at)
           VALUES ($1, $2, $3::jsonb, NOW())
           ON CONFLICT (entity, id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
          [entity, String(doc.id), JSON.stringify(doc)]
        );
      }
    }
    const shares = source
      .prepare("SELECT project_id, token_hash, created_at, expires_at, revoked_at FROM portal_shares")
      .all();
    for (const share of shares) {
      await client.query(
        `INSERT INTO portal_shares (project_id, token_hash, created_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (project_id) DO UPDATE SET
           token_hash = EXCLUDED.token_hash,
           created_at = EXCLUDED.created_at,
           expires_at = EXCLUDED.expires_at,
           revoked_at = EXCLUDED.revoked_at`,
        [share.project_id, share.token_hash, share.created_at, share.expires_at, share.revoked_at]
      );
    }
    await client.query(
      `INSERT INTO meta (key, value)
       VALUES ('seeded', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify({ at: now(), source: sourceKind })]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    source.close();
  }
}

async function openStore() {
  const config = postgresConfig();
  if (!config) {
    return { driver: "node:sqlite", sqlite: openFsDb() };
  }

  const pool = new Pool(config);
  pool.on("error", (error) => console.error("[postgres-pool]", error));
  await initializePostgres(pool);
  const { rows } = await pool.query("SELECT EXISTS (SELECT 1 FROM meta WHERE key = 'seeded') AS seeded");
  const store = { driver: "postgresql", pool };
  if (!rows[0]?.seeded) await seedPostgres(store);
  return store;
}

export function getDataStore() {
  if (!storePromise) storePromise = openStore();
  return storePromise;
}

export async function listDocs(store, entity) {
  if (store.driver === "node:sqlite") return listSqliteDocs(store.sqlite, entity);
  const { rows } = await store.pool.query("SELECT data FROM entities WHERE entity = $1 ORDER BY position", [entity]);
  return rows.map((row) => row.data);
}

export async function getDoc(store, entity, id) {
  if (store.driver === "node:sqlite") return getSqliteDoc(store.sqlite, entity, id);
  const { rows } = await store.pool.query("SELECT data FROM entities WHERE entity = $1 AND id = $2", [
    entity,
    String(id),
  ]);
  return rows[0]?.data ?? null;
}

export async function putDoc(store, entity, id, data) {
  if (store.driver === "node:sqlite") return putSqliteDoc(store.sqlite, entity, id, data);
  await store.pool.query(
    `INSERT INTO entities (entity, id, data, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (entity, id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [entity, String(id), JSON.stringify(data)]
  );
  return data;
}

export async function deleteDoc(store, entity, id) {
  if (store.driver === "node:sqlite") return deleteSqliteDoc(store.sqlite, entity, id);
  const result = await store.pool.query("DELETE FROM entities WHERE entity = $1 AND id = $2", [entity, String(id)]);
  return result.rowCount > 0;
}

export async function replaceDocs(store, entity, docs) {
  if (store.driver === "node:sqlite") return replaceSqliteDocs(store.sqlite, entity, docs);
  const client = await store.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM entities WHERE entity = $1", [entity]);
    for (const doc of docs) {
      await client.query("INSERT INTO entities (entity, id, data, updated_at) VALUES ($1, $2, $3::jsonb, NOW())", [
        entity,
        String(doc.id),
        JSON.stringify(doc),
      ]);
    }
    await client.query("COMMIT");
    return docs.length;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function reseedDataStore(store) {
  if (store.driver === "node:sqlite") {
    reseedFsDb(store.sqlite);
    return;
  }
  const source = openFsDb(":memory:");
  const client = await store.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM entities");
    await client.query("DELETE FROM portal_shares");
    for (const entity of ENTITIES) {
      for (const doc of listSqliteDocs(source, entity)) {
        await client.query("INSERT INTO entities (entity, id, data, updated_at) VALUES ($1, $2, $3::jsonb, NOW())", [
          entity,
          String(doc.id),
          JSON.stringify(doc),
        ]);
      }
    }
    await client.query(
      `INSERT INTO meta (key, value)
       VALUES ('seeded', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify({ at: now(), source: "reseed" })]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    source.close();
  }
}

export async function countDocs(store) {
  if (store.driver === "node:sqlite") {
    return Object.fromEntries(ENTITIES.map((entity) => [entity, listSqliteDocs(store.sqlite, entity).length]));
  }
  const { rows } = await store.pool.query("SELECT entity, COUNT(*)::integer AS count FROM entities GROUP BY entity");
  const counts = Object.fromEntries(ENTITIES.map((entity) => [entity, 0]));
  for (const row of rows) counts[row.entity] = row.count;
  return counts;
}

export async function getPortalShare(store, projectId) {
  if (store.driver === "node:sqlite") {
    return store.sqlite
      .prepare(
        "SELECT project_id, token_hash, created_at, expires_at, revoked_at FROM portal_shares WHERE project_id = ?"
      )
      .get(projectId);
  }
  const { rows } = await store.pool.query(
    "SELECT project_id, token_hash, created_at, expires_at, revoked_at FROM portal_shares WHERE project_id = $1",
    [projectId]
  );
  return rows[0] ?? null;
}

export async function savePortalShare(store, share) {
  if (store.driver === "node:sqlite") {
    store.sqlite
      .prepare(
        `INSERT OR REPLACE INTO portal_shares
           (project_id, token_hash, created_at, expires_at, revoked_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(share.projectId, share.tokenHash, share.createdAt, share.expiresAt, share.revokedAt ?? null);
    return;
  }
  await store.pool.query(
    `INSERT INTO portal_shares (project_id, token_hash, created_at, expires_at, revoked_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (project_id) DO UPDATE SET
       token_hash = EXCLUDED.token_hash,
       created_at = EXCLUDED.created_at,
       expires_at = EXCLUDED.expires_at,
       revoked_at = EXCLUDED.revoked_at`,
    [share.projectId, share.tokenHash, share.createdAt, share.expiresAt, share.revokedAt ?? null]
  );
}

export async function revokePortalShare(store, projectId, revokedAt) {
  if (store.driver === "node:sqlite") {
    store.sqlite.prepare("UPDATE portal_shares SET revoked_at = ? WHERE project_id = ?").run(revokedAt, projectId);
    return;
  }
  await store.pool.query("UPDATE portal_shares SET revoked_at = $1 WHERE project_id = $2", [revokedAt, projectId]);
}

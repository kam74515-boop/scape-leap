/**
 * SQLite 仓储层直测（scripts/fs-db.mjs，node:sqlite 文件库）。
 * 证明：真实库文件写入 → 关闭 → 重开（模拟服务端重启）→ 数据仍在。
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, test } from "vitest";
// @ts-expect-error 仓库层为纯 ESM .mjs（无类型声明）
import { deleteDoc, getDoc, listDocs, openFsDb, putDoc, replaceDocs } from "../../../../../../scripts/fs-db.mjs";

const dir = mkdtempSync(path.join(tmpdir(), "fs-db-test-"));
const dbFile = path.join(dir, "test.db");

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("fs-db 仓储层（真实 SQLite 文件库）", () => {
  test("建库自动播种：projects/tasks/customers/progress 非空", () => {
    const db = openFsDb(dbFile);
    expect(listDocs(db, "projects").length).toBeGreaterThan(0);
    expect(listDocs(db, "tasks").length).toBeGreaterThan(0);
    expect(listDocs(db, "customers").length).toBeGreaterThan(0);
    expect(listDocs(db, "progress").length).toBeGreaterThan(0);
    db.close();
  });

  test("写入 → 关闭 → 重开（= 服务端重启）→ 数据仍在", () => {
    const db1 = openFsDb(dbFile);
    putDoc(db1, "tasks", "persist-proof", { id: "persist-proof", title: "重启持久化", state: "todo" });
    db1.close();

    const db2 = openFsDb(dbFile);
    const doc = getDoc(db2, "tasks", "persist-proof");
    expect(doc?.title).toBe("重启持久化");
    db2.close();
  });

  test("replaceDocs 整体替换 + deleteDoc 删除", () => {
    const db = openFsDb(dbFile);
    replaceDocs(db, "purchase_lines", [
      { id: "pl-a", qty: 1 },
      { id: "pl-b", qty: 2 },
    ]);
    expect(listDocs(db, "purchase_lines").map((d: { id: string }) => d.id)).toEqual(["pl-a", "pl-b"]);
    expect(deleteDoc(db, "purchase_lines", "pl-a")).toBe(true);
    expect(getDoc(db, "purchase_lines", "pl-a")).toBeNull();
    expect(deleteDoc(db, "purchase_lines", "pl-a")).toBe(false);
    db.close();
  });
});

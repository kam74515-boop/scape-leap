/** fs-db.mjs 类型声明（手写最小面，供 vitest/tsc 消费） */
export const DEFAULT_DB_PATH: string;
export const ENTITIES: string[];

export interface FsDbHandle {
  prepare(sql: string): unknown;
  exec(sql: string): unknown;
  close(): void;
}

export declare function openFsDb(dbPath?: string): FsDbHandle;
export declare function reseedFsDb(db: FsDbHandle): void;
export declare function listDocs<T = unknown>(db: FsDbHandle, entity: string): T[];
export declare function getDoc<T = unknown>(db: FsDbHandle, entity: string, id: string): T | null;
export declare function putDoc<T>(db: FsDbHandle, entity: string, id: string, data: T): T;
export declare function deleteDoc(db: FsDbHandle, entity: string, id: string): boolean;
export declare function replaceDocs<T extends { id: string }>(db: FsDbHandle, entity: string, docs: T[]): number;

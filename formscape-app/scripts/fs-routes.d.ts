/** fs-routes.mjs 类型声明（手写最小面） */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { FsDbHandle } from "./fs-db";

export declare function getFsDb(): FsDbHandle;
export declare function handleFsRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  method: string
): Promise<void>;

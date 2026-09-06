export { xltFastifyPlugin, xltFastifyErrorHandler } from "./plugin.js";

export { createFastifyContext } from "./context.js";
export { mapXltError, type MappedXltError } from "./map-xlt-error.js";
export {
  matchPolicy,
  mergeRouteAuthMeta,
  resolveRouteAuthMeta,
  resolveRouteConfigMeta,
  shouldCheckLogin,
} from "./resolve-auth-meta.js";
export { runAuth } from "./run-auth.js";

export type {
  XltAuthMatcher,
  XltFastifyOptions,
  XltRouteAuthMeta,
  XltRoutePolicy,
} from "./types.js";

// 核心类型（来自 @xlt-token/core）
export type { XltInstance } from "@xlt-token/core";
export { createXltInstance, MemoryStore, UuidStrategy, XltMode } from "@xlt-token/core";

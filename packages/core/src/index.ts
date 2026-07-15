export {
  NotLoginType,
  XLT_IGNORE_KEY,
  XLT_CHECK_LOGIN_KEY,
  XltMode,
  XLT_PERMISSION_KEY,
  XLT_ROLE_KEY,
} from "./const/index.js";

export type {
  JwtConfig,
  DeviceInfo,
  XltTokenConfig,
  DurationUnit,
  DurationString,
  DurationInput,
  XltTokenConfigInput,
} from "./config/xlt-token-config.js";
export {
  DEFAULT_XLT_TOKEN_CONFIG,
  XLT_TOKEN_CONFIG,
  XLT_TOKEN_STORE,
  XLT_TOKEN_STRATEGY,
} from "./config/xlt-token-config.js";

export { XltTokenKeys } from "./config/xlt-token-keys.js";

export {
  normalizeTokenLifecycleConfig,
  type NormalizedTokenExpirationConfig,
  type NormalizedTokenLifecycleConfig,
  type NormalizedTokenRefreshConfig,
  type TokenExpirationConfig,
  type TokenLifecycleConfig,
  type TokenRefreshConfig,
} from "./lifecycle/token-lifecycle.js";
export type {
  RefreshResult,
  RevokeResult,
  RevokeScope,
  TokenFamilyState,
  TokenFamilyStatus,
} from "./lifecycle/token-state.js";

export type {
  StoreEntry,
  StoreScanOptions,
  StoreScanResult,
  StoreTtl,
  StoreTtlUpdate,
  XltTokenStore,
} from "./store/xlt-token-store.interface.js";
export { finiteTtl, keepTtl, persistentTtl } from "./store/xlt-token-store.interface.js";
export { MemoryStore } from "./store/memory-store.js";

export type { TokenStrategy } from "./token/token-strategy.interface.js";
export { UuidStrategy } from "./token/uuid-strategy.js";

export type { XltAuditEvent, XltAuditEventType } from "./events/xlt-audit-event.js";
export type { XltEventSink } from "./events/xlt-event-sink.js";
export { XLT_EVENT_SINK } from "./events/xlt-event-sink.js";

export type { StpInterface } from "./perm/stp-interface.js";
export { XLT_STP_INTERFACE } from "./perm/stp-interface.js";
export { matchPermission } from "./perm/perm-pattern-match.js";

export type {
  CookieOptions,
  HttpContext,
  HttpCookies,
  HttpHeaders,
  HttpQuery,
} from "./http/context.js";
export {
  createExpressContext,
  type ExpressLikeRequest,
  type ExpressLikeResponse,
} from "./http/express.js";
export { createMockHttpContext, type MockHttpContextOptions } from "./http/testing.js";

export { XltError, type XltErrorCode, type XltErrorDetails } from "./exceptions/xlt-error.js";
export { NotLoginException } from "./exceptions/not-login.exception.js";
export { NotPermissionException } from "./exceptions/not-permission.exception.js";
export { NotRoleException } from "./exceptions/not-role.exception.js";
export { NotSafeException } from "./exceptions/not-safe.exception.js";

export { XltSession } from "./session/xlt-session.js";

export { StpLogic, type AuthResult } from "./auth/stp-logic.js";
export { StpPermLogic } from "./auth/stp-perm-logic.js";
export { StpUtil, setStpLogic, setStpPermLogic } from "./auth/stp-util.js";

export { createXltToken, type CreateOptions, type XltTokenContext } from "./factory.js";

export { normalizeDuration, normalizeXltTokenConfig } from "./time/duration.js";
export type { NormalizeDurationOptions } from "./time/duration.js";

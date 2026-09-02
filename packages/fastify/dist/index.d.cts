import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AuthResult, HttpContext, MemoryStore, UuidStrategy, XltInstance, XltInstance as XltInstance$1, XltMode, XltSession, createXltInstance } from "@xlt-token/core";

//#region src/types.d.ts
/**
 * 路由级鉴权元数据。
 *
 * 可以通过两种方式声明：
 * 1. 路由 `config.xlt`（Fastify 路由配置，只作用于该路由）
 * 2. 插件级 `policies`（前缀 / 正则 / 函数匹配，作用于匹配到的路由）
 *
 * 同一路由同时命中两者时：`config.xlt` 的简单字段覆盖 policies，
 * permissions / roles 列表合并（mode 取 `config.xlt` 的声明）。
 */
interface XltRouteAuthMeta {
  /** 跳过登录校验（黑名单模式下的白名单） */
  ignore?: boolean;
  /** 声明需要登录（白名单模式下开启校验） */
  requireLogin?: boolean;
  permissions?: {
    list: string[];
    mode: XltMode;
  };
  roles?: {
    list: string[];
    mode: XltMode;
  };
  /** 需要二级认证（安全窗口）的业务名 */
  safeBusiness?: string;
}
type XltAuthMatcher = string | RegExp | ((request: FastifyRequest) => boolean);
interface XltRoutePolicy extends XltRouteAuthMeta {
  match: XltAuthMatcher | XltAuthMatcher[];
  methods?: string[];
}
interface XltFastifyOptions {
  /** 必填：显式认证实例。插件不读取默认实例或 StpUtil。 */
  instance: XltInstance$1;
  /** 快捷白名单（路径前缀匹配），等价于 `{ match, ignore: true }` 策略 */
  ignore?: XltAuthMatcher[];
  /** 插件级鉴权策略 */
  policies?: XltRoutePolicy[];
  /**
   * 鉴权失败时是否抛出异常交给自定义 error handler。
   * 默认 `false`：插件直接回复 401 / 403 JSON（与 Express / NestJS 响应体一致）。
   */
  propagateAuthErrors?: boolean;
}
declare module "fastify" {
  interface FastifyContextConfig {
    xlt?: XltRouteAuthMeta;
  }
  interface FastifyRequest {
    /** 鉴权成功后的登录 ID（由 preHandler 写入） */
    stpLoginId?: string;
    /** 鉴权成功后的 token（由 preHandler 写入） */
    stpToken?: string;
    /** 鉴权成功后的会话（由 preHandler 写入，懒加载数据） */
    stpSession?: XltSession;
  }
} //# sourceMappingURL=types.d.ts.map
//#endregion
//#region src/plugin.d.ts
declare function xltFastify(fastify: FastifyInstance, options: XltFastifyOptions): Promise<void>;
/**
 * xlt-token 的 Fastify 插件。
 *
 * 通过 `preHandler` Hook 完成登录 / 权限 / 角色 / 二级认证校验，
 * 只接收显式 `XltInstance`，不读取默认实例或 `StpUtil`。
 *
 * @example
 * ```ts
 * import Fastify from "fastify";
 * import { createXltInstance } from "@xlt-token/core";
 * import { xltFastifyPlugin } from "@xlt-token/fastify";
 *
 * const instance = createXltInstance();
 * const app = Fastify();
 * await app.register(xltFastifyPlugin, { instance });
 * app.get("/me", async (request) => ({ id: request.stpLoginId }));
 * ```
 */
declare const xltFastifyPlugin: typeof xltFastify;
/**
 * Fastify error handler：将 core 鉴权异常转为 401 / 403 JSON，其余透传默认处理。
 * 配合 `propagateAuthErrors: true` 使用（插件抛出异常时由它统一回复）。
 *
 * @example
 * ```ts
 * app.setErrorHandler(xltFastifyErrorHandler());
 * await app.register(xltFastifyPlugin, { instance, propagateAuthErrors: true });
 * ```
 */
declare function xltFastifyErrorHandler(): (error: unknown, _request: FastifyRequest, reply: FastifyReply) => void;
//#endregion
//#region src/context.d.ts
/**
 * 将 Fastify `request` / `reply` 适配为 core 的 `HttpContext`。
 *
 * - Header / Query 读取直接映射 Fastify 原生对象
 * - Cookie 读取依赖 `@fastify/cookie` 提供的同步 `request.cookies`（未注册时读取恒为 null）
 * - 写回 header 使用 `reply.header`，写回 cookie 使用 `reply.setCookie`
 *
 * `state` 挂在 `request._xltState` 上，保证同一请求多次桥接拿到同一引用
 * （与 Express 桥接的字段命名一致）。
 */
declare function createFastifyContext(request: FastifyRequest, reply: FastifyReply): HttpContext;
//#endregion
//#region src/map-xlt-error.d.ts
interface MappedXltError {
  status: number;
  body: Record<string, unknown>;
}
/**
 * 将 core 鉴权异常映射为 HTTP 状态码 + JSON body。
 *
 * 响应体结构与 Express / NestJS 适配器保持一致（`statusCode` / `code` / core 异常 details / `message`）。
 * 非 xlt-token 异常返回 `null`，交由调用方继续向后传递。
 */
declare function mapXltError(err: unknown): MappedXltError | null;
//#endregion
//#region src/resolve-auth-meta.d.ts
/** 判断单条策略是否命中当前请求（URL 与 method 均匹配才命中）。 */
declare function matchPolicy(request: FastifyRequest, policy: XltRoutePolicy): boolean;
/**
 * 合并两段路由元数据：
 * - `ignore` / `requireLogin` / `safeBusiness` 等简单字段：后者覆盖前者
 * - `permissions` / `roles`：两者都存在时合并列表，mode 取后者
 */
declare function mergeRouteAuthMeta(base: XltRouteAuthMeta, next: XltRouteAuthMeta): XltRouteAuthMeta;
/**
 * 解析插件级策略命中的路由鉴权元数据。
 *
 * 使用 `request.url`（含 query 的原始 URL）作为匹配目标，
 * 行为与 Express 的 `req.originalUrl` 匹配一致。多条策略命中时后者覆盖前者，
 * 可先声明 `/api` 默认策略再声明 `/api/public` 例外。
 */
declare function resolveRouteAuthMeta(request: FastifyRequest, options?: Pick<XltFastifyOptions, "ignore" | "policies">): XltRouteAuthMeta;
/**
 * 路由 `config.xlt` 的运行时读取。
 */
declare function resolveRouteConfigMeta(request: FastifyRequest): XltRouteAuthMeta;
/**
 * 是否需要对当前请求执行登录校验。
 *
 * 与 Express / NestJS 行为一致：
 * - 黑名单模式（`defaultCheck === true`）：除 `ignore` 标记外全部校验
 * - 白名单模式（`defaultCheck === false`）：仅校验 `requireLogin` 标记的路由
 */
declare function shouldCheckLogin(meta: XltRouteAuthMeta, defaultCheck: boolean): boolean;
//#endregion
//#region src/run-auth.d.ts
/**
 * 编排登录 + 权限 + 角色 + 二级认证校验。
 *
 * 与 Express `runAuth` / NestJS `XltTokenGuard.canActivate` 的权限块逻辑等价：
 * `checkLogin` 失败抛 `NotLoginException`，权限 / 角色 / safe 校验失败分别抛对应异常。
 */
declare function runAuth(instance: XltInstance$1, httpCtx: HttpContext, meta: XltRouteAuthMeta): Promise<AuthResult>;
//#endregion
export { type MappedXltError, MemoryStore, UuidStrategy, type XltAuthMatcher, type XltFastifyOptions, type XltInstance, type XltRouteAuthMeta, type XltRoutePolicy, createFastifyContext, createXltInstance, mapXltError, matchPolicy, mergeRouteAuthMeta, resolveRouteAuthMeta, resolveRouteConfigMeta, runAuth, shouldCheckLogin, xltFastifyErrorHandler, xltFastifyPlugin };
//# sourceMappingURL=index.d.cts.map
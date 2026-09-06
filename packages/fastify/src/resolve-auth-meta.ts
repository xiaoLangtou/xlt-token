import type { FastifyRequest } from "fastify";
import type {
  XltAuthMatcher,
  XltRouteAuthMeta,
  XltRoutePolicy,
  XltFastifyOptions,
} from "./types.js";

function matchPathPrefix(path: string, prefix: string): boolean {
  const pathname = decodeURI(path.split("?")[0]!);
  const normalized = prefix.replace(/\/+$/, "") || "/";
  return normalized === "/" || pathname === normalized || pathname.startsWith(`${normalized}/`);
}

function matchersOf(policy: XltRoutePolicy): XltAuthMatcher[] {
  return Array.isArray(policy.match) ? policy.match : [policy.match];
}

/** 判断单条策略是否命中当前请求（URL 与 method 均匹配才命中）。 */
export function matchPolicy(request: FastifyRequest, policy: XltRoutePolicy): boolean {
  if (policy.methods?.length) {
    const method = request.method.toUpperCase();
    const allowed = policy.methods.map((m) => m.toUpperCase());
    if (!allowed.includes(method) && !(method === "HEAD" && allowed.includes("GET"))) return false;
  }

  return matchersOf(policy).some((matcher) => {
    if (typeof matcher === "function") return matcher(request);
    if (typeof matcher === "string") {
      return matchPathPrefix(request.url, matcher);
    }
    return new RegExp(matcher.source, matcher.flags).test(decodeURI(request.url.split("?")[0]!));
  });
}

/**
 * 合并两段路由元数据：
 * - `ignore` / `requireLogin` / `safeBusiness` 等简单字段：后者覆盖前者
 * - `permissions` / `roles`：两者都存在时合并列表，mode 取后者
 */
export function mergeRouteAuthMeta(
  base: XltRouteAuthMeta,
  next: XltRouteAuthMeta,
): XltRouteAuthMeta {
  const merged: XltRouteAuthMeta = { ...base, ...next };

  if (base.permissions && next.permissions) {
    merged.permissions = {
      list: [...base.permissions.list, ...next.permissions.list],
      mode: next.permissions.mode,
    };
  }

  if (base.roles && next.roles) {
    merged.roles = {
      list: [...base.roles.list, ...next.roles.list],
      mode: next.roles.mode,
    };
  }

  return merged;
}

/**
 * 解析插件级策略命中的路由鉴权元数据。
 *
 * 使用 `request.url`（含 query 的原始 URL）作为匹配目标，
 * 行为与 Express 的 `req.originalUrl` 匹配一致。多条策略命中时后者覆盖前者，
 * 可先声明 `/api` 默认策略再声明 `/api/public` 例外。
 */
export function resolveRouteAuthMeta(
  request: FastifyRequest,
  options: Pick<XltFastifyOptions, "ignore" | "policies"> = {},
): XltRouteAuthMeta {
  const policies: XltRoutePolicy[] = [
    ...(options.ignore ?? []).map((match) => ({ match, ignore: true })),
    ...(options.policies ?? []),
  ];

  return policies.reduce<XltRouteAuthMeta>((meta, policy) => {
    if (!matchPolicy(request, policy)) return meta;
    const { match: _match, methods: _methods, ...nextMeta } = policy;
    return mergeRouteAuthMeta(meta, nextMeta);
  }, {});
}

/**
 * 路由 `config.xlt` 的运行时读取。
 */
export function resolveRouteConfigMeta(request: FastifyRequest): XltRouteAuthMeta {
  const config = request.routeOptions?.config as { xlt?: XltRouteAuthMeta } | undefined;
  return config?.xlt ?? {};
}

/**
 * 是否需要对当前请求执行登录校验。
 *
 * 与 Express / NestJS 行为一致：
 * - 黑名单模式（`defaultCheck === true`）：除 `ignore` 标记外全部校验
 * - 白名单模式（`defaultCheck === false`）：仅校验 `requireLogin` 标记的路由
 */
export function shouldCheckLogin(meta: XltRouteAuthMeta, defaultCheck: boolean): boolean {
  if (defaultCheck) {
    return !meta?.ignore;
  }
  return Boolean(
    meta.requireLogin || meta.permissions || meta.roles || meta.safeBusiness !== undefined,
  );
}

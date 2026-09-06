import type { Request } from "express";
import type { RouteAuthMeta, RouteAuthPolicy, XltMiddlewareOptions } from "../types.js";

export function matchPathPrefix(path: string, prefix: string): boolean {
  const pathname = path.split("?")[0]!.toLowerCase();
  const normalized = prefix.replace(/\/+$/, "").toLowerCase() || "/";
  return normalized === "/" || pathname === normalized || pathname.startsWith(`${normalized}/`);
}

/**
 * 解析当前请求命中的路由鉴权元数据。
 *
 * 在 `shouldCheckLogin` 和 `runAuth` 之前调用，使用 `req.originalUrl` 作为匹配目标，
 * 避免 Router 嵌套时 `req.path` 丢失挂载前缀。
 *
 * 当多条策略同时命中时，后声明的策略覆盖前者的简单字段，并合并权限/角色列表，
 * 因此用户可先声明 `/api` 默认策略，再声明 `/api/public` 例外。
 */
export function resolveRouteAuthMeta(
  req: Request,
  options: XltMiddlewareOptions = {},
): RouteAuthMeta {
  const policies: RouteAuthPolicy[] = [
    ...(options.ignore ?? []).map((match) => ({ match, ignore: true })),
    ...(options.policies ?? []),
  ];

  return policies.reduce<RouteAuthMeta>((meta, policy) => {
    if (!matchPolicy(req, policy)) return meta;
    const { match: _match, methods: _methods, ...nextMeta } = policy;
    return mergeRouteAuthMeta(meta, nextMeta);
  }, {});
}

/** 判断单条策略是否命中当前请求。 */
export function matchPolicy(req: Request, policy: RouteAuthPolicy): boolean {
  if (policy.methods?.length) {
    const method = req.method.toUpperCase();
    const allowed = policy.methods.map((m) => m.toUpperCase());
    if (!allowed.includes(method) && !(method === "HEAD" && allowed.includes("GET"))) return false;
  }

  const matchers = Array.isArray(policy.match) ? policy.match : [policy.match];
  return matchers.some((matcher) => {
    if (typeof matcher === "function") return matcher(req);
    if (typeof matcher === "string") {
      return matchPathPrefix(req.originalUrl, matcher);
    }
    return new RegExp(matcher.source, matcher.flags).test(req.originalUrl.split("?")[0]!);
  });
}

/**
 * 合并两段路由元数据：
 * - `ignore` / `requireLogin` / `safeBusiness` 等简单字段：后者覆盖前者
 * - `permissions` / `roles`：两者都存在时合并列表，mode 取后者
 */
export function mergeRouteAuthMeta(base: RouteAuthMeta, next: RouteAuthMeta): RouteAuthMeta {
  const merged: RouteAuthMeta = { ...base, ...next };

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

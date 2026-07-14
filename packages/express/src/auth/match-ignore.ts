import type { Request } from "express";
import type { AuthMatcher } from "../types.js";

function matchPathPrefix(path: string, prefix: string): boolean {
  const pathname = path.split("?")[0] ?? path;
  return prefix === "/" || pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * 路径白名单快捷判断，`resolveRouteAuthMeta` 的简化分支。
 * 对外保留便于单测和高级用户直接调用。
 */
export function matchIgnore(req: Request, rules?: AuthMatcher[]): boolean {
  if (!rules?.length) return false;

  return rules.some((rule) => {
    if (typeof rule === "function") return rule(req);
    if (typeof rule === "string") {
      return matchPathPrefix(req.originalUrl, rule);
    }
    return rule.test(req.originalUrl);
  });
}

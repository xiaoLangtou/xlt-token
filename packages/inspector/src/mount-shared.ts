import type { InspectorRequest } from "./bridge.js";
import { INSPECTOR_HTML } from "./inspector-page.js";

export interface MountInspectorOptions {
  prefix?: string;
}

/**
 * bridge 路由 → HTTP 后缀的统一映射表。
 * `path` 是 bridge 空间路径；`suffix` 拼在挂载前缀之后。
 */
export const BRIDGE_ROUTE_TABLE: readonly {
  method: "GET" | "POST";
  suffix: string;
  path: string;
}[] = [
  { method: "GET", suffix: "/api/overview", path: "/overview" },
  { method: "GET", suffix: "/api/events", path: "/events" },
  { method: "GET", suffix: "/api/metrics", path: "/metrics" },
  { method: "GET", suffix: "/api/sessions", path: "/sessions" },
  { method: "GET", suffix: "/api/session-devices", path: "/session-devices" },
  { method: "POST", suffix: "/api/actions/kickout", path: "/actions/kickout" },
  { method: "POST", suffix: "/api/actions/logout", path: "/actions/logout" },
];

export interface IncomingRequestLike {
  method?: string;
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, unknown>;
}

/** 把框架请求映射为 bridge 请求（各挂载胶水与示例共用） */
export function buildInspectorRequest(
  bridgePath: string,
  source: IncomingRequestLike,
): InspectorRequest {
  const query: InspectorRequest["query"] = {};
  if (source.query) {
    for (const [key, value] of Object.entries(source.query)) {
      if (typeof value === "string" || Array.isArray(value)) query[key] = value;
      else if (value !== undefined && value !== null) query[key] = String(value);
    }
  }

  return {
    method: (source.method ?? "GET").toUpperCase(),
    path: bridgePath,
    query,
    body: source.body,
    headers: (source.headers ?? {}) as Record<string, unknown>,
    raw: source,
  };
}

export { INSPECTOR_HTML };

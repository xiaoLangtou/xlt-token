import type { InspectorBridge } from "./bridge.js";
import {
  BRIDGE_ROUTE_TABLE,
  buildInspectorRequest,
  INSPECTOR_HTML,
  type IncomingRequestLike,
  type MountInspectorOptions,
} from "./mount-shared.js";

interface ExpressResponseLike {
  status?: (code: number) => ExpressResponseLike;
  type?: (value: string) => ExpressResponseLike;
  setHeader?: (name: string, value: string) => unknown;
  send: (body: unknown) => unknown;
}

interface ExpressLike {
  get(route: string, ...rest: any[]): unknown;
  post(route: string, ...rest: any[]): unknown;
}

/**
 * 把监控台挂到 Express 应用（结构化类型，无需编译期依赖 express）：
 *
 * - `GET {prefix}`          → 单文件监控页
 * - `GET/POST {prefix}/api/*` → bridge 数据接口
 *
 * 建议在挂载前叠加应用自身的权限中间件（或依赖 bridge 的 `auth` 回调）。
 */
export function mountInspectorOnExpress(
  app: ExpressLike,
  bridge: InspectorBridge,
  options: MountInspectorOptions = {},
): void {
  const prefix = options.prefix ?? "/inspector";

  app.get(prefix, (...args: any[]) => {
    const reply = args[1] as ExpressResponseLike;
    if (reply.type) reply.type("text/html; charset=utf-8");
    else if (reply.setHeader) reply.setHeader("Content-Type", "text/html; charset=utf-8");
    reply.send(INSPECTOR_HTML);
  });

  for (const route of BRIDGE_ROUTE_TABLE) {
    const register = route.method === "GET" ? app.get.bind(app) : app.post.bind(app);
    register(prefix + route.suffix, async (...args: any[]) => {
      const request = args[0] as IncomingRequestLike;
      const reply = args[1] as ExpressResponseLike;
      const response = await bridge.handle(buildInspectorRequest(route.path, request));
      if (reply.status) reply.status(response.status);
      reply.send(response.body);
    });
  }
}

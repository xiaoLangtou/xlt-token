import type { InspectorBridge } from "./bridge.js";
import {
  BRIDGE_ROUTE_TABLE,
  buildInspectorRequest,
  INSPECTOR_HTML,
  type IncomingRequestLike,
  type MountInspectorOptions,
} from "./mount-shared.js";

interface FastifyReplyLike {
  status?: (code: number) => unknown;
  type?: (value: string) => unknown;
  send: (body: unknown) => unknown;
}

interface FastifyLike {
  get(route: string, ...rest: any[]): unknown;
  post(route: string, ...rest: any[]): unknown;
}

/**
 * 把监控台挂到 Fastify 实例（结构化类型，无需编译期依赖 fastify）：
 *
 * - `GET {prefix}`          → 单文件监控页
 * - `GET/POST {prefix}/api/*` → bridge 数据接口
 *
 * 页面与接口的鉴权由 bridge 的 `auth` 回调决定（页面本身无鉴权语义）。
 */
export function mountInspectorOnFastify(
  app: FastifyLike,
  bridge: InspectorBridge,
  options: MountInspectorOptions = {},
): void {
  const prefix = options.prefix ?? "/inspector";

  app.get(prefix, (...args: any[]) => {
    const reply = args[1] as FastifyReplyLike;
    if (reply.type) reply.type("text/html; charset=utf-8");
    reply.send(INSPECTOR_HTML);
  });

  for (const route of BRIDGE_ROUTE_TABLE) {
    const register = route.method === "GET" ? app.get.bind(app) : app.post.bind(app);
    register(prefix + route.suffix, async (...args: any[]) => {
      const request = args[0] as IncomingRequestLike;
      const reply = args[1] as FastifyReplyLike;
      const response = await bridge.handle(buildInspectorRequest(route.path, request));
      if (reply.status) reply.status(response.status);
      reply.send(response.body);
    });
  }
}

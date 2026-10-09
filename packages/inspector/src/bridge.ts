import { createHash } from "node:crypto";
import type { DeviceInfo, XltInstance } from "@xlt-token/core";
import type { EventBuffer } from "./event-buffer.js";

/**
 * 监控台请求。`headers` / `raw` 由挂载胶水透传原始框架请求，
 * 供 `auth` 回调做鉴权决策；bridge 自身不读取凭据。
 */
export interface InspectorRequest {
  method: string;
  /** bridge 空间路径（不含挂载前缀），如 "/overview" */
  path: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
  headers?: Record<string, unknown>;
  raw?: unknown;
}

export interface InspectorResponse {
  status: number;
  body: unknown;
}

export interface InspectorAuthContext {
  /** Bearer token（如请求携带且可解析） */
  bearerToken?: string;
}

export interface InspectorBridgeOptions {
  /** 监控目标实例；支持懒求值（适配模块化容器延迟初始化） */
  instance: XltInstance | (() => XltInstance);
  /** 审计事件缓冲（来自 createEventBufferSink） */
  buffer: EventBuffer;
  /**
   * 必填鉴权回调：返回 false 时所有接口返回 403。
   * 这是强制项——监控台暴露会话与事件数据，必须在宿主侧接好权限。
   */
  auth: (request: InspectorRequest, context: InspectorAuthContext) => boolean | Promise<boolean>;
  /** 是否开放踢人 / 强制下线动作（默认 false，只读监控） */
  allowMutations?: boolean;
}

export interface InspectorBridge {
  handle(request: InspectorRequest): Promise<InspectorResponse>;
}

/** 路由清单：挂载胶水据此注册端点 */
export const INSPECTOR_ROUTES = [
  { method: "GET", path: "/overview" },
  { method: "GET", path: "/events" },
  { method: "GET", path: "/metrics" },
  { method: "GET", path: "/sessions" },
  { method: "GET", path: "/session-devices" },
  { method: "POST", path: "/actions/kickout" },
  { method: "POST", path: "/actions/logout" },
] as const;

interface SanitizedDevice {
  device: string;
  tokenFingerprint: string;
  loginTime: number;
}

function fingerprintToken(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

function queryValue(query: InspectorRequest["query"], key: string): string | undefined {
  const value = query?.[key];
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}

function firstBearerHeader(headers: InspectorRequest["headers"]): string | undefined {
  const raw = headers?.["authorization"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return undefined;
  return value.startsWith("Bearer ") ? value.slice(7).trim() : undefined;
}

function sanitizeDevice(info: DeviceInfo): SanitizedDevice {
  return {
    device: info.device,
    // DeviceInfo.token 是原始 token，监控台只输出指纹
    tokenFingerprint: fingerprintToken(info.token),
    loginTime: info.loginTime,
  };
}

function describeInstance(instance: XltInstance) {
  const config = instance.config;
  return {
    strategy: instance.strategy.constructor?.name ?? "custom",
    store: instance.store.constructor?.name ?? "custom",
    tokenName: config.tokenName,
    tokenPrefix: config.tokenPrefix,
    tokenStyle: config.tokenStyle,
    timeout: config.timeout,
    activeTimeout: config.activeTimeout,
    isConcurrent: config.isConcurrent,
    isShare: config.isShare,
    deviceConcurrent: config.deviceConcurrent ?? true,
    isReadHeader: config.isReadHeader,
    isReadCookie: config.isReadCookie,
    isReadQuery: config.isReadQuery,
    defaultCheck: config.defaultCheck,
  };
}

/**
 * 创建监控台数据桥：框架无关的只读（可选动作）HTTP handler 集合。
 *
 * - `auth` 为强制项，缺失时创建期抛错
 * - 默认只读；`allowMutations: true` 才开放 kickout / logout 动作
 * - 所有设备 token 均以指纹输出，不返回原始凭据
 */
export function createInspectorBridge(options: InspectorBridgeOptions): InspectorBridge {
  if (typeof options.auth !== "function") {
    throw new Error(
      "createInspectorBridge requires an `auth` function. The inspector exposes session and audit data; wire it to your admin check before mounting.",
    );
  }

  const allowMutations = options.allowMutations ?? false;
  const resolveInstance = (): XltInstance =>
    typeof options.instance === "function" ? options.instance() : options.instance;

  const unauthorized = (): InspectorResponse => ({ status: 403, body: { error: "forbidden" } });

  async function overview(): Promise<InspectorResponse> {
    const instance = resolveInstance();
    return {
      status: 200,
      body: {
        allowMutations,
        instance: describeInstance(instance),
        onlineCount: await instance.stpLogic.getOnlineCount(),
        buffer: options.buffer.stats(),
      },
    };
  }

  async function events(request: InspectorRequest): Promise<InspectorResponse> {
    const after = Number(queryValue(request.query, "after") ?? 0) || 0;
    const limit = Number(queryValue(request.query, "limit") ?? 100) || 100;
    return { status: 200, body: options.buffer.snapshot(after, limit) };
  }

  async function metrics(): Promise<InspectorResponse> {
    const { byType, tracked, capacity, latest } = options.buffer.stats();
    const count = (type: string) => byType[type] ?? 0;
    return {
      status: 200,
      body: {
        byType,
        loginCount: count("token.logged_in"),
        refreshCount: count("token.refreshed"),
        logoutCount: count("token.logged_out"),
        anomalyCount:
          count("token.kicked_out") + count("token.replaced") + count("token.family_revoked"),
        window: { tracked, capacity, latest },
      },
    };
  }

  async function sessions(request: InspectorRequest): Promise<InspectorResponse> {
    const instance = resolveInstance();
    const page = Math.max(0, Number(queryValue(request.query, "page") ?? 0) || 0);
    const pageSize = Math.min(
      Math.max(1, Number(queryValue(request.query, "pageSize") ?? 20) || 20),
      200,
    );
    const [loginIds, total] = await Promise.all([
      instance.stpLogic.getOnlineLoginIds({ page, pageSize }),
      instance.stpLogic.getOnlineCount(),
    ]);
    return { status: 200, body: { page, pageSize, total, loginIds } };
  }

  async function sessionDevices(request: InspectorRequest): Promise<InspectorResponse> {
    const loginId = queryValue(request.query, "loginId");
    if (!loginId) return { status: 400, body: { error: "loginId is required" } };

    const instance = resolveInstance();
    const devices = await instance.stpLogic.getDeviceList(loginId);
    return { status: 200, body: { loginId, devices: devices.map(sanitizeDevice) } };
  }

  function mutationsDisabled(): InspectorResponse {
    return {
      status: 403,
      body: { error: "mutations are disabled; enable allowMutations on the bridge" },
    };
  }

  async function kickout(request: InspectorRequest): Promise<InspectorResponse> {
    if (!allowMutations) return mutationsDisabled();
    const { loginId, device } = (request.body ?? {}) as { loginId?: string; device?: string };
    if (!loginId) return { status: 400, body: { error: "loginId is required" } };

    const instance = resolveInstance();
    const ok = await instance.stpLogic.kickout(loginId, device ?? "default");
    return { status: 200, body: { ok } };
  }

  async function logout(request: InspectorRequest): Promise<InspectorResponse> {
    if (!allowMutations) return mutationsDisabled();
    const { loginId } = (request.body ?? {}) as { loginId?: string };
    if (!loginId) return { status: 400, body: { error: "loginId is required" } };

    const instance = resolveInstance();
    const ok = await instance.stpLogic.logoutByLoginId(loginId);
    return { status: 200, body: { ok } };
  }

  const routeHandlers: Record<string, (request: InspectorRequest) => Promise<InspectorResponse>> = {
    "GET /overview": overview,
    "GET /events": events,
    "GET /metrics": metrics,
    "GET /sessions": sessions,
    "GET /session-devices": sessionDevices,
    "POST /actions/kickout": kickout,
    "POST /actions/logout": logout,
  };

  return {
    async handle(request: InspectorRequest): Promise<InspectorResponse> {
      try {
        const authResult = await options.auth(request, {
          bearerToken: firstBearerHeader(request.headers),
        });
        if (!authResult) return unauthorized();

        const key = `${request.method.toUpperCase()} ${request.path}`;
        const handler = routeHandlers[key];
        if (!handler) return { status: 404, body: { error: "not found" } };

        return await handler(request);
      } catch (error) {
        return {
          status: 500,
          body: { error: error instanceof Error ? error.message : String(error) },
        };
      }
    },
  };
}

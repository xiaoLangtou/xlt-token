import type { XltInstance, XltMode, XltSession } from "@xlt-token/core";
import type { FastifyRequest } from "fastify";

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
export interface XltRouteAuthMeta {
  /** 跳过登录校验（黑名单模式下的白名单） */
  ignore?: boolean;
  /** 声明需要登录（白名单模式下开启校验） */
  requireLogin?: boolean;
  permissions?: { list: string[]; mode: XltMode };
  roles?: { list: string[]; mode: XltMode };
  /** 需要二级认证（安全窗口）的业务名 */
  safeBusiness?: string;
}

export type XltAuthMatcher = string | RegExp | ((request: FastifyRequest) => boolean);

export interface XltRoutePolicy extends XltRouteAuthMeta {
  match: XltAuthMatcher | XltAuthMatcher[];
  methods?: string[];
}

export interface XltFastifyOptions {
  /** 必填：显式认证实例。插件不读取默认实例或 StpUtil。 */
  instance: XltInstance;
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
}

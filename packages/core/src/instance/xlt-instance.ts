import type { StpInterface } from "../perm/stp-interface.js";
import type { TokenStrategy } from "../token/token-strategy.interface.js";
import type { XltTokenConfig, XltTokenConfigInput } from "../config/xlt-token-config.js";
import type { XltEventSink } from "../events/xlt-event-sink.js";
import type { XltTokenStore } from "../store/xlt-token-store.interface.js";
import type { StpLogic } from "../auth/stp-logic.js";
import type { StpPermLogic } from "../auth/stp-perm-logic.js";
import { StpLogic as StpLogicClass } from "../auth/stp-logic.js";
import { StpPermLogic as StpPermLogicClass } from "../auth/stp-perm-logic.js";
import { getStpLogic, getStpPermLogic, setStpLogic, setStpPermLogic } from "../auth/stp-util.js";
import { MemoryStore } from "../store/memory-store.js";
import { UuidStrategy } from "../token/uuid-strategy.js";
import { normalizeXltTokenConfig } from "../time/duration.js";

/**
 * 一个完整隔离的 xlt-token 认证实例。
 *
 * 实例间不共享任何可变全局状态；Store 与 Strategy 由使用者显式提供。
 * 适配器（Fastify / Hono 等）与多实例业务代码只允许经由实例成员访问认证能力，
 * 禁止依赖 `StpUtil` 或默认实例。
 */
export interface XltInstance {
  /** 已归一化的配置快照（只读） */
  readonly config: XltTokenConfig;
  /** 该实例绑定的存储后端 */
  readonly store: XltTokenStore;
  /** 该实例的 token 生成策略（UUID / JWT / 自定义） */
  readonly strategy: TokenStrategy;
  /** 认证逻辑入口：login / logout / kickout / consumeTempToken / ... */
  readonly stpLogic: StpLogic;
  /** 权限逻辑入口：hasPermission / hasRole / ... */
  readonly stpPermLogic: StpPermLogic;
}

export interface CreateInstanceOptions {
  config?: Partial<XltTokenConfigInput>;
  store?: XltTokenStore;
  strategy?: TokenStrategy;
  stpInterface?: StpInterface;
  eventSink?: XltEventSink;
}

/**
 * 创建一个隔离的 xlt-token 实例。
 *
 * 纯函数语义：不读取、不写入任何全局状态（包括默认实例）。
 * 与 `createXltToken()` 的唯一差异是不注册默认实例——
 * 如需让 `StpUtil` 路由到该实例，显式调用 `setDefaultXltInstance()`。
 */
export function createXltInstance(options: CreateInstanceOptions = {}): XltInstance {
  const config = normalizeXltTokenConfig(options.config);
  const store = options.store ?? new MemoryStore();
  const strategy = options.strategy ?? new UuidStrategy();
  const stpInterface: StpInterface = options.stpInterface ?? {
    getPermissionList: () => {
      throw new Error("StpInterface not registered: getPermissionList");
    },
    getRoleList: () => {
      throw new Error("StpInterface not registered: getRoleList");
    },
  };
  const eventSink = options.eventSink ?? {};
  const stpLogic = new StpLogicClass(config, store, strategy, eventSink);
  const stpPermLogic = new StpPermLogicClass(stpInterface, store, config);

  return { config, store, strategy, stpLogic, stpPermLogic };
}

/**
 * 显式把某个实例注册为默认实例（`StpUtil` 的委托目标）。
 *
 * 后注册者覆盖先注册者——与 `createXltToken()` 的隐式覆盖行为一致，
 * 但把"隐式副作用"变为"显式声明"。
 */
export function setDefaultXltInstance(instance: XltInstance): void {
  if (!instance) {
    throw new Error("setDefaultXltInstance requires an XltInstance.");
  }
  if (!instance.stpLogic) {
    throw new Error(
      "setDefaultXltInstance requires instance.stpLogic to be present. Use createXltInstance() to build a valid instance.",
    );
  }
  if (!instance.stpPermLogic) {
    throw new Error(
      "setDefaultXltInstance requires instance.stpPermLogic to be present. Use createXltInstance() to build a valid instance.",
    );
  }
  setStpLogic(instance.stpLogic);
  setStpPermLogic(instance.stpPermLogic);
}

/**
 * 读取当前默认实例；未注册时抛出与 `StpUtil` 一致的初始化错误。
 *
 * 返回值是默认实例的只读视图：`stpLogic` / `stpPermLogic` 来自
 * `setStpLogic` / `setStpPermLogic` / `setDefaultXltInstance` 写入的同一存储，
 * `config` / `store` / `strategy` 从默认 `StpLogic` 实例派生。
 */
export function getDefaultXltInstance(): XltInstance {
  const stpLogic = getStpLogic();
  const stpPermLogic = getStpPermLogic();

  return {
    config: stpLogic.config,
    store: stpLogic.store,
    strategy: stpLogic.strategy,
    stpLogic,
    stpPermLogic,
  };
}

import type { StpLogic } from "./auth/stp-logic.js";
import type { StpPermLogic } from "./auth/stp-perm-logic.js";
import { StpUtil } from "./auth/stp-util.js";
import type { XltTokenConfig } from "./config/xlt-token-config.js";
import type { TokenStrategy } from "./token/token-strategy.interface.js";
import type { XltTokenStore } from "./store/xlt-token-store.interface.js";
import {
  createXltInstance,
  type CreateInstanceOptions,
  type XltInstance,
  setDefaultXltInstance,
} from "./instance/xlt-instance.js";

export type CreateOptions = CreateInstanceOptions;

export interface XltTokenContext {
  config: XltTokenConfig;
  store: XltTokenStore;
  strategy: TokenStrategy;
  stpLogic: StpLogic;
  stpPermLogic: StpPermLogic;
  stpUtil: typeof StpUtil;
}

/**
 * 便捷工厂：构造实例并把它注册为默认实例（`StpUtil` 的委托目标）。
 *
 * 行为等价于 `createXltInstance()` + `setDefaultXltInstance()`，
 * 多次调用时后创建者覆盖先创建者（v2.2 及之前的既有语义）。
 * 多实例进程中请改用 `createXltInstance()` 并持有实例句柄。
 */
export function createXltToken(options: CreateOptions = {}): XltTokenContext {
  const instance: XltInstance = createXltInstance(options);
  setDefaultXltInstance(instance);

  return {
    config: instance.config,
    store: instance.store,
    strategy: instance.strategy,
    stpLogic: instance.stpLogic,
    stpPermLogic: instance.stpPermLogic,
    stpUtil: StpUtil,
  };
}

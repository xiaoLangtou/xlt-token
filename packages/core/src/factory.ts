import type { StpInterface } from './perm/stp-interface.js';
import type { TokenStrategy } from './token/token-strategy.interface.js';
import type { XltHooks, XltTokenConfig, XltTokenStore } from './config/xlt-token-config.js';
import { DEFAULT_XLT_TOKEN_CONFIG } from './config/xlt-token-config.js';
import { StpLogic } from './auth/stp-logic.js';
import { StpPermLogic } from './auth/stp-perm-logic.js';
import { setStpLogic, setStpPermLogic, StpUtil } from './auth/stp-util.js';
import { MemoryStore } from './store/memory-store.js';
import { UuidStrategy } from './token/uuid-strategy.js';
import { defaultStpInterface } from './test/setup-stp-logic.js';

export interface CreateOptions {
  config?: Partial<XltTokenConfig>;
  store?: XltTokenStore;
  strategy?: TokenStrategy;
  stpInterface?: StpInterface;
  hooks?: XltHooks;
}

export interface XltTokenContext {
  config: XltTokenConfig;
  store: XltTokenStore;
  strategy: TokenStrategy;
  stpLogic: StpLogic;
  stpPermLogic: StpPermLogic;
  stpUtil: typeof StpUtil;
}

export function createXltToken(options: CreateOptions = {}): XltTokenContext {
  const config: XltTokenConfig = { ...DEFAULT_XLT_TOKEN_CONFIG, ...options.config };
  const store = options.store ?? new MemoryStore();
  const strategy = options.strategy ?? new UuidStrategy();
  const stpInterface = options.stpInterface ?? defaultStpInterface;
  const hooks = options.hooks ?? {};
  const stpLogic = new StpLogic(config, store, strategy, hooks);
  const stpPermLogic = new StpPermLogic(stpInterface, store, config);
  setStpLogic(stpLogic);
  setStpPermLogic(stpPermLogic);
  return { config, store, strategy, stpLogic, stpPermLogic, stpUtil: StpUtil };
}

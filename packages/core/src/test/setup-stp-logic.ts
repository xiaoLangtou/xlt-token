import type { StpInterface } from '../perm/stp-interface.js';
import type { XltHooks, XltTokenConfig } from '../config/xlt-token-config.js';
import { DEFAULT_XLT_TOKEN_CONFIG } from '../config/xlt-token-config.js';
import { StpLogic } from '../auth/stp-logic.js';
import { MemoryStore } from '../store/memory-store.js';
import { UuidStrategy } from '../token/uuid-strategy.js';
import type { TokenStrategy } from '../token/token-strategy.interface.js';

export function createStpLogic(options: {
  config?: Partial<XltTokenConfig>;
  hooks?: XltHooks;
  strategy?: TokenStrategy;
  store?: MemoryStore;
} = {}) {
  const config: XltTokenConfig = { ...DEFAULT_XLT_TOKEN_CONFIG, ...options.config };
  const store = options.store ?? new MemoryStore();
  const strategy = options.strategy ?? new UuidStrategy();
  const logic = new StpLogic(config, store, strategy, options.hooks ?? {});
  return { logic, store, config, strategy };
}

export const defaultStpInterface: StpInterface = {
  getPermissionList: () => { throw new Error('StpInterface not registered: getPermissionList'); },
  getRoleList: () => { throw new Error('StpInterface not registered: getRoleList'); },
};

import type { StpInterface } from './perm/stp-interface.js';
import type { TokenStrategy } from './token/token-strategy.interface.js';
import type { XltTokenConfig, XltTokenConfigInput } from './config/xlt-token-config.js';
import { DEFAULT_XLT_TOKEN_CONFIG } from './config/xlt-token-config.js';
import type { XltTokenStore } from './store/xlt-token-store.interface.js';
import type { XltHooks } from './hooks/xlt-hooks.interface.js';
import { StpLogic } from './auth/stp-logic.js';
import { StpPermLogic } from './auth/stp-perm-logic.js';
import { setStpLogic, setStpPermLogic, StpUtil } from './auth/stp-util.js';
import { MemoryStore } from './store/memory-store.js';
import { UuidStrategy } from './token/uuid-strategy.js';
import { normalizeXltTokenConfig } from "./time/duration.js";

const defaultStpInterface: StpInterface = {
    getPermissionList: () => {
        throw new Error('StpInterface not registered: getPermissionList');
    },
    getRoleList: () => {
        throw new Error('StpInterface not registered: getRoleList');
    },
};

export interface CreateOptions {
    config?: Partial<XltTokenConfigInput>;
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
    const config = normalizeXltTokenConfig( options.config );
    const store = options.store ?? new MemoryStore();
    const strategy = options.strategy ?? new UuidStrategy();
    const stpInterface = options.stpInterface ?? defaultStpInterface;
    const hooks = options.hooks ?? {};
    const stpLogic = new StpLogic(config, store, strategy, hooks);
    const stpPermLogic = new StpPermLogic(stpInterface, store, config);
    setStpLogic(stpLogic);
    setStpPermLogic(stpPermLogic);
    return {config, store, strategy, stpLogic, stpPermLogic, stpUtil: StpUtil};
}

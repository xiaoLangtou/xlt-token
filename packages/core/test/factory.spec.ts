import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryStore } from '../src/store/memory-store.js';
import { UuidStrategy } from '../src/token/uuid-strategy.js';
import type { StpInterface } from '../src/perm/stp-interface.js';
import { createXltToken } from '../src/factory.js';
import { StpUtil } from '../src/auth/stp-util.js';
import { DEFAULT_XLT_TOKEN_CONFIG } from '../src/config/xlt-token-config.js';

const customStpInterface: StpInterface = {
  getPermissionList: () => ['user:read'],
  getRoleList: () => ['admin'],
};

describe('createXltToken', () => {
  beforeEach(() => {
    createXltToken();
  });

  it('默认创建 core 运行时组件', () => {
    const ctx = createXltToken();

    expect(ctx.config).toMatchObject(DEFAULT_XLT_TOKEN_CONFIG);
    expect(ctx.store).toBeInstanceOf(MemoryStore);
    expect(ctx.strategy).toBeInstanceOf(UuidStrategy);
    expect(ctx.stpLogic).toBeDefined();
    expect(ctx.stpPermLogic).toBeDefined();
    expect(ctx.stpUtil).toBe(StpUtil);
  });

  it('注入自定义 config / store / strategy / stpInterface / hooks', () => {
    const store = new MemoryStore();
    const strategy = new UuidStrategy();
    const onLogin = () => {};

    const ctx = createXltToken({
      config: { tokenName: 'x-auth' },
      store,
      strategy,
      stpInterface: customStpInterface,
      hooks: { onLogin },
    });

    expect(ctx.config.tokenName).toBe('x-auth');
    expect(ctx.store).toBe(store);
    expect(ctx.strategy).toBe(strategy);
  });

  it('初始化 StpUtil 静态门面', async () => {
    createXltToken();
    const token = await StpUtil.login('1001');
    expect(token).toBeTruthy();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "../../src/store/memory-store.js";
import { UuidStrategy } from "../../src/token/uuid-strategy.js";
import { createMockHttpContext } from "../../src/http/testing.js";
import {
  createXltInstance,
  getDefaultXltInstance,
  setDefaultXltInstance,
} from "../../src/instance/xlt-instance.js";
import { setStpLogic, setStpPermLogic, StpUtil } from "../../src/auth/stp-util.js";
import { createXltToken } from "../../src/factory.js";

describe("createXltInstance", () => {
  it("缺省使用 MemoryStore 与 UuidStrategy（与 createXltToken 一致）", () => {
    const instance = createXltInstance();

    expect(instance.store).toBeInstanceOf(MemoryStore);
    expect(instance.strategy).toBeInstanceOf(UuidStrategy);
    expect(instance.stpLogic).toBeDefined();
    expect(instance.stpPermLogic).toBeDefined();
    expect(instance.config.tokenName).toBe("authorization");
  });

  it("接受自定义 config / store / strategy", () => {
    const store = new MemoryStore();
    const strategy = new UuidStrategy();

    const instance = createXltInstance({ config: { tokenName: "x-token" }, store, strategy });

    expect(instance.config.tokenName).toBe("x-token");
    expect(instance.store).toBe(store);
    expect(instance.strategy).toBe(strategy);
  });

  it("创建实例不会隐式修改默认实例", async () => {
    const primary = createXltInstance({ config: { tokenName: "primary-token" } });
    setDefaultXltInstance(primary);

    // 再创建一个新实例，不应抢占 StpUtil 的委托目标
    createXltInstance({ config: { tokenName: "shadow-token" } });

    const token = await StpUtil.login("1001");
    expect(token).toBeTruthy();
    // 登录态写入 primary（默认实例）的 store
    expect(await primary.stpLogic.getOnlineCount()).toBe(1);
    expect(getDefaultXltInstance().config.tokenName).toBe("primary-token");
  });

  it("多实例相互隔离：不同 tokenName / Store 互不污染", async () => {
    const storeA = new MemoryStore();
    const storeB = new MemoryStore();
    const instanceA = createXltInstance({ config: { tokenName: "a-token" }, store: storeA });
    const instanceB = createXltInstance({ config: { tokenName: "b-token" }, store: storeB });

    const tokenA = await instanceA.stpLogic.login("1001");
    const tokenB = await instanceB.stpLogic.login("2002");

    expect(await instanceA.stpLogic.getOnlineCount()).toBe(1);
    expect(await instanceB.stpLogic.getOnlineCount()).toBe(1);

    // 各自的 token 在对方实例中无效
    const ctxA = createMockHttpContext({ headers: { "a-token": tokenA } });
    const ctxB = createMockHttpContext({ headers: { "b-token": tokenB } });
    const ctxAWrongName = createMockHttpContext({ headers: { "b-token": tokenA } });

    expect(await instanceA.stpLogic.isLogin(ctxA)).toBe(true);
    expect(await instanceB.stpLogic.isLogin(ctxB)).toBe(true);
    expect(await instanceA.stpLogic.isLogin(ctxAWrongName)).toBe(false);
  });
});

describe("默认实例管理", () => {
  beforeEach(() => {
    // 每个用例显式注册默认实例，避免用例间隐式依赖
    setDefaultXltInstance(createXltInstance());
  });

  it("setDefaultXltInstance + getDefaultXltInstance 显式读写", async () => {
    const instance = createXltInstance({ config: { tokenName: "explicit-token" } });
    setDefaultXltInstance(instance);

    const defaultInstance = getDefaultXltInstance();
    expect(defaultInstance.stpLogic).toBe(instance.stpLogic);
    expect(defaultInstance.stpPermLogic).toBe(instance.stpPermLogic);
    expect(defaultInstance.config).toBe(instance.config);
    expect(defaultInstance.store).toBe(instance.store);
    expect(defaultInstance.strategy).toBe(instance.strategy);

    // StpUtil 静态调用路由到显式注册的默认实例
    await StpUtil.login("1001");
    expect(await instance.stpLogic.getOnlineCount()).toBe(1);
  });

  it("后注册者覆盖先注册者", async () => {
    const first = createXltInstance({ config: { tokenName: "first-token" } });
    const second = createXltInstance({ config: { tokenName: "second-token" } });

    setDefaultXltInstance(first);
    setDefaultXltInstance(second);

    expect(getDefaultXltInstance().config.tokenName).toBe("second-token");

    await StpUtil.login("1001");
    expect(await second.stpLogic.getOnlineCount()).toBe(1);
    expect(await first.stpLogic.getOnlineCount()).toBe(0);
  });

  it("非法入参在注册阶段抛出配置级错误", () => {
    const before = getDefaultXltInstance().stpLogic;

    expect(() => setDefaultXltInstance(null as never)).toThrow(
      "setDefaultXltInstance requires an XltInstance.",
    );

    expect(() => setDefaultXltInstance({} as never)).toThrow(/instance\.stpLogic/);

    expect(() => setDefaultXltInstance({ stpLogic: before } as never)).toThrow(
      /instance\.stpPermLogic/,
    );

    // 注册失败不改变现有默认实例
    expect(getDefaultXltInstance().stpLogic).toBe(before);
  });

  it("setStpLogic / setStpPermLogic 与默认实例写同一存储", () => {
    const instance = createXltInstance();

    setStpLogic(instance.stpLogic);
    setStpPermLogic(instance.stpPermLogic);

    const defaultInstance = getDefaultXltInstance();
    expect(defaultInstance.stpLogic).toBe(instance.stpLogic);
    expect(defaultInstance.stpPermLogic).toBe(instance.stpPermLogic);
    expect(defaultInstance.store).toBe(instance.store);
  });

  it("未注册默认实例时抛出清晰初始化错误", async () => {
    vi.resetModules();
    const { getDefaultXltInstance: freshGetDefault } =
      await import("../../src/instance/xlt-instance.js");
    expect(() => freshGetDefault()).toThrow(
      "StpLogic not initialized. Please ensure XltTokenModule is imported correctly.",
    );
  });
});

describe("createXltToken 兼容路径", () => {
  it("行为等价于 createXltInstance + setDefaultXltInstance", async () => {
    const ctx = createXltToken({ config: { tokenName: "compat-token" } });

    // 返回值保持 XltTokenContext 形状
    expect(ctx.stpUtil).toBe(StpUtil);
    expect(ctx.config.tokenName).toBe("compat-token");

    // StpUtil 路由到 createXltToken 创建的实例
    await StpUtil.login("1001");
    expect(await ctx.stpLogic.getOnlineCount()).toBe(1);
    expect(getDefaultXltInstance().stpLogic).toBe(ctx.stpLogic);
  });
});

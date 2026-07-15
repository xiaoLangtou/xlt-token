import { describe, expect, it } from "vitest";
import {
  normalizeTokenLifecycleConfig,
  type TokenFamilyState,
} from "../../src/lifecycle/token-lifecycle.js";
import { XltTokenKeys } from "../../src/config/xlt-token-keys.js";

describe("normalizeTokenLifecycleConfig", () => {
  it("拒绝 fixed 模式中的续签阈值", () => {
    expect(() =>
      normalizeTokenLifecycleConfig({
        expiration: { mode: "fixed", ttl: "30m", renewWhenRemainingBelow: "5m" },
        refresh: { enabled: true, ttl: "7d", rotate: true, replayDetection: "family" },
      }),
    ).toThrowError(expect.objectContaining({ code: "CONFIG_INVALID" }));
  });

  it("为 sliding 模式计算 20% 默认阈值", () => {
    expect(
      normalizeTokenLifecycleConfig({
        expiration: { mode: "sliding", ttl: 100 },
        refresh: { enabled: false, ttl: "7d", rotate: true, replayDetection: "off" },
      }).expiration.renewWhenRemainingBelow,
    ).toBe(20);
  });

  it("拒绝刷新 TTL 小于访问 Token TTL", () => {
    expect(() =>
      normalizeTokenLifecycleConfig({
        expiration: { mode: "fixed", ttl: "2h" },
        refresh: { enabled: true, ttl: "30m", rotate: true, replayDetection: "family" },
      }),
    ).toThrowError(expect.objectContaining({ code: "CONFIG_INVALID" }));
  });
});

describe("TokenFamilyState", () => {
  it("定义家族状态的最小字段", () => {
    const state: TokenFamilyState = {
      familyId: "family-1",
      loginId: "u1",
      device: "pc",
      generation: 1,
      status: "active",
      accessExpiresAt: 1_000,
      refreshExpiresAt: 2_000,
    };

    expect(state).toMatchObject({
      familyId: "family-1",
      status: "active",
      generation: 1,
    });
  });
});

describe("XltTokenKeys lifecycle keys", () => {
  it("使用 familyId 哈希标签生成家族状态和代次消费 key", () => {
    const keys = new XltTokenKeys("authorization");

    expect(keys.tokenFamilyStateKey("family-1")).toBe("authorization:lifecycle:{family-1}:state");
    expect(keys.tokenFamilyGenerationKey("family-1", 2)).toBe(
      "authorization:lifecycle:{family-1}:generation:2",
    );
  });
});

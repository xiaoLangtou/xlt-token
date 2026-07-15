import { describe, expect, it } from "vitest";
import { DEFAULT_XLT_TOKEN_CONFIG, type DurationInput } from "../../src/config/xlt-token-config.js";
import { normalizeDuration, normalizeXltTokenConfig } from "../../src/time/duration.js";

describe("normalizeDuration", () => {
  it.each([
    [30, 30],
    ["30s", 30],
    ["15m", 900],
    ["1.5h", 5400],
    ["2h", 7200],
    ["7d", 604800],
    ["2w", 1209600],
  ] satisfies Array<[DurationInput, number]>)("将 %s 规范化为 %s 秒", (value, expected) => {
    expect(normalizeDuration(value, { field: "timeout" })).toBe(expected);
  });

  it("根据选项接受特殊值", () => {
    expect(normalizeDuration(0, { field: "timeout", allowZero: true })).toBe(0);
    expect(normalizeDuration(-1, { field: "timeout", allowNever: true })).toBe(-1);
  });

  it.each([
    [0, {}],
    [-1, {}],
    [-2, { allowNever: true }],
    [1.5, {}],
    [Number.NaN, {}],
    [Number.POSITIVE_INFINITY, {}],
    ["500ms", {}],
    ["0s", {}],
    ["-1s", {}],
    ["1 day", {}],
    ["1y", {}],
  ])("拒绝非法时长 %s", (value, options) => {
    expect(() =>
      normalizeDuration(value as DurationInput, {
        field: "timeout",
        ...options,
      }),
    ).toThrow(TypeError);
  });

  it("错误消息包含字段名和输入值", () => {
    expect(() => normalizeDuration("soon" as DurationInput, { field: "activeTimeout" })).toThrow(
      'Invalid duration for "activeTimeout": expected integer seconds or a duration such as "30m", received "soon"',
    );
  });

  it("空字符串拒绝", () => {
    expect(() => normalizeDuration("" as DurationInput, { field: "timeout" })).toThrow(TypeError);
  });

  it("allowZero + allowNever 同时启用时接受 0 和 -1", () => {
    expect(normalizeDuration(0, { field: "t", allowZero: true, allowNever: true })).toBe(0);
    expect(normalizeDuration(-1, { field: "t", allowZero: true, allowNever: true })).toBe(-1);
  });
});

describe("normalizeXltTokenConfig", () => {
  it("未传配置时返回默认运行时配置", () => {
    expect(normalizeXltTokenConfig()).toEqual(DEFAULT_XLT_TOKEN_CONFIG);
  });

  it("将配置中的相对时间转换为秒", () => {
    expect(
      normalizeXltTokenConfig({
        timeout: "7d",
        activeTimeout: "30m",
        permCacheTimeout: "5m",
        offlineRecordTimeout: "1d",
      }),
    ).toMatchObject({
      timeout: 604800,
      activeTimeout: 1800,
      permCacheTimeout: 300,
      offlineRecordTimeout: 86400,
    });
  });

  it("保留数字特殊值", () => {
    expect(
      normalizeXltTokenConfig({
        timeout: -1,
        activeTimeout: 0,
        permCacheTimeout: -1,
        offlineRecordTimeout: 0,
      }),
    ).toMatchObject({
      timeout: -1,
      activeTimeout: 0,
      permCacheTimeout: -1,
      offlineRecordTimeout: 0,
    });
  });

  it("显式 undefined 不覆盖默认时长", () => {
    expect(
      normalizeXltTokenConfig({
        timeout: undefined,
        activeTimeout: undefined,
        permCacheTimeout: undefined,
        offlineRecordTimeout: undefined,
      }),
    ).toMatchObject({
      timeout: DEFAULT_XLT_TOKEN_CONFIG.timeout,
      activeTimeout: DEFAULT_XLT_TOKEN_CONFIG.activeTimeout,
      permCacheTimeout: DEFAULT_XLT_TOKEN_CONFIG.permCacheTimeout,
      offlineRecordTimeout: DEFAULT_XLT_TOKEN_CONFIG.offlineRecordTimeout,
    });
  });

  it("部分配置仅覆盖指定字段", () => {
    const config = normalizeXltTokenConfig({ timeout: "5m" });
    expect(config.timeout).toBe(300);
    expect(config.activeTimeout).toBe(DEFAULT_XLT_TOKEN_CONFIG.activeTimeout);
    expect(config.permCacheTimeout).toBe(DEFAULT_XLT_TOKEN_CONFIG.permCacheTimeout);
    expect(config.offlineRecordTimeout).toBe(DEFAULT_XLT_TOKEN_CONFIG.offlineRecordTimeout);
  });

  it("非时长字段透传不变", () => {
    const config = normalizeXltTokenConfig({
      tokenName: "x-auth",
      isConcurrent: false,
      isShare: false,
    });
    expect(config.tokenName).toBe("x-auth");
    expect(config.isConcurrent).toBe(false);
    expect(config.isShare).toBe(false);
  });

  it("混合传入字符串和数字时长", () => {
    const config = normalizeXltTokenConfig({
      timeout: "7d",
      activeTimeout: 1800,
    });
    expect(config.timeout).toBe(604800);
    expect(config.activeTimeout).toBe(1800);
  });

  it("返回配置中的四个时长字段均为 number", () => {
    const config = normalizeXltTokenConfig({
      timeout: "30m",
      activeTimeout: -1,
      permCacheTimeout: 0,
      offlineRecordTimeout: "1h",
    });
    expect(typeof config.timeout).toBe("number");
    expect(typeof config.activeTimeout).toBe("number");
    expect(typeof config.permCacheTimeout).toBe("number");
    expect(typeof config.offlineRecordTimeout).toBe("number");
  });
});

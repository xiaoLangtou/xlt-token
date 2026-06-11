import { describe, expect, it } from 'vitest';
import {
  DEFAULT_XLT_TOKEN_CONFIG,
  type DurationInput,
} from '../../src/config/xlt-token-config.js';
import {
  normalizeDuration,
  normalizeXltTokenConfig,
} from '../../src/time/duration.js';

describe('normalizeDuration', () => {
  it.each([
    [30, 30],
    ['30s', 30],
    ['15m', 900],
    ['1.5h', 5400],
    ['2h', 7200],
    ['7d', 604800],
    ['2w', 1209600],
  ] satisfies Array<[DurationInput, number]>)('将 %s 规范化为 %s 秒', (value, expected) => {
    expect(normalizeDuration(value, { field: 'timeout' })).toBe(expected);
  });

  it('根据选项接受特殊值', () => {
    expect(normalizeDuration(0, { field: 'timeout', allowZero: true })).toBe(0);
    expect(normalizeDuration(-1, { field: 'timeout', allowNever: true })).toBe(-1);
  });

  it.each([
    [0, {}],
    [-1, {}],
    [-2, { allowNever: true }],
    [1.5, {}],
    [Number.NaN, {}],
    [Number.POSITIVE_INFINITY, {}],
    ['500ms', {}],
    ['0s', {}],
    ['-1s', {}],
    ['1 day', {}],
    ['1y', {}],
  ])('拒绝非法时长 %s', (value, options) => {
    expect(() =>
      normalizeDuration(value as DurationInput, {
        field: 'timeout',
        ...options,
      }),
    ).toThrow(TypeError);
  });

  it('错误消息包含字段名和输入值', () => {
    expect(() =>
      normalizeDuration('soon' as DurationInput, { field: 'activeTimeout' }),
    ).toThrow(
      'Invalid duration for "activeTimeout": expected integer seconds or a duration such as "30m", received "soon"',
    );
  });
});

describe('normalizeXltTokenConfig', () => {
  it('未传配置时返回默认运行时配置', () => {
    expect(normalizeXltTokenConfig()).toEqual(DEFAULT_XLT_TOKEN_CONFIG);
  });

  it('将配置中的相对时间转换为秒', () => {
    expect(
      normalizeXltTokenConfig({
        timeout: '7d',
        activeTimeout: '30m',
        permCacheTimeout: '5m',
        offlineRecordTimeout: '1d',
      }),
    ).toMatchObject({
      timeout: 604800,
      activeTimeout: 1800,
      permCacheTimeout: 300,
      offlineRecordTimeout: 86400,
    });
  });

  it('保留数字特殊值', () => {
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

  it('显式 undefined 不覆盖默认时长', () => {
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
});

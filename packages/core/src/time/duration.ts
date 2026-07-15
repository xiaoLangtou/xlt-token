import ms from "ms";
import {
  DEFAULT_XLT_TOKEN_CONFIG,
  type DurationInput,
  type XltTokenConfig,
  type XltTokenConfigInput,
} from "../config/xlt-token-config.js";
import { normalizeTokenLifecycleConfig } from "../lifecycle/token-lifecycle.js";

const DURATION_PATTERN = /^\d+(?:\.\d+)?[smhdw]$/;

/**
 * 规范化时长选项
 */
export interface NormalizeDurationOptions {
  field: string;
  allowZero?: boolean;
  allowNever?: boolean;
}

export function normalizeDuration(value: DurationInput, options: NormalizeDurationOptions): number {
  const invalid = (): never => {
    throw new TypeError(
      `Invalid duration for "${options.field}": expected integer seconds or a duration such as "30m", received ${JSON.stringify(value)}`,
    );
  };

  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) invalid();
    if (value === 0) return options.allowZero ? 0 : invalid();
    if (value === -1) return options.allowNever ? -1 : invalid();
    if (value < 0) invalid();
    return value;
  }

  if (!DURATION_PATTERN.test(value)) invalid();

  const seconds = ms(value) / 1000;
  if (!Number.isFinite(seconds) || !Number.isInteger(seconds) || seconds <= 0) {
    invalid();
  }

  return seconds;
}

/**
 * 规范化 XltToken 配置
 */
export function normalizeXltTokenConfig(input?: Partial<XltTokenConfigInput>): XltTokenConfig {
  const config = {
    ...DEFAULT_XLT_TOKEN_CONFIG,
    ...input,
    timeout: input?.timeout ?? DEFAULT_XLT_TOKEN_CONFIG.timeout,
    activeTimeout: input?.activeTimeout ?? DEFAULT_XLT_TOKEN_CONFIG.activeTimeout,
    permCacheTimeout: input?.permCacheTimeout ?? DEFAULT_XLT_TOKEN_CONFIG.permCacheTimeout,
    offlineRecordTimeout:
      input?.offlineRecordTimeout ?? DEFAULT_XLT_TOKEN_CONFIG.offlineRecordTimeout,
  };

  return {
    ...config,
    timeout: normalizeDuration(config.timeout, {
      field: "timeout",
      allowZero: true,
      allowNever: true,
    }),
    activeTimeout: normalizeDuration(config.activeTimeout, {
      field: "activeTimeout",
      allowZero: true,
      allowNever: true,
    }),
    permCacheTimeout: normalizeDuration(
      config.permCacheTimeout ?? DEFAULT_XLT_TOKEN_CONFIG.permCacheTimeout!,
      {
        field: "permCacheTimeout",
        allowZero: true,
        allowNever: true,
      },
    ),
    offlineRecordTimeout: normalizeDuration(
      config.offlineRecordTimeout ?? DEFAULT_XLT_TOKEN_CONFIG.offlineRecordTimeout!,
      {
        field: "offlineRecordTimeout",
        allowZero: true,
        allowNever: true,
      },
    ),
    lifecycle: config.lifecycle
      ? normalizeTokenLifecycleConfig(config.lifecycle)
      : DEFAULT_XLT_TOKEN_CONFIG.lifecycle,
  };
}

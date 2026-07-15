import { type DurationInput } from "../config/xlt-token-config.js";
import { normalizeDuration } from "../time/duration.js";
import type { RefreshResult, RevokeResult, RevokeScope, TokenFamilyState } from "./token-state.js";

export type TokenExpirationConfig =
  | {
      mode: "fixed";
      ttl: DurationInput;
      renewWhenRemainingBelow?: never;
    }
  | {
      mode: "sliding";
      ttl: DurationInput;
      renewWhenRemainingBelow?: DurationInput;
    };

export interface TokenRefreshConfig {
  enabled: boolean;
  ttl: DurationInput;
  rotate: boolean;
  replayDetection: "off" | "token" | "family";
}

export interface TokenLifecycleConfig {
  expiration: TokenExpirationConfig;
  refresh: TokenRefreshConfig;
}

export type NormalizedTokenExpirationConfig =
  | {
      mode: "fixed";
      ttl: number;
    }
  | {
      mode: "sliding";
      ttl: number;
      renewWhenRemainingBelow: number;
    };

export interface NormalizedTokenRefreshConfig {
  enabled: boolean;
  ttl: number;
  rotate: boolean;
  replayDetection: "off" | "token" | "family";
}

export interface NormalizedTokenLifecycleConfig {
  expiration: NormalizedTokenExpirationConfig;
  refresh: NormalizedTokenRefreshConfig;
}

export function normalizeTokenLifecycleConfig(
  input: TokenLifecycleConfig,
): NormalizedTokenLifecycleConfig {
  const accessTtl = normalizeDuration(input.expiration.ttl, {
    field: "lifecycle.expiration.ttl",
  });

  if (
    input.expiration.mode === "fixed" &&
    "renewWhenRemainingBelow" in input.expiration &&
    input.expiration.renewWhenRemainingBelow !== undefined
  ) {
    throwConfigInvalid("fixed expiration does not support renewWhenRemainingBelow");
  }

  const refreshTtl = normalizeDuration(input.refresh.ttl, {
    field: "lifecycle.refresh.ttl",
  });

  if (input.refresh.enabled && refreshTtl < accessTtl) {
    throwConfigInvalid("refresh ttl must be greater than or equal to access ttl");
  }

  return {
    expiration:
      input.expiration.mode === "fixed"
        ? { mode: "fixed", ttl: accessTtl }
        : {
            mode: "sliding",
            ttl: accessTtl,
            renewWhenRemainingBelow:
              input.expiration.renewWhenRemainingBelow === undefined
                ? Math.floor(accessTtl * 0.2)
                : normalizeDuration(input.expiration.renewWhenRemainingBelow, {
                    field: "lifecycle.expiration.renewWhenRemainingBelow",
                  }),
          },
    refresh: {
      enabled: input.refresh.enabled,
      ttl: refreshTtl,
      rotate: input.refresh.rotate,
      replayDetection: input.refresh.replayDetection,
    },
  };
}

function throwConfigInvalid(message: string): never {
  const error = new TypeError(message) as TypeError & { code: "CONFIG_INVALID" };
  error.code = "CONFIG_INVALID";
  throw error;
}

export type { RefreshResult, RevokeResult, RevokeScope, TokenFamilyState };

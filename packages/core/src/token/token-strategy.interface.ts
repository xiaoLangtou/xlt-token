import type { DurationInput, XltTokenConfig } from "../config/xlt-token-config.js";

export interface TokenStrategy<T = any> {
  readonly kind?: "opaque" | "jwt";
  generateToken(payload: T): string;
  verifyToken(token: string): T;
  createToken(
    loginId: string,
    config: XltTokenConfig,
    options?: { timeout?: DurationInput },
  ): string;
}

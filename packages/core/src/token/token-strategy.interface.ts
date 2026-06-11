import type { DurationInput, XltTokenConfig } from '../config/xlt-token-config.js';

export interface TokenStrategy {
  generateToken(payload: any): string;
  verifyToken(token: string): any;
  createToken(loginId: string, config: XltTokenConfig, options?: { timeout?: DurationInput }): string;
}

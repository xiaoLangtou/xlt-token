import type { XltTokenConfig } from '../config/xlt-token-config.js';

export interface TokenStrategy {
  generateToken(payload: any): string;
  verifyToken(token: string): any;
  createToken(loginId: string, config: XltTokenConfig): string;
}

// Token 生成策略抽象

import { XltTokenConfig } from '../core/xlt-token-config';

export interface TokenStrategy {
  generateToken(payload: any): string;
  verifyToken(token: string): any;
  createToken(loginId: string, config: XltTokenConfig): string;
}

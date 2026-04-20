// UUID 策略

import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { XltTokenConfig } from '../core/xlt-token-config';
import { TokenStrategy } from '../token/token-strategy.interface';

@Injectable()
export class UuidStrategy implements TokenStrategy {
  generateToken(_payload: any): string {
    return randomUUID();
  }

  verifyToken(token: string): any {
    // 基础 UUID 策略无状态校验，仅返回原 token；真正的登录态校验由 StpLogic 从 DAO 读取
    return token;
  }

  createToken(_loginId: string, config: XltTokenConfig): string {
    // 只生成纯 token，前缀由 StpLogic 在返回时拼接
    return this.buildRaw(config.tokenStyle);
  }

  private buildRaw(style: XltTokenConfig['tokenStyle']): string {
    switch (style) {
      case 'uuid':
        return randomUUID(); // 保留原始格式，带连字符，便于 debug
      case 'simple-uuid':
        return randomUUID().replace(/-/g, '');
      case 'random-32':
      default:
        return randomBytes(16).toString('hex'); // 128 bits 真随机，推荐默认
    }
  }
}

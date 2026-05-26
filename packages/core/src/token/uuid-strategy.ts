import { randomBytes, randomUUID } from 'node:crypto';
import type { XltTokenConfig } from '../config/xlt-token-config.js';
import type { TokenStrategy } from './token-strategy.interface.js';

export class UuidStrategy implements TokenStrategy {
  generateToken(_payload: unknown): string {
    return randomUUID();
  }

  verifyToken(token: string): unknown {
    return token;
  }

  createToken(_loginId: string, config: XltTokenConfig): string {
    return this.buildRaw(config.tokenStyle);
  }

  private buildRaw(style: XltTokenConfig['tokenStyle']): string {
    switch (style) {
      case 'uuid':
        return randomUUID();
      case 'simple-uuid':
        return randomUUID().replace(/-/g, '');
      case 'random-32':
      default:
        return randomBytes(16).toString('hex');
    }
  }
}

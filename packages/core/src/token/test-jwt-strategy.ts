import { sign, verify, type JwtPayload } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import type { XltTokenConfig } from '../config/xlt-token-config.js';
import type { TokenStrategy } from './token-strategy.interface.js';

export class TestJwtStrategy implements TokenStrategy {
  constructor(private readonly config: XltTokenConfig) {}

  createToken(loginId: string, config: XltTokenConfig): string {
    const jwt = config.jwt!;
    const jti = randomUUID();
    return sign({ sub: loginId, jti }, jwt.secret, {
      algorithm: jwt.algorithm ?? 'HS256',
      ...(jwt.issuer && { issuer: jwt.issuer }),
      ...(jwt.audience && { audience: jwt.audience }),
      ...(config.timeout > 0 && { expiresIn: config.timeout }),
    });
  }

  generateToken(payload: unknown): string {
    return sign(payload as Record<string, unknown>, this.config.jwt!.secret);
  }

  verifyToken(token: string): JwtPayload & { sub: string; jti: string } {
    return verify(token, this.config.jwt!.secret) as JwtPayload & { sub: string; jti: string };
  }
}

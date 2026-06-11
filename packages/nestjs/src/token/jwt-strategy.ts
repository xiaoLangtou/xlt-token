import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { XLT_TOKEN_CONFIG } from '@xlt-token/core';
import type { DurationInput, TokenStrategy, XltTokenConfig } from '@xlt-token/core';

const require = createRequire(import.meta.url);

let jsonwebtoken: typeof import('jsonwebtoken') | undefined;

export type XltJwtPayload = Record<string, any> & { sub: string; jti: string };

function getJsonwebtoken(): typeof import('jsonwebtoken') {
  try {
    jsonwebtoken ??= require('jsonwebtoken') as typeof import('jsonwebtoken');
    return jsonwebtoken;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        'JwtStrategy requires the optional peer dependency "jsonwebtoken". '
        + 'Install it in your application with "pnpm add jsonwebtoken".',
      );
    }
    throw error;
  }
}

@Injectable()
export class JwtStrategy implements TokenStrategy<XltJwtPayload> {
  constructor(
    @Inject(XLT_TOKEN_CONFIG) private readonly config: XltTokenConfig
  ) { }

  private ensureJwtConfig(config?: XltTokenConfig): NonNullable<XltTokenConfig['jwt']> {
    const jwt = (config ?? this.config).jwt;
    if (!jwt || !jwt.secret) {
      throw new Error(
        'JwtStrategy requires jwt config with a secret. '
        + 'Provide { jwt: { secret: "your-secret" } } in the module config.',
      );
    }
    return jwt;
  }

  createToken(loginId: string, config: XltTokenConfig, options?: { timeout?: DurationInput }): string {
    const { sign } = getJsonwebtoken();
    const jwt = this.ensureJwtConfig(config);
    const jti = randomUUID();

    const resolvedTimeout = options?.timeout ?? config.timeout;
    const hasExpiry = typeof resolvedTimeout === 'number' ? resolvedTimeout > 0 : true;

    return sign({
      sub: loginId, jti
    }, jwt.secret, {
      algorithm: jwt.algorithm ?? 'HS256',
      ...(jwt.issuer && { issuer: jwt.issuer }),
      ...(jwt.audience && { audience: jwt.audience }),
      ...(hasExpiry && { expiresIn: resolvedTimeout }),
    })
  }

  generateToken(payload: any): string {
    const { sign } = getJsonwebtoken();
    const jwt = this.ensureJwtConfig();
    return sign(payload, jwt.secret);
  }

  verifyToken(token: string): XltJwtPayload {
    const { verify } = getJsonwebtoken();
    const jwt = this.ensureJwtConfig();
    return verify(token, jwt.secret) as XltJwtPayload;
  }

}

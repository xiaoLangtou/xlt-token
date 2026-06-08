import { Inject, Injectable } from "@nestjs/common";
import { createRequire } from 'node:module';
import { XLT_TOKEN_CONFIG } from '@xlt-token/core';
import type { TokenStrategy, XltTokenConfig } from '@xlt-token/core';

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
export class JwtStrategy implements TokenStrategy {
  constructor(
    @Inject(XLT_TOKEN_CONFIG) private readonly config: XltTokenConfig
  ) { }



  createToken(loginId: string, config: XltTokenConfig): string {
    const { sign } = getJsonwebtoken();
    const jwt = config.jwt!;
    const jti = crypto.randomUUID();


    return sign({
      sub: loginId, jti
    }, jwt.secret, {
      algorithm: jwt.algorithm ?? 'HS256',
      ...(jwt.issuer && { issuer: jwt.issuer }),
      ...(jwt.audience && { audience: jwt.audience }),
      ...(config.timeout > 0 && { expiresIn: config.timeout }),
    })

  }


  generateToken(payload: any): string {
    const { sign } = getJsonwebtoken();
    return sign(payload, this.config.jwt!.secret);
  }



  verifyToken(token: string): XltJwtPayload {
    const { verify } = getJsonwebtoken();
    return verify(token, this.config.jwt!.secret) as any;
  }

}

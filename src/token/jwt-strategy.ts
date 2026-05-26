import { Inject, Injectable } from "@nestjs/common";
import { XLT_TOKEN_CONFIG, XltTokenConfig } from "../core/xlt-token-config";
import type { TokenStrategy } from "./token-strategy.interface";
import { sign, verify, JwtPayload } from "jsonwebtoken";

@Injectable()
export class JwtStrategy implements TokenStrategy {
  constructor(
    @Inject(XLT_TOKEN_CONFIG) private readonly config: XltTokenConfig
  ) { }



  createToken(loginId: string, config: XltTokenConfig): string {
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
    return sign(payload, this.config.jwt!.secret);
  }



  verifyToken(token: string): JwtPayload & { sub: string; jti: string } {
    return verify(token, this.config.jwt!.secret) as any;
  }

}

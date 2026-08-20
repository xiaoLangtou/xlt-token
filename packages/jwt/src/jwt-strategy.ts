import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import type { DurationInput, TokenStrategy, XltTokenConfig } from "@xlt-token/core";
import type { JwtKey, JwtStrategyConfig } from "./jwt-config.js";

const { decode, sign, verify } = jwt;

export type XltJwtPayload = JwtPayload & { sub: string; jti: string };

export class JwtStrategy implements TokenStrategy<XltJwtPayload> {
  readonly kind = "jwt" as const;

  constructor(private readonly jwtConfig: JwtStrategyConfig) {}

  createToken(
    loginId: string,
    config: XltTokenConfig,
    options?: { timeout?: DurationInput },
  ): string {
    const jti = randomUUID();
    const expiresIn = resolveExpiresIn(options?.timeout ?? config.timeout);

    return this.signPayload(
      {
        sub: loginId,
        jti,
      },
      expiresIn,
    );
  }

  generateToken(payload: XltJwtPayload): string {
    return this.signPayload(payload);
  }

  verifyToken(token: string): XltJwtPayload {
    const decoded = decode(token, { complete: true });
    if (!decoded || typeof decoded === "string") {
      throw new Error("JWT token is malformed");
    }

    const { kid, alg } = decoded.header;
    if (!kid) {
      throw new Error("JWT token header is missing kid");
    }

    const key = this.jwtConfig.keys.get(kid);
    if (!key) {
      throw new Error(`JWT key "${kid}" is not configured`);
    }
    if (alg !== key.algorithm) {
      throw new Error(`JWT algorithm "${String(alg)}" does not match configured key algorithm`);
    }

    const payload = verify(token, key.verificationKey, {
      algorithms: [key.algorithm],
      ...(this.jwtConfig.issuer && { issuer: this.jwtConfig.issuer }),
      ...(this.jwtConfig.audience && { audience: this.jwtConfig.audience }),
    });
    if (typeof payload === "string") {
      throw new Error("JWT payload must be an object");
    }
    if (typeof payload.sub !== "string" || typeof payload.jti !== "string") {
      throw new Error("JWT payload requires string sub and jti claims");
    }

    return payload as XltJwtPayload;
  }

  private signPayload(payload: object, expiresIn?: DurationInput): string {
    const key = this.jwtConfig.activeKey;
    const options: SignOptions = {
      algorithm: key.algorithm,
      keyid: key.kid,
      ...(this.jwtConfig.issuer && { issuer: this.jwtConfig.issuer }),
      ...(this.jwtConfig.audience && { audience: this.jwtConfig.audience }),
      ...(expiresIn !== undefined && { expiresIn }),
    };

    return sign(payload, signingKeyFor(key), options);
  }
}

function resolveExpiresIn(timeout: DurationInput): DurationInput | undefined {
  if (typeof timeout === "number" && timeout <= 0) {
    return undefined;
  }
  return timeout;
}

function signingKeyFor(key: JwtKey) {
  return key.signingKey;
}

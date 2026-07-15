import { JwtPayload, Secret, SignOptions } from "jsonwebtoken";
import { DurationInput, TokenStrategy, XltTokenConfig } from "@xlt-token/core";

//#region src/jwt-config.d.ts
type JwtAlgorithm = Extract<SignOptions["algorithm"], "HS256" | "HS384" | "HS512" | "RS256" | "RS384" | "RS512" | "ES256" | "ES384" | "ES512">;
interface JwtKeyInput {
  kid: string;
  algorithm: JwtAlgorithm;
  secret?: Secret;
  signingKey?: Secret;
  verificationKey?: Secret;
}
interface JwtKey {
  kid: string;
  algorithm: JwtAlgorithm;
  signingKey: Secret;
  verificationKey: Secret;
}
type JwtAudience = string | [string, ...string[]];
interface JwtStrategyConfigInput {
  activeKid: string;
  keys: JwtKeyInput[];
  issuer?: string;
  audience?: JwtAudience;
}
interface JwtStrategyConfig {
  activeKid: string;
  activeKey: JwtKey;
  keys: ReadonlyMap<string, JwtKey>;
  issuer?: string;
  audience?: JwtAudience;
}
declare function createJwtStrategyConfig(input: JwtStrategyConfigInput): JwtStrategyConfig;
//#endregion
//#region src/jwt-strategy.d.ts
type XltJwtPayload = JwtPayload & {
  sub: string;
  jti: string;
};
declare class JwtStrategy implements TokenStrategy<XltJwtPayload> {
  private readonly jwtConfig;
  readonly kind: "jwt";
  constructor(jwtConfig: JwtStrategyConfig);
  createToken(loginId: string, config: XltTokenConfig, options?: {
    timeout?: DurationInput;
  }): string;
  generateToken(payload: XltJwtPayload): string;
  verifyToken(token: string): XltJwtPayload;
  private signPayload;
}
//#endregion
export { type JwtAlgorithm, type JwtAudience, type JwtKey, type JwtKeyInput, JwtStrategy, type JwtStrategyConfig, type JwtStrategyConfigInput, type XltJwtPayload, createJwtStrategyConfig };
//# sourceMappingURL=index.d.mts.map
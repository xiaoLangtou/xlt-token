import { decode, sign } from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { DEFAULT_XLT_TOKEN_CONFIG } from "@xlt-token/core";
import { JwtStrategy, createJwtStrategyConfig } from "../src/index.js";

const strongSecret = "xlt-token-jwt-secret-must-be-at-least-32-bytes";
const rotatedSecret = "xlt-token-jwt-rotated-secret-at-least-32-bytes";

describe("JwtStrategy", () => {
  it("使用 activeKid 签发 Token，并继续用旧密钥验证历史 Token", () => {
    const strategy = new JwtStrategy(
      createJwtStrategyConfig({
        activeKid: "kid-2",
        keys: [
          { kid: "kid-1", algorithm: "HS256", secret: strongSecret },
          { kid: "kid-2", algorithm: "HS256", secret: rotatedSecret },
        ],
        issuer: "xlt-token",
        audience: "xlt-client",
      }),
    );

    const oldToken = sign({ sub: "1001", jti: "old-generation" }, strongSecret, {
      algorithm: "HS256",
      audience: "xlt-client",
      issuer: "xlt-token",
      keyid: "kid-1",
    });
    const newToken = strategy.createToken("1001", DEFAULT_XLT_TOKEN_CONFIG);
    const decoded = decode(newToken, { complete: true });

    expect(decoded?.header.kid).toBe("kid-2");
    expect(strategy.verifyToken(oldToken).jti).toBe("old-generation");
    expect(strategy.verifyToken(newToken).sub).toBe("1001");
  });

  it("拒绝缺失 kid 的 Token", () => {
    const strategy = new JwtStrategy(
      createJwtStrategyConfig({
        activeKid: "kid-1",
        keys: [{ kid: "kid-1", algorithm: "HS256", secret: strongSecret }],
      }),
    );
    const token = sign({ sub: "1001", jti: "without-kid" }, strongSecret, {
      algorithm: "HS256",
    });

    expect(() => strategy.verifyToken(token)).toThrow(/kid/i);
  });

  it("拒绝与密钥声明不一致的算法", () => {
    const strategy = new JwtStrategy(
      createJwtStrategyConfig({
        activeKid: "kid-1",
        keys: [{ kid: "kid-1", algorithm: "HS256", secret: strongSecret }],
      }),
    );
    const token = sign({ sub: "1001", jti: "bad-alg" }, strongSecret, {
      algorithm: "HS384",
      keyid: "kid-1",
    });

    expect(() => strategy.verifyToken(token)).toThrow(/algorithm/i);
  });

  it("拒绝 HMAC 弱密钥", () => {
    expect(() =>
      createJwtStrategyConfig({
        activeKid: "kid-1",
        keys: [{ kid: "kid-1", algorithm: "HS256", secret: "too-short" }],
      }),
    ).toThrow(/weak/i);
  });

  it("未配置 audience 时仍可签发和验证", () => {
    const strategy = new JwtStrategy(
      createJwtStrategyConfig({
        activeKid: "kid-1",
        keys: [{ kid: "kid-1", algorithm: "HS256", secret: strongSecret }],
      }),
    );

    const token = strategy.createToken("1001", DEFAULT_XLT_TOKEN_CONFIG);

    expect(strategy.verifyToken(token).sub).toBe("1001");
  });
});

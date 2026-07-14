import { describe, expect, it } from "vitest";
import {
  DEFAULT_XLT_TOKEN_CONFIG,
  type XltTokenConfig,
} from "../../src/config/xlt-token-config.js";
import { UuidStrategy } from "../../src/token/uuid-strategy.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX_32_REGEX = /^[0-9a-f]{32}$/;

const makeConfig = (overrides: Partial<XltTokenConfig> = {}): XltTokenConfig => ({
  ...DEFAULT_XLT_TOKEN_CONFIG,
  ...overrides,
});

describe("UuidStrategy", () => {
  const strategy = new UuidStrategy();

  it("generateToken 返回 UUID v4", () => {
    expect(strategy.generateToken({})).toMatch(UUID_REGEX);
  });

  it("verifyToken 原样返回 token", () => {
    expect(strategy.verifyToken("abc")).toBe("abc");
  });

  it("createToken 支持 uuid / simple-uuid / random-32", () => {
    expect(strategy.createToken("1", makeConfig({ tokenStyle: "uuid" }))).toMatch(UUID_REGEX);
    expect(strategy.createToken("1", makeConfig({ tokenStyle: "simple-uuid" }))).toMatch(
      HEX_32_REGEX,
    );
    expect(strategy.createToken("1", makeConfig({ tokenStyle: "random-32" }))).toMatch(
      HEX_32_REGEX,
    );
  });

  it("未知 tokenStyle 回退 random-32", () => {
    expect(
      strategy.createToken(
        "1",
        makeConfig({ tokenStyle: "unknown" as XltTokenConfig["tokenStyle"] }),
      ),
    ).toMatch(HEX_32_REGEX);
  });
});

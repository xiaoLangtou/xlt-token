import { describe, expect, it } from "vitest";
import { createStpLogic } from "../helpers/setup-stp-logic.js";
import { DEFAULT_XLT_TOKEN_CONFIG } from "../../src/config/xlt-token-config.js";

describe("TokenLifecycleService", () => {
  it("并发刷新只有一个成功且重放会撤销家族", async () => {
    const { logic } = createStpLogic({
      config: {
        ...DEFAULT_XLT_TOKEN_CONFIG,
        lifecycle: {
          expiration: { mode: "fixed", ttl: "30m" },
          refresh: {
            enabled: true,
            ttl: "7d",
            rotate: true,
            replayDetection: "family",
          },
        },
      },
    });
    const token = await logic.login("u1", { device: "pc" });

    const [first, second] = await Promise.all([
      logic.refreshToken(token),
      logic.refreshToken(token),
    ]);

    expect([first, second].filter((result) => result.ok)).toHaveLength(1);
    expect([first, second].find((result) => !result.ok)).toMatchObject({
      ok: false,
      code: "TOKEN_REPLAYED",
    });
  });

  it("重复撤销同一 token family 返回成功且标记 alreadyRevoked", async () => {
    const { logic } = createStpLogic({
      config: {
        ...DEFAULT_XLT_TOKEN_CONFIG,
        lifecycle: {
          expiration: { mode: "fixed", ttl: "30m" },
          refresh: {
            enabled: true,
            ttl: "7d",
            rotate: true,
            replayDetection: "family",
          },
        },
      },
    });
    const token = await logic.login("u1", { device: "pc" });

    await expect(logic.revoke(token, "family")).resolves.toEqual({
      ok: true,
      alreadyRevoked: false,
      scope: "family",
    });
    await expect(logic.revoke(token, "family")).resolves.toEqual({
      ok: true,
      alreadyRevoked: true,
      scope: "family",
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_XLT_TOKEN_CONFIG,
  StpLogic,
  UuidStrategy,
  type XltAuditEvent,
} from "../../src/index.js";
import { MemoryStore } from "../../src/store/memory-store.js";

describe("XltAuditEvent", () => {
  it("刷新事件不包含原始 Token", async () => {
    const events: XltAuditEvent[] = [];
    const logic = new StpLogic(
      {
        ...DEFAULT_XLT_TOKEN_CONFIG,
        lifecycle: {
          expiration: { ttl: 3600 },
          refresh: { enabled: true, ttl: 7200 },
          revoke: { ttl: 7200 },
        },
      },
      new MemoryStore(),
      new UuidStrategy(),
      { emit: (event) => events.push(event) },
    );

    const token = await logic.login("u1");
    await logic.refreshToken(token);

    expect(JSON.stringify(events)).not.toContain(token);
    expect(events).toContainEqual(
      expect.objectContaining({
        schemaVersion: 1,
        type: "token.refreshed",
        loginId: "u1",
      }),
    );
  });
});

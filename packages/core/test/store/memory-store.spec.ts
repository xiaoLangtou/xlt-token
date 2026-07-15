import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "../../src/store/memory-store.js";
import { finiteTtl, keepTtl, persistentTtl } from "../../src/store/xlt-token-store.interface.js";

describe("MemoryStore", () => {
  let store: MemoryStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new MemoryStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("get / set", () => {
    it("不存在的 key 返回 null", async () => {
      await expect(store.get("missing")).resolves.toBeNull();
    });

    it("set 后可以 get 到值", async () => {
      await store.set("k", "v", finiteTtl(60));
      await expect(store.get("k")).resolves.toMatchObject({ value: "v" });
    });

    it("persistentTtl 表示永不过期", async () => {
      await store.set("k", "v", persistentTtl());
      vi.advanceTimersByTime(10 * 365 * 24 * 3600 * 1000);
      await expect(store.get("k")).resolves.toMatchObject({ value: "v", expiresAt: null });
      await expect(store.getTtl("k")).resolves.toBe(-1);
    });

    it("到期后 get 返回 null", async () => {
      await store.set("k", "v", finiteTtl(5));
      vi.advanceTimersByTime(5_000);
      await expect(store.get("k")).resolves.toBeNull();
    });

    it("无 timer 的 lazy 过期路径也会清理 key", async () => {
      await store.set("k", "v", finiteTtl(2_592_000));
      vi.setSystemTime(Date.now() + 2_592_001_000);
      await expect(store.get("k")).resolves.toBeNull();
      await expect(store.get("k")).resolves.toBeNull();
    });

    it("超长 TTL 不会触发立即过期", async () => {
      await store.set("k", "v", finiteTtl(2_592_000));
      await expect(store.get("k")).resolves.toMatchObject({ value: "v" });
      vi.advanceTimersByTime(24 * 3600 * 1000);
      await expect(store.get("k")).resolves.toMatchObject({ value: "v" });
    });
  });

  describe("delete / compareAndSet / touch", () => {
    it("delete 后 get 返回 null", async () => {
      await store.set("k", "v", finiteTtl(60));
      await store.delete("k");
      await expect(store.get("k")).resolves.toBeNull();
    });

    it("compareAndSet 搭配 keepTtl 只改值", async () => {
      await store.set("k", "v1", finiteTtl(60));
      vi.advanceTimersByTime(10_000);
      await expect(store.compareAndSet("k", "v1", "v2", keepTtl())).resolves.toBe(true);
      await expect(store.get("k")).resolves.toMatchObject({ value: "v2" });
      await expect(store.getTtl("k")).resolves.toBe(50);
    });

    it("compareAndSet key 不存在时返回 false", async () => {
      await expect(store.compareAndSet("missing", "old", "v", keepTtl())).resolves.toBe(false);
    });

    it("touch key 不存在时返回 false", async () => {
      await expect(store.touch("missing", finiteTtl(60))).resolves.toBe(false);
    });

    it("touch 延长过期时间", async () => {
      await store.set("k", "v", finiteTtl(10));
      await store.touch("k", finiteTtl(100));
      vi.advanceTimersByTime(50_000);
      await expect(store.get("k")).resolves.toMatchObject({ value: "v" });
    });
  });

  describe("getTtl / scan", () => {
    it("key 不存在返回 -2", async () => {
      await expect(store.getTtl("missing")).resolves.toBe(-2);
    });

    it("过期后 getTtl 返回 -2", async () => {
      await store.set("k", "v", finiteTtl(5));
      vi.advanceTimersByTime(5_000);
      await expect(store.getTtl("k")).resolves.toBe(-2);
    });

    it("scan 返回匹配前缀且未过期的 key", async () => {
      await store.set("authorization:login:session-list:u1", "[]", finiteTtl(60));
      await store.set("authorization:login:session-list:u2", "[]", finiteTtl(60));
      await store.set("authorization:login:token:t1", "u1", finiteTtl(60));
      const result = await store.scan("authorization:login:session-list:*");
      expect(result.keys.toSorted()).toEqual([
        "authorization:login:session-list:u1",
        "authorization:login:session-list:u2",
      ]);
    });
  });
});

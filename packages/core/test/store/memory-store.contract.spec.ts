import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore, finiteTtl, keepTtl, persistentTtl } from "../../src/index.js";

describe("MemoryStore atomic contract", () => {
  let store: MemoryStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new MemoryStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("只允许一个并发调用 setIfAbsent 成功", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        store.setIfAbsent("lock", String(index), finiteTtl(60)),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    await expect(store.get("lock")).resolves.toMatchObject({ value: expect.any(String) });
  });

  it("compareAndSet 比较失败时不改变值和 TTL", async () => {
    await store.set("key", "v1", finiteTtl(60));

    await expect(store.compareAndSet("key", "wrong", "v2", keepTtl())).resolves.toBe(false);

    await expect(store.get("key")).resolves.toMatchObject({ value: "v1" });
    await expect(store.getTtl("key")).resolves.toBe(60);
  });

  it("compareAndSet 比较成功时可以保留 TTL", async () => {
    await store.set("key", "v1", finiteTtl(60));
    vi.advanceTimersByTime(10_000);

    await expect(store.compareAndSet("key", "v1", "v2", keepTtl())).resolves.toBe(true);

    await expect(store.get("key")).resolves.toMatchObject({ value: "v2" });
    await expect(store.getTtl("key")).resolves.toBe(50);
  });

  it("compareAndDelete 只删除匹配当前值的 key", async () => {
    await store.set("key", "v1", persistentTtl());

    await expect(store.compareAndDelete("key", "wrong")).resolves.toBe(false);
    await expect(store.get("key")).resolves.toMatchObject({ value: "v1" });

    await expect(store.compareAndDelete("key", "v1")).resolves.toBe(true);
    await expect(store.get("key")).resolves.toBeNull();
  });

  it("touch 只更新 TTL 不改变值", async () => {
    await store.set("key", "v1", finiteTtl(10));

    await expect(store.touch("key", finiteTtl(100))).resolves.toBe(true);
    await expect(store.get("key")).resolves.toMatchObject({ value: "v1" });
    await expect(store.getTtl("key")).resolves.toBe(100);
  });

  it("scan 返回匹配前缀的一页 key 和下一游标", async () => {
    await store.set("authorization:login:session-list:u1", "[]", finiteTtl(60));
    await store.set("authorization:login:session-list:u2", "[]", finiteTtl(60));
    await store.set("authorization:login:token:t1", "u1", finiteTtl(60));

    const first = await store.scan("authorization:login:session-list:*", {
      count: 1,
      cursor: null,
    });
    const second = await store.scan("authorization:login:session-list:*", {
      count: 10,
      cursor: first.cursor,
    });

    expect([...first.keys, ...second.keys].toSorted()).toEqual([
      "authorization:login:session-list:u1",
      "authorization:login:session-list:u2",
    ]);
    expect(second.cursor).toBeNull();
  });
});

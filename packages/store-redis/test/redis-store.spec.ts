import { defineStoreContract } from "@xlt-token/store-contract";
import { finiteTtl, keepTtl, persistentTtl } from "@xlt-token/core";
import { RedisStore } from "../src/index.js";

describe("RedisStore", () => {
  const createClient = () => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    persist: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    scan: vi.fn(),
    eval: vi.fn(),
  });

  defineStoreContract("RedisStore", () => {
    const client = createClient();
    const values = new Map<string, { value: string; ttl: number }>();

    client.get.mockImplementation(async (key: string) => values.get(key)?.value ?? null);
    client.ttl.mockImplementation(async (key: string) => values.get(key)?.ttl ?? -2);
    client.del.mockImplementation(async (key: string) => (values.delete(key) ? 1 : 0));
    client.set.mockImplementation(async (key: string, value: string, options?: any) => {
      if (options?.NX && values.has(key)) return null;
      values.set(key, { value, ttl: options?.EX ?? -1 });
      return "OK";
    });
    client.eval.mockImplementation(async (_script: string, options: any) => {
      const [key] = options.keys;
      const entry = values.get(key);
      if (options.arguments.length === 2) {
        if (!entry) return 0;
        const [mode, ttlSeconds] = options.arguments;
        values.set(key, {
          value: entry.value,
          ttl: mode === "persistent" ? -1 : Number(ttlSeconds),
        });
        return 1;
      }
      const [expected, nextValue, mode, ttlSeconds] = options.arguments;
      if (!entry || entry.value !== expected) return 0;
      if (mode === "delete") {
        values.delete(key);
        return 1;
      }
      values.set(key, {
        value: nextValue,
        ttl: mode === "keep" ? entry.ttl : mode === "persistent" ? -1 : Number(ttlSeconds),
      });
      return 1;
    });
    client.scan.mockResolvedValue({ cursor: 0, keys: [] });

    return new RedisStore(client);
  });

  it("maps the XltTokenStore contract to node-redis commands", async () => {
    const client = createClient();
    const store = new RedisStore(client);
    client.get.mockResolvedValue("value");
    client.set.mockResolvedValue("OK");
    client.del.mockResolvedValue(1);
    client.exists.mockResolvedValue(1);
    client.persist.mockResolvedValue(1);
    client.expire.mockResolvedValue(1);
    client.ttl.mockResolvedValue(50);

    await expect(store.get("key")).resolves.toMatchObject({ value: "value" });
    await store.set("key", "value", finiteTtl(60));
    await store.set("permanent", "value", persistentTtl());
    await expect(store.setIfAbsent("lock", "value", finiteTtl(30))).resolves.toBe(true);
    await store.delete("key");
    await store.compareAndSet("key", "value", "updated", keepTtl());
    await store.touch("key", finiteTtl(120));
    await store.touch("key", persistentTtl());

    expect(client.set).toHaveBeenNthCalledWith(1, "key", "value", { EX: 60 });
    expect(client.set).toHaveBeenNthCalledWith(2, "permanent", "value");
    expect(client.set).toHaveBeenNthCalledWith(3, "lock", "value", { EX: 30, NX: true });
    expect(client.eval).toHaveBeenCalled();
    expect(client.del).toHaveBeenCalledWith("key");
  });

  it("returns false when compare or touch misses", async () => {
    const client = createClient();
    const store = new RedisStore(client);
    client.eval.mockResolvedValue(0);

    await expect(store.compareAndSet("missing", "old", "value", keepTtl())).resolves.toBe(false);
    await expect(store.touch("missing", finiteTtl(60))).resolves.toBe(false);
  });

  it("collects keys from all scan pages", async () => {
    const client = createClient();
    const store = new RedisStore(client);
    client.scan
      .mockResolvedValueOnce({
        cursor: 7,
        keys: ["authorization:login:token:a"],
      })
      .mockResolvedValueOnce({
        cursor: 0,
        keys: ["authorization:login:token:b"],
      });

    await expect(store.scan("authorization:login:token:*")).resolves.toEqual({
      keys: ["authorization:login:token:a"],
      cursor: "7",
    });
    expect(client.scan).toHaveBeenNthCalledWith(1, "0", {
      MATCH: "authorization:login:token:*",
      COUNT: 100,
    });
  });
});

import { defineStoreContract } from "@xlt-token/store-contract";
import { finiteTtl, keepTtl, persistentTtl } from "@xlt-token/core";
import { IORedisStore } from "../src/index.js";

describe("IORedisStore", () => {
  const createClient = () => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    persist: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    eval: vi.fn(),
    scan: vi.fn(),
  });

  defineStoreContract("IORedisStore", () => {
    const client = createClient();
    const values = new Map<string, { value: string; ttl: number }>();

    client.get.mockImplementation(async (key: string) => values.get(key)?.value ?? null);
    client.ttl.mockImplementation(async (key: string) => values.get(key)?.ttl ?? -2);
    client.del.mockImplementation(async (key: string) => (values.delete(key) ? 1 : 0));
    client.set.mockImplementation(async (...args: any[]) => {
      const [key, value] = args;
      if (args.includes("NX") && values.has(key)) return null;
      const exIndex = args.indexOf("EX");
      values.set(key, { value, ttl: exIndex >= 0 ? Number(args[exIndex + 1]) : -1 });
      return "OK";
    });
    client.eval.mockImplementation(
      async (_script: string, _keyCount: number, key: string, ...args: any[]) => {
        const entry = values.get(key);
        if (args.length === 0) {
          if (!entry) return null;
          values.delete(key);
          return [entry.value, entry.ttl];
        }
        if (args.length === 2) {
          if (!entry) return 0;
          const [mode, ttlSeconds] = args;
          values.set(key, {
            value: entry.value,
            ttl: mode === "persistent" ? -1 : Number(ttlSeconds),
          });
          return 1;
        }
        const [expected, nextValue, mode, ttlSeconds] = args;
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
      },
    );
    client.scan.mockResolvedValue(["0", []]);

    return new IORedisStore(client);
  });

  it("maps the XltTokenStore contract to ioredis commands", async () => {
    const client = createClient();
    const store = new IORedisStore(client);
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

    expect(client.set).toHaveBeenNthCalledWith(1, "key", "value", "EX", 60);
    expect(client.set).toHaveBeenNthCalledWith(2, "permanent", "value");
    expect(client.set).toHaveBeenNthCalledWith(3, "lock", "value", "NX", "EX", 30);
    expect(client.eval).toHaveBeenCalled();
    expect(client.del).toHaveBeenCalledWith("key");
  });

  it("returns false when compare or touch misses", async () => {
    const client = createClient();
    const store = new IORedisStore(client);
    client.eval.mockResolvedValue(0);

    await expect(store.compareAndSet("missing", "old", "value", keepTtl())).resolves.toBe(false);
    await expect(store.touch("missing", finiteTtl(60))).resolves.toBe(false);
  });

  it("reads and deletes atomically via a single eval script", async () => {
    const client = createClient();
    const store = new IORedisStore(client);
    client.eval.mockResolvedValueOnce(["value", 60]);

    await expect(store.getAndDelete("key")).resolves.toEqual({
      value: "value",
      expiresAt: expect.any(Number),
    });
    expect(client.eval).toHaveBeenCalledWith(expect.stringContaining("DEL"), 1, "key");
  });

  it("returns null when getAndDelete misses", async () => {
    const client = createClient();
    const store = new IORedisStore(client);
    client.eval.mockResolvedValueOnce(null);

    await expect(store.getAndDelete("missing")).resolves.toBeNull();
  });

  it("collects keys from all scan pages", async () => {
    const client = createClient();
    const store = new IORedisStore(client);
    client.scan
      .mockResolvedValueOnce(["7", ["authorization:login:token:a"]])
      .mockResolvedValueOnce(["0", ["authorization:login:token:b"]]);

    await expect(store.scan("authorization:login:token:*")).resolves.toEqual({
      keys: ["authorization:login:token:a"],
      cursor: "7",
    });
    expect(client.scan).toHaveBeenNthCalledWith(
      1,
      "0",
      "MATCH",
      "authorization:login:token:*",
      "COUNT",
      100,
    );
  });

  it("scans one cluster master page per call", async () => {
    const client = createClient();
    const firstMaster = {
      scan: vi.fn().mockResolvedValue(["0", ["authorization:login:token:a"]]),
    };
    const secondMaster = {
      scan: vi.fn().mockResolvedValue(["0", ["authorization:login:token:b"]]),
    };
    const clusterClient = {
      ...client,
      nodes: vi.fn().mockReturnValue([firstMaster, secondMaster]),
    };
    const store = new IORedisStore(clusterClient);

    await expect(store.scan("authorization:login:token:*")).resolves.toEqual({
      keys: ["authorization:login:token:a"],
      cursor: "1:0",
    });
    expect(clusterClient.nodes).toHaveBeenCalledWith("master");
    expect(client.scan).not.toHaveBeenCalled();
    expect(secondMaster.scan).not.toHaveBeenCalled();
  });
});

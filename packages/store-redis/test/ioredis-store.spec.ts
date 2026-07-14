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
    scan: vi.fn(),
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

    await expect(store.get("key")).resolves.toBe("value");
    await store.set("key", "value", 60);
    await store.set("permanent", "value", -1);
    await store.delete("key");
    await store.update("key", "updated");
    await expect(store.has("key")).resolves.toBe(true);
    await store.updateTimeout("key", 120);
    await store.updateTimeout("key", -1);
    await expect(store.getTimeout("key")).resolves.toBe(50);

    expect(client.set).toHaveBeenNthCalledWith(1, "key", "value", "EX", 60);
    expect(client.set).toHaveBeenNthCalledWith(2, "permanent", "value");
    expect(client.set).toHaveBeenNthCalledWith(3, "key", "updated", "XX", "KEEPTTL");
    expect(client.del).toHaveBeenCalledWith("key");
    expect(client.expire).toHaveBeenCalledWith("key", 120);
    expect(client.persist).toHaveBeenCalledWith("key");
  });

  it("throws when updating a missing key or timeout", async () => {
    const client = createClient();
    const store = new IORedisStore(client);
    client.set.mockResolvedValue(null);
    client.exists.mockResolvedValue(0);

    await expect(store.update("missing", "value")).rejects.toThrow("Key not found: missing");
    await expect(store.updateTimeout("missing", 60)).rejects.toThrow("Key not found: missing");
  });

  it("collects keys from all scan pages", async () => {
    const client = createClient();
    const store = new IORedisStore(client);
    client.scan
      .mockResolvedValueOnce(["7", ["authorization:login:token:a"]])
      .mockResolvedValueOnce(["0", ["authorization:login:token:b"]]);

    await expect(store.keys("authorization:login:token:*")).resolves.toEqual([
      "authorization:login:token:a",
      "authorization:login:token:b",
    ]);
    expect(client.scan).toHaveBeenNthCalledWith(
      1,
      "0",
      "MATCH",
      "authorization:login:token:*",
      "COUNT",
      100,
    );
    expect(client.scan).toHaveBeenNthCalledWith(
      2,
      "7",
      "MATCH",
      "authorization:login:token:*",
      "COUNT",
      100,
    );
  });

  it("collects keys from every cluster master", async () => {
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

    await expect(store.keys("authorization:login:token:*")).resolves.toEqual([
      "authorization:login:token:a",
      "authorization:login:token:b",
    ]);
    expect(clusterClient.nodes).toHaveBeenCalledWith("master");
    expect(client.scan).not.toHaveBeenCalled();
  });
});

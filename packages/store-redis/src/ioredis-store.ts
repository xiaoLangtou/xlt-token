import type {
  StoreEntry,
  StoreScanOptions,
  StoreScanResult,
  StoreTtl,
  StoreTtlUpdate,
  XltTokenStore,
} from "@xlt-token/core";

export interface IORedisScanClient {
  scan(
    cursor: string,
    matchToken: "MATCH",
    pattern: string,
    countToken: "COUNT",
    count: number,
  ): Promise<[string, string[]]>;
}

export interface IORedisClient extends IORedisScanClient {
  get(key: string): Promise<string | null>;
  set(...args: any[]): Promise<string | null>;
  del(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
  eval(script: string, keyCount: number, ...args: string[]): Promise<unknown>;
  nodes?(role: "master"): IORedisScanClient[];
}

export class IORedisStore implements XltTokenStore {
  constructor(private readonly redisClient: IORedisClient) {}

  async get(key: string): Promise<StoreEntry | null> {
    const value = await this.redisClient.get(key);
    if (value === null) return null;

    const ttl = await this.redisClient.ttl(key);
    return {
      value,
      expiresAt: ttl < 0 ? null : Date.now() + ttl * 1000,
    };
  }

  async set(key: string, value: string, ttl: StoreTtl): Promise<void> {
    if (ttl.kind === "persistent") {
      await this.redisClient.set(key, value);
      return;
    }

    await this.redisClient.set(key, value, "EX", ttl.seconds);
  }

  async delete(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async getAndDelete(key: string): Promise<StoreEntry | null> {
    const reply = await this.redisClient.eval(GET_AND_DELETE_SCRIPT, 1, key);
    if (!Array.isArray(reply) || reply.length !== 2) return null;

    const [value, ttl] = reply as [string, number];
    return {
      value,
      expiresAt: ttl < 0 ? null : Date.now() + ttl * 1000,
    };
  }

  async setIfAbsent(key: string, value: string, ttl: StoreTtl): Promise<boolean> {
    if (ttl.kind === "persistent") {
      return (await this.redisClient.set(key, value, "NX")) === "OK";
    }

    return (await this.redisClient.set(key, value, "NX", "EX", ttl.seconds)) === "OK";
  }

  async compareAndSet(
    key: string,
    expectedValue: string,
    nextValue: string,
    ttl: StoreTtlUpdate,
  ): Promise<boolean> {
    return (
      Number(
        await this.redisClient.eval(
          COMPARE_AND_MUTATE_SCRIPT,
          1,
          key,
          ...this.mutationArguments(expectedValue, nextValue, ttl),
        ),
      ) === 1
    );
  }

  async compareAndDelete(key: string, expectedValue: string): Promise<boolean> {
    return (
      Number(
        await this.redisClient.eval(
          COMPARE_AND_MUTATE_SCRIPT,
          1,
          key,
          expectedValue,
          "",
          "delete",
          "",
        ),
      ) === 1
    );
  }

  async touch(key: string, ttl: StoreTtl): Promise<boolean> {
    const args = ttl.kind === "persistent" ? ["persistent", ""] : ["finite", String(ttl.seconds)];
    return Number(await this.redisClient.eval(TOUCH_SCRIPT, 1, key, ...args)) === 1;
  }

  async scan(pattern: string, options: StoreScanOptions = {}): Promise<StoreScanResult> {
    const clusterClients = this.redisClient.nodes?.("master");
    const clients = clusterClients ?? [this.redisClient];
    const isCluster = clusterClients !== undefined;
    const parsedCursor = this.parseClusterCursor(options.cursor);
    const client = clients[parsedCursor.clientIndex] ?? clients[0]!;

    const [nextCursor, keys] = await client.scan(
      parsedCursor.cursor,
      "MATCH",
      pattern,
      "COUNT",
      options.count ?? 100,
    );

    if (nextCursor !== "0") {
      return {
        keys,
        cursor: isCluster ? `${parsedCursor.clientIndex}:${nextCursor}` : nextCursor,
      };
    }

    const nextClientIndex = parsedCursor.clientIndex + 1;
    return {
      keys,
      cursor: isCluster && nextClientIndex < clients.length ? `${nextClientIndex}:0` : null,
    };
  }

  private parseClusterCursor(cursor: string | null | undefined): {
    clientIndex: number;
    cursor: string;
  } {
    if (!cursor) return { clientIndex: 0, cursor: "0" };
    const [clientIndex, redisCursor] = cursor.includes(":") ? cursor.split(":") : ["0", cursor];
    return {
      clientIndex: Number(clientIndex),
      cursor: redisCursor ?? "0",
    };
  }

  private mutationArguments(
    expectedValue: string,
    nextValue: string,
    ttl: StoreTtlUpdate,
  ): string[] {
    if (ttl.kind === "keep") return [expectedValue, nextValue, "keep", ""];
    if (ttl.kind === "persistent") return [expectedValue, nextValue, "persistent", ""];
    return [expectedValue, nextValue, "finite", String(ttl.seconds)];
  }
}

const COMPARE_AND_MUTATE_SCRIPT = `
if redis.call("GET", KEYS[1]) ~= ARGV[1] then
  return 0
end
if ARGV[3] == "delete" then
  redis.call("DEL", KEYS[1])
elseif ARGV[3] == "keep" then
  redis.call("SET", KEYS[1], ARGV[2], "KEEPTTL")
elseif ARGV[3] == "persistent" then
  redis.call("SET", KEYS[1], ARGV[2])
else
  redis.call("SET", KEYS[1], ARGV[2], "EX", tonumber(ARGV[4]))
end
return 1
`;

const TOUCH_SCRIPT = `
if redis.call("EXISTS", KEYS[1]) == 0 then
  return 0
end
if ARGV[1] == "persistent" then
  redis.call("PERSIST", KEYS[1])
else
  redis.call("EXPIRE", KEYS[1], tonumber(ARGV[2]))
end
return 1
`;

const GET_AND_DELETE_SCRIPT = `
local value = redis.call("GET", KEYS[1])
if not value then
  return nil
end
local ttl = redis.call("TTL", KEYS[1])
redis.call("DEL", KEYS[1])
return {value, ttl}
`;

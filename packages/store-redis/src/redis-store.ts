import type {
  StoreEntry,
  StoreScanOptions,
  StoreScanResult,
  StoreTtl,
  StoreTtlUpdate,
  XltTokenStore,
} from "@xlt-token/core";

export interface RedisScanReply {
  cursor: string | number;
  keys: string[];
}

export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number; NX?: boolean }): Promise<string | null>;
  del(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
  scan(cursor: string, options: { MATCH: string; COUNT: number }): Promise<RedisScanReply>;
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
}

export class RedisStore implements XltTokenStore {
  constructor(private readonly redisClient: RedisClient) {}

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

    await this.redisClient.set(key, value, { EX: ttl.seconds });
  }

  async delete(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async getAndDelete(key: string): Promise<StoreEntry | null> {
    const reply = await this.redisClient.eval(GET_AND_DELETE_SCRIPT, {
      keys: [key],
      arguments: [],
    });
    if (!Array.isArray(reply) || reply.length !== 2) return null;

    const [value, ttl] = reply as [string, number];
    return {
      value,
      expiresAt: ttl < 0 ? null : Date.now() + ttl * 1000,
    };
  }

  async setIfAbsent(key: string, value: string, ttl: StoreTtl): Promise<boolean> {
    if (ttl.kind === "persistent") {
      return (await this.redisClient.set(key, value, { NX: true })) === "OK";
    }

    return (await this.redisClient.set(key, value, { EX: ttl.seconds, NX: true })) === "OK";
  }

  async compareAndSet(
    key: string,
    expectedValue: string,
    nextValue: string,
    ttl: StoreTtlUpdate,
  ): Promise<boolean> {
    return (
      Number(
        await this.redisClient.eval(COMPARE_AND_MUTATE_SCRIPT, {
          keys: [key],
          arguments: this.mutationArguments(expectedValue, nextValue, ttl),
        }),
      ) === 1
    );
  }

  async compareAndDelete(key: string, expectedValue: string): Promise<boolean> {
    return (
      Number(
        await this.redisClient.eval(COMPARE_AND_MUTATE_SCRIPT, {
          keys: [key],
          arguments: [expectedValue, "", "delete", ""],
        }),
      ) === 1
    );
  }

  async touch(key: string, ttl: StoreTtl): Promise<boolean> {
    return (
      Number(
        await this.redisClient.eval(TOUCH_SCRIPT, {
          keys: [key],
          arguments:
            ttl.kind === "persistent" ? ["persistent", ""] : ["finite", String(ttl.seconds)],
        }),
      ) === 1
    );
  }

  async scan(pattern: string, options: StoreScanOptions = {}): Promise<StoreScanResult> {
    const cursor = options.cursor ?? "0";
    const count = options.count ?? 100;

    const reply = await this.redisClient.scan(cursor, {
      MATCH: pattern,
      COUNT: count,
    });

    const nextCursor = String(reply.cursor);
    return {
      keys: reply.keys,
      cursor: nextCursor === "0" ? null : nextCursor,
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

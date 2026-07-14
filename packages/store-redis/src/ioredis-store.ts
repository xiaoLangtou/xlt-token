import type { XltTokenStore } from "@xlt-token/core";

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
  exists(key: string): Promise<number>;
  persist(key: string): Promise<number>;
  expire(key: string, timeoutSec: number): Promise<number>;
  ttl(key: string): Promise<number>;
  nodes?(role: "master"): IORedisScanClient[];
}

export class IORedisStore implements XltTokenStore {
  constructor(private readonly redisClient: IORedisClient) {}

  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  async set(key: string, value: string, timeoutSec: number): Promise<void> {
    if (timeoutSec === -1) {
      await this.redisClient.set(key, value);
      return;
    }

    await this.redisClient.set(key, value, "EX", timeoutSec);
  }

  async delete(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async update(key: string, value: string): Promise<void> {
    const result = await this.redisClient.set(key, value, "XX", "KEEPTTL");
    if (result === null) {
      throw new Error(`Key not found: ${key}`);
    }
  }

  async has(key: string): Promise<boolean> {
    return (await this.redisClient.exists(key)) === 1;
  }

  async updateTimeout(key: string, timeoutSec: number): Promise<void> {
    if (!(await this.redisClient.exists(key))) {
      throw new Error(`Key not found: ${key}`);
    }

    if (timeoutSec === -1) {
      await this.redisClient.persist(key);
      return;
    }

    await this.redisClient.expire(key, timeoutSec);
  }

  async getTimeout(key: string): Promise<number> {
    return this.redisClient.ttl(key);
  }

  async keys(pattern: string): Promise<string[]> {
    const result: string[] = [];
    const clients = this.redisClient.nodes?.("master") ?? [this.redisClient];

    for (const client of clients) {
      let cursor = "0";

      do {
        const [nextCursor, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = nextCursor;
        result.push(...keys);
      } while (cursor !== "0");
    }

    return result;
  }
}

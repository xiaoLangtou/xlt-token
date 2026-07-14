import type { XltTokenStore } from "@xlt-token/core";

export interface RedisScanReply {
  cursor: string | number;
  keys: string[];
}

export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options?: { EX?: number; XX?: boolean; KEEPTTL?: boolean },
  ): Promise<string | null>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  persist(key: string): Promise<number>;
  expire(key: string, timeoutSec: number): Promise<number>;
  ttl(key: string): Promise<number>;
  scan(cursor: string, options: { MATCH: string; COUNT: number }): Promise<RedisScanReply>;
}

export class RedisStore implements XltTokenStore {
  constructor(private readonly redisClient: RedisClient) {}

  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  async set(key: string, value: string, timeoutSec: number): Promise<void> {
    if (timeoutSec === -1) {
      await this.redisClient.set(key, value);
      return;
    }

    await this.redisClient.set(key, value, { EX: timeoutSec });
  }

  async delete(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async update(key: string, value: string): Promise<void> {
    const result = await this.redisClient.set(key, value, {
      XX: true,
      KEEPTTL: true,
    });
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
    let cursor = "0";

    do {
      const reply = await this.redisClient.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });
      cursor = String(reply.cursor);
      result.push(...reply.keys);
    } while (cursor !== "0");

    return result;
  }
}

import { XltTokenStore } from "@xlt-token/core";

//#region src/redis-store.d.ts
interface RedisScanReply {
  cursor: string | number;
  keys: string[];
}
interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: {
    EX?: number;
    XX?: boolean;
    KEEPTTL?: boolean;
  }): Promise<string | null>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  persist(key: string): Promise<number>;
  expire(key: string, timeoutSec: number): Promise<number>;
  ttl(key: string): Promise<number>;
  scan(cursor: string, options: {
    MATCH: string;
    COUNT: number;
  }): Promise<RedisScanReply>;
}
declare class RedisStore implements XltTokenStore {
  private readonly redisClient;
  constructor(redisClient: RedisClient);
  get(key: string): Promise<string | null>;
  set(key: string, value: string, timeoutSec: number): Promise<void>;
  delete(key: string): Promise<void>;
  update(key: string, value: string): Promise<void>;
  has(key: string): Promise<boolean>;
  updateTimeout(key: string, timeoutSec: number): Promise<void>;
  getTimeout(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}
//#endregion
//#region src/ioredis-store.d.ts
interface IORedisScanClient {
  scan(cursor: string, matchToken: 'MATCH', pattern: string, countToken: 'COUNT', count: number): Promise<[string, string[]]>;
}
interface IORedisClient extends IORedisScanClient {
  get(key: string): Promise<string | null>;
  set(...args: any[]): Promise<string | null>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  persist(key: string): Promise<number>;
  expire(key: string, timeoutSec: number): Promise<number>;
  ttl(key: string): Promise<number>;
  nodes?(role: 'master'): IORedisScanClient[];
}
declare class IORedisStore implements XltTokenStore {
  private readonly redisClient;
  constructor(redisClient: IORedisClient);
  get(key: string): Promise<string | null>;
  set(key: string, value: string, timeoutSec: number): Promise<void>;
  delete(key: string): Promise<void>;
  update(key: string, value: string): Promise<void>;
  has(key: string): Promise<boolean>;
  updateTimeout(key: string, timeoutSec: number): Promise<void>;
  getTimeout(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}
//#endregion
export { type IORedisClient, type IORedisScanClient, IORedisStore, type RedisClient, type RedisScanReply, RedisStore };
//# sourceMappingURL=index.d.mts.map
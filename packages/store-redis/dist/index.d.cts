import { StoreEntry, StoreScanOptions, StoreScanResult, StoreTtl, StoreTtlUpdate, XltTokenStore } from "@xlt-token/core";

//#region src/redis-store.d.ts
interface RedisScanReply {
  cursor: string | number;
  keys: string[];
}
interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: {
    EX?: number;
    NX?: boolean;
  }): Promise<string | null>;
  del(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
  scan(cursor: string, options: {
    MATCH: string;
    COUNT: number;
  }): Promise<RedisScanReply>;
  eval(script: string, options: {
    keys: string[];
    arguments: string[];
  }): Promise<unknown>;
}
declare class RedisStore implements XltTokenStore {
  private readonly redisClient;
  constructor(redisClient: RedisClient);
  get(key: string): Promise<StoreEntry | null>;
  set(key: string, value: string, ttl: StoreTtl): Promise<void>;
  delete(key: string): Promise<void>;
  setIfAbsent(key: string, value: string, ttl: StoreTtl): Promise<boolean>;
  compareAndSet(key: string, expectedValue: string, nextValue: string, ttl: StoreTtlUpdate): Promise<boolean>;
  compareAndDelete(key: string, expectedValue: string): Promise<boolean>;
  touch(key: string, ttl: StoreTtl): Promise<boolean>;
  scan(pattern: string, options?: StoreScanOptions): Promise<StoreScanResult>;
  private mutationArguments;
}
//#endregion
//#region src/ioredis-store.d.ts
interface IORedisScanClient {
  scan(cursor: string, matchToken: "MATCH", pattern: string, countToken: "COUNT", count: number): Promise<[string, string[]]>;
}
interface IORedisClient extends IORedisScanClient {
  get(key: string): Promise<string | null>;
  set(...args: any[]): Promise<string | null>;
  del(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
  eval(script: string, keyCount: number, ...args: string[]): Promise<unknown>;
  nodes?(role: "master"): IORedisScanClient[];
}
declare class IORedisStore implements XltTokenStore {
  private readonly redisClient;
  constructor(redisClient: IORedisClient);
  get(key: string): Promise<StoreEntry | null>;
  set(key: string, value: string, ttl: StoreTtl): Promise<void>;
  delete(key: string): Promise<void>;
  setIfAbsent(key: string, value: string, ttl: StoreTtl): Promise<boolean>;
  compareAndSet(key: string, expectedValue: string, nextValue: string, ttl: StoreTtlUpdate): Promise<boolean>;
  compareAndDelete(key: string, expectedValue: string): Promise<boolean>;
  touch(key: string, ttl: StoreTtl): Promise<boolean>;
  scan(pattern: string, options?: StoreScanOptions): Promise<StoreScanResult>;
  private parseClusterCursor;
  private mutationArguments;
}
//#endregion
export { type IORedisClient, type IORedisScanClient, IORedisStore, type RedisClient, type RedisScanReply, RedisStore };
//# sourceMappingURL=index.d.cts.map
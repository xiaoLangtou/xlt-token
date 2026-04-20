export interface XltTokenStore {
  get(key: string): Promise<string | null>;

  // timeoutSec = -1 表示永不过期；同 key 已存在则覆盖（含过期时间）
  set(key: string, value: string, timeoutSec: number): Promise<void>;

  delete(key: string): Promise<void>;

  has(key: string): Promise<boolean>;

  // 只改值，不动过期时间；key 不存在时抛出异常
  update(key: string, value: string): Promise<void>;

  // 只改过期时间，不动值；用于续签
  updateTimeout(key: string, timeoutSec: number): Promise<void>;

  // -1 = 永久，-2 = key 不存在
  getTimeout(key: string): Promise<number>;
}

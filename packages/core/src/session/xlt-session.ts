import type { XltTokenStore } from "../store/xlt-token-store.interface.js";
import { getStoreValue, ttlFromSeconds } from "../store/store-helpers.js";

export class XltSession {
  private data: Record<string, unknown> | null = null;

  constructor(
    private loginId: string,
    private store: XltTokenStore,
    private storeKey: string,
    private timeout: number,
  ) {}

  /**
   * 获取会话数据
   * @returns The session data.
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    const data = await this.load();
    return data ? ((data[key] as T) ?? null) : null;
  }

  /**
   * 设置会话数据
   * @param key The key of the session data.
   * @param value The value of the session data.
   */
  async set(key: string, value: unknown): Promise<void> {
    await this.mutate((data) => {
      data[key] = value;
    });
  }

  /**
   * 判断会话数据是否存在
   * @param key The key of the session data.
   * @returns A boolean indicating whether the session data exists.
   */
  async has(key: string): Promise<boolean> {
    const data = await this.load();
    return data ? key in data : false;
  }

  /**
   * 删除会话数据
   * @param key The key of the session data.
   */
  async remove(key: string): Promise<void> {
    await this.mutate((data) => {
      delete data[key];
    });
  }

  /**
   * 清空会话数据
   */
  async clear(): Promise<void> {
    this.data = null;
    await this.store.delete(this.storeKey);
  }

  async keys(): Promise<string[]> {
    const data = await this.load();
    return data ? Object.keys(data) : [];
  }

  /**
   * 加载会话数据
   * @returns The session data.
   */
  private async load(): Promise<Record<string, unknown> | null> {
    if (this.data !== null) return this.data;
    const raw = await getStoreValue(this.store, this.storeKey);
    this.data = raw ? JSON.parse(raw) : {};

    return this.data;
  }

  private async mutate(change: (data: Record<string, unknown>) => void): Promise<void> {
    for (;;) {
      const raw = await getStoreValue(this.store, this.storeKey);
      const data: Record<string, unknown> = raw ? JSON.parse(raw) : {};
      change(data);
      const serialized = JSON.stringify(data);
      if (raw === null) {
        if (await this.store.setIfAbsent(this.storeKey, serialized, ttlFromSeconds(this.timeout))) {
          this.data = data;
          return;
        }
      } else if (
        await this.store.compareAndSet(this.storeKey, raw, serialized, ttlFromSeconds(this.timeout))
      ) {
        this.data = data;
        return;
      }
    }
  }
}

import { XltTokenStore } from '../store/xlt-token-store.interface';

export class XltSession {
  private data: Record<string, unknown> | null = null;


  constructor(
    private loginId: string,
    private store: XltTokenStore,
    private storeKey: string,
    private timeout: number,
  ) {
  }

  /**
   * 获取会话数据
   * @returns The session data.
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    const data = await this.load();
    return data ? (data[key] as T) ?? null : null;
  }

  /**
   * 设置会话数据
   * @param key The key of the session data.
   * @param value The value of the session data.
   */
  async set(key: string, value: unknown): Promise<void> {
    const data = await this.load();
    if (data) data[key] = value;
    this.data = data;
    await this.save();
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
    const data = await this.load();
    if (data) delete data[key];
    this.data = data;
    await this.save();
  }

  /**
   * 清空会话数据
   */
  async clear(): Promise<void> {
    this.data = null;
    await this.store.delete(this.storeKey);
  }

  /**
   * 加载会话数据
   * @returns The session data.
   */
  private async load(): Promise<Record<string, unknown> | null> {
    if (this.data !== null) return this.data;
    const raw = await this.store.get(this.storeKey);
    this.data = raw ? JSON.parse(raw) : {};

    return this.data;
  }

  /**
   * 保存会话数据
   */
  private async save(): Promise<void> {
    await this.store.set(this.storeKey, JSON.stringify(this.data), this.timeout);
  }
}

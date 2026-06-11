import type { XltTokenStore } from './xlt-token-store.interface.js';

interface MemoryEntry {
  value: string;
  expireAt: number;
  timer: NodeJS.Timeout | null;
}

export class MemoryStore implements XltTokenStore {
  private static readonly MAX_TIMER_DELAY_MS = 2 ** 31 - 1;
  private readonly store = new Map<string, MemoryEntry>();

  async get(key: string): Promise<string | null> {
    const entry = this.peek(key);
    return entry ? entry.value : null;
  }

  async set(key: string, value: string, timeoutSec: number): Promise<void> {
    this.clearTimer(key);
    const entry: MemoryEntry = {
      value,
      expireAt: timeoutSec === -1 ? -1 : Date.now() + timeoutSec * 1000,
      timer: null,
    };
    this.scheduleExpire(key, entry, timeoutSec);
    this.store.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.clearTimer(key);
    this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.peek(key) !== null;
  }

  async update(key: string, value: string): Promise<void> {
    const entry = this.peek(key);
    if (!entry) {
      throw new Error(`key not found: ${key}`);
    }
    entry.value = value;
  }

  async updateTimeout(key: string, timeoutSec: number): Promise<void> {
    const entry = this.peek(key);
    if (!entry) {
      throw new Error(`key not found: ${key}`);
    }
    this.clearTimer(key);
    entry.expireAt = timeoutSec === -1 ? -1 : Date.now() + timeoutSec * 1000;
    this.scheduleExpire(key, entry, timeoutSec);
  }

  async getTimeout(key: string): Promise<number> {
    const entry = this.peek(key);
    if (!entry) return -2;
    if (entry.expireAt === -1) return -1;
    const remainMs = entry.expireAt - Date.now();
    return remainMs <= 0 ? -2 : Math.floor(remainMs / 1000);
  }

  async keys(pattern: string): Promise<string[]> {
    const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
    const result: string[] = [];
    for (const [key] of this.store) {
      if (key.startsWith(prefix) && this.peek(key)) {
        result.push(key);
      }
    }
    return result;
  }

  private peek(key: string): MemoryEntry | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expireAt !== -1 && entry.expireAt <= Date.now()) {
      this.clearTimer(key);
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  private clearTimer(key: string): void {
    const entry = this.store.get(key);
    if (entry?.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
  }

  private scheduleExpire(key: string, entry: MemoryEntry, timeoutSec: number): void {
    if (timeoutSec === -1) return;
    const delayMs = timeoutSec * 1000;
    if (delayMs > MemoryStore.MAX_TIMER_DELAY_MS) {
      console.warn(`[MemoryStore] timeout ${timeoutSec}s exceeds max timer delay (${MemoryStore.MAX_TIMER_DELAY_MS}ms). Entry will be cleaned on next access.`);
      return;
    }
    entry.timer = setTimeout(() => {
      this.store.delete(key);
    }, delayMs);
    entry.timer.unref?.();
  }
}

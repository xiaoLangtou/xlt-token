import type {
  StoreEntry,
  StoreScanOptions,
  StoreScanResult,
  StoreTtl,
  StoreTtlUpdate,
  XltTokenStore,
} from "./xlt-token-store.interface.js";

interface MemoryEntry {
  value: string;
  expiresAt: number | null;
  timer: NodeJS.Timeout | null;
}

export class MemoryStore implements XltTokenStore {
  private static readonly MAX_TIMER_DELAY_MS = 2 ** 31 - 1;
  private readonly store = new Map<string, MemoryEntry>();

  async get(key: string): Promise<StoreEntry | null> {
    const entry = this.peek(key);
    return entry ? { value: entry.value, expiresAt: entry.expiresAt } : null;
  }

  async set(key: string, value: string, ttl: StoreTtl): Promise<void> {
    this.write(key, value, ttl);
  }

  async delete(key: string): Promise<void> {
    this.clearTimer(key);
    this.store.delete(key);
  }

  async setIfAbsent(key: string, value: string, ttl: StoreTtl): Promise<boolean> {
    if (this.peek(key)) return false;
    this.write(key, value, ttl);
    return true;
  }

  async compareAndSet(
    key: string,
    expectedValue: string,
    nextValue: string,
    ttl: StoreTtlUpdate,
  ): Promise<boolean> {
    const entry = this.peek(key);
    if (!entry || entry.value !== expectedValue) return false;

    if (ttl.kind === "keep") {
      entry.value = nextValue;
      return true;
    }

    this.write(key, nextValue, ttl);
    return true;
  }

  async compareAndDelete(key: string, expectedValue: string): Promise<boolean> {
    const entry = this.peek(key);
    if (!entry || entry.value !== expectedValue) return false;
    this.clearTimer(key);
    this.store.delete(key);
    return true;
  }

  async touch(key: string, ttl: StoreTtl): Promise<boolean> {
    const entry = this.peek(key);
    if (!entry) return false;
    this.write(key, entry.value, ttl);
    return true;
  }

  async scan(pattern: string, options: StoreScanOptions = {}): Promise<StoreScanResult> {
    const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
    const keys: string[] = [];
    for (const [key] of this.store) {
      if (key.startsWith(prefix) && this.peek(key)) {
        keys.push(key);
      }
    }
    keys.sort();

    const count = options.count ?? keys.length;
    const start = options.cursor ? Number(options.cursor) : 0;
    const selected = keys.slice(start, start + count);
    const next = start + selected.length;

    return {
      keys: selected,
      cursor: next < keys.length ? String(next) : null,
    };
  }

  async getTtl(key: string): Promise<number> {
    const entry = this.peek(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    const remainMs = entry.expiresAt - Date.now();
    return remainMs <= 0 ? -2 : Math.floor(remainMs / 1000);
  }

  private peek(key: string): MemoryEntry | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
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

  private write(key: string, value: string, ttl: StoreTtl): void {
    this.clearTimer(key);
    const entry: MemoryEntry = {
      value,
      expiresAt: ttl.kind === "persistent" ? null : Date.now() + ttl.seconds * 1000,
      timer: null,
    };
    this.scheduleExpire(key, entry, ttl);
    this.store.set(key, entry);
  }

  private scheduleExpire(key: string, entry: MemoryEntry, ttl: StoreTtl): void {
    if (ttl.kind === "persistent") return;
    const delayMs = ttl.seconds * 1000;
    if (delayMs > MemoryStore.MAX_TIMER_DELAY_MS) {
      console.warn(
        `[MemoryStore] timeout ${ttl.seconds}s exceeds max timer delay (${MemoryStore.MAX_TIMER_DELAY_MS}ms). Entry will be cleaned on next access.`,
      );
      return;
    }
    entry.timer = setTimeout(() => {
      this.store.delete(key);
    }, delayMs);
    entry.timer.unref?.();
  }
}

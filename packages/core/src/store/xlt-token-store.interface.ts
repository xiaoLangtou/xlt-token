export type StoreTtl = { kind: "finite"; seconds: number } | { kind: "persistent" };

export type StoreTtlUpdate = StoreTtl | { kind: "keep" };

export interface StoreEntry {
  value: string;
  expiresAt: number | null;
}

export interface StoreScanOptions {
  cursor?: string | null;
  count?: number;
}

export interface StoreScanResult {
  keys: string[];
  cursor: string | null;
}

export interface XltTokenStore {
  get(key: string): Promise<StoreEntry | null>;

  set(key: string, value: string, ttl: StoreTtl): Promise<void>;

  delete(key: string): Promise<void>;

  setIfAbsent(key: string, value: string, ttl: StoreTtl): Promise<boolean>;

  compareAndSet(
    key: string,
    expectedValue: string,
    nextValue: string,
    ttl: StoreTtlUpdate,
  ): Promise<boolean>;

  compareAndDelete(key: string, expectedValue: string): Promise<boolean>;

  touch(key: string, ttl: StoreTtl): Promise<boolean>;

  scan(pattern: string, options?: StoreScanOptions): Promise<StoreScanResult>;
}

export function finiteTtl(seconds: number): StoreTtl {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error(`finite ttl seconds must be a non-negative finite number: ${seconds}`);
  }
  return { kind: "finite", seconds };
}

export function persistentTtl(): StoreTtl {
  return { kind: "persistent" };
}

export function keepTtl(): StoreTtlUpdate {
  return { kind: "keep" };
}

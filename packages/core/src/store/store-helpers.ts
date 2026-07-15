import {
  finiteTtl,
  keepTtl,
  persistentTtl,
  type StoreTtl,
  type XltTokenStore,
} from "./xlt-token-store.interface.js";

export function ttlFromSeconds(seconds: number): StoreTtl {
  return seconds === -1 ? persistentTtl() : finiteTtl(seconds);
}

export async function getStoreValue(store: XltTokenStore, key: string): Promise<string | null> {
  return (await store.get(key))?.value ?? null;
}

export async function hasStoreValue(store: XltTokenStore, key: string): Promise<boolean> {
  return (await store.get(key)) !== null;
}

export async function setStoreValue(
  store: XltTokenStore,
  key: string,
  value: string,
  timeoutSec: number,
): Promise<void> {
  await store.set(key, value, ttlFromSeconds(timeoutSec));
}

export async function replaceStoreValueKeepingTtl(
  store: XltTokenStore,
  key: string,
  value: string,
): Promise<void> {
  const current = await getStoreValue(store, key);
  if (current === null) {
    throw new Error(`key not found: ${key}`);
  }
  await store.compareAndSet(key, current, value, keepTtl());
}

export async function touchStoreValue(
  store: XltTokenStore,
  key: string,
  timeoutSec: number,
): Promise<void> {
  const touched = await store.touch(key, ttlFromSeconds(timeoutSec));
  if (!touched) {
    throw new Error(`key not found: ${key}`);
  }
}

export async function scanStoreKeys(store: XltTokenStore, pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | null = null;

  do {
    const result = await store.scan(pattern, { cursor, count: 100 });
    keys.push(...result.keys);
    cursor = result.cursor;
  } while (cursor !== null);

  return keys;
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStore } from './memory-store.js';

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new MemoryStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('get / set', () => {
    it('不存在的 key 返回 null', async () => {
      await expect(store.get('missing')).resolves.toBeNull();
    });

    it('set 后可以 get 到值', async () => {
      await store.set('k', 'v', 60);
      await expect(store.get('k')).resolves.toBe('v');
    });

    it('timeoutSec = -1 表示永不过期', async () => {
      await store.set('k', 'v', -1);
      vi.advanceTimersByTime(10 * 365 * 24 * 3600 * 1000);
      await expect(store.get('k')).resolves.toBe('v');
      await expect(store.getTimeout('k')).resolves.toBe(-1);
    });

    it('到期后 get 返回 null', async () => {
      await store.set('k', 'v', 5);
      vi.advanceTimersByTime(5_000);
      await expect(store.get('k')).resolves.toBeNull();
    });

    it('无 timer 的 lazy 过期路径也会清理 key', async () => {
      await store.set('k', 'v', 2_592_000);
      vi.setSystemTime(Date.now() + 2_592_001_000);
      await expect(store.get('k')).resolves.toBeNull();
      await expect(store.has('k')).resolves.toBe(false);
    });

    it('超长 TTL 不会触发立即过期', async () => {
      await store.set('k', 'v', 2_592_000);
      await expect(store.get('k')).resolves.toBe('v');
      vi.advanceTimersByTime(24 * 3600 * 1000);
      await expect(store.get('k')).resolves.toBe('v');
    });
  });

  describe('delete / has / update / updateTimeout', () => {
    it('delete 后 has 返回 false', async () => {
      await store.set('k', 'v', 60);
      await store.delete('k');
      await expect(store.has('k')).resolves.toBe(false);
    });

    it('update 只改值', async () => {
      await store.set('k', 'v1', 60);
      vi.advanceTimersByTime(10_000);
      await store.update('k', 'v2');
      await expect(store.get('k')).resolves.toBe('v2');
    });

    it('update key 不存在时抛出异常', async () => {
      await expect(store.update('missing', 'v')).rejects.toThrow(/key not found/);
    });

    it('updateTimeout key 不存在时抛出异常', async () => {
      await expect(store.updateTimeout('missing', 60)).rejects.toThrow(/key not found/);
    });

    it('updateTimeout 延长过期时间', async () => {
      await store.set('k', 'v', 10);
      await store.updateTimeout('k', 100);
      vi.advanceTimersByTime(50_000);
      await expect(store.get('k')).resolves.toBe('v');
    });
  });

  describe('getTimeout / keys', () => {
    it('key 不存在返回 -2', async () => {
      await expect(store.getTimeout('missing')).resolves.toBe(-2);
    });

    it('过期后 getTimeout 返回 -2', async () => {
      await store.set('k', 'v', 5);
      vi.advanceTimersByTime(5_000);
      await expect(store.getTimeout('k')).resolves.toBe(-2);
    });

    it('keys 返回匹配前缀且未过期的 key', async () => {
      await store.set('authorization:login:session-list:u1', '[]', 60);
      await store.set('authorization:login:session-list:u2', '[]', 60);
      await store.set('authorization:login:token:t1', 'u1', 60);
      const result = await store.keys('authorization:login:session-list:*');
      expect(result.sort()).toEqual([
        'authorization:login:session-list:u1',
        'authorization:login:session-list:u2',
      ]);
    });
  });
});

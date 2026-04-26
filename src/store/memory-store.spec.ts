import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { MemoryStore } from './memory-store';

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(async () => {
    vi.useFakeTimers();
    const module: TestingModule = await Test.createTestingModule({
      providers: [MemoryStore],
    }).compile();
    store = module.get<MemoryStore>(MemoryStore);
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

    it('同 key 再次 set 会覆盖值和过期时间', async () => {
      await store.set('k', 'v1', 60);
      await store.set('k', 'v2', 120);
      await expect(store.get('k')).resolves.toBe('v2');
      await expect(store.getTimeout('k')).resolves.toBe(120);
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

    it('超长 TTL 不会触发立即过期', async () => {
      await store.set('k', 'v', 2_592_000);
      await expect(store.get('k')).resolves.toBe('v');
      vi.advanceTimersByTime(24 * 3600 * 1000);
      await expect(store.get('k')).resolves.toBe('v');
    });
  });

  describe('delete / has', () => {
    it('delete 后 has 返回 false', async () => {
      await store.set('k', 'v', 60);
      await store.delete('k');
      await expect(store.has('k')).resolves.toBe(false);
      await expect(store.get('k')).resolves.toBeNull();
    });

    it('has 对存在未过期的 key 返回 true', async () => {
      await store.set('k', 'v', 60);
      await expect(store.has('k')).resolves.toBe(true);
    });

    it('has 对已过期的 key 返回 false', async () => {
      await store.set('k', 'v', 1);
      vi.advanceTimersByTime(1_000);
      await expect(store.has('k')).resolves.toBe(false);
    });
  });

  describe('update', () => {
    it('只更新值，不影响过期时间', async () => {
      await store.set('k', 'v1', 60);
      vi.advanceTimersByTime(10_000);
      await store.update('k', 'v2');
      await expect(store.get('k')).resolves.toBe('v2');
      const ttl = await store.getTimeout('k');
      expect(ttl).toBeGreaterThan(45);
      expect(ttl).toBeLessThanOrEqual(50);
    });

    it('key 不存在时抛出异常', async () => {
      await expect(store.update('missing', 'v')).rejects.toThrow(/key not found/);
    });
  });

  describe('updateTimeout', () => {
    it('只更新过期时间，不影响值', async () => {
      await store.set('k', 'v', 60);
      await store.updateTimeout('k', 120);
      await expect(store.get('k')).resolves.toBe('v');
      await expect(store.getTimeout('k')).resolves.toBe(120);
    });

    it('更新后到新时间才过期', async () => {
      await store.set('k', 'v', 10);
      await store.updateTimeout('k', 100);
      vi.advanceTimersByTime(50_000);
      await expect(store.get('k')).resolves.toBe('v');
      vi.advanceTimersByTime(51_000);
      await expect(store.get('k')).resolves.toBeNull();
    });

    it('可以改为永不过期', async () => {
      await store.set('k', 'v', 5);
      await store.updateTimeout('k', -1);
      vi.advanceTimersByTime(1_000_000);
      await expect(store.getTimeout('k')).resolves.toBe(-1);
    });

    it('key 不存在时抛出异常', async () => {
      await expect(store.updateTimeout('missing', 60)).rejects.toThrow(/key not found/);
    });
  });

  describe('getTimeout', () => {
    it('key 不存在返回 -2', async () => {
      await expect(store.getTimeout('missing')).resolves.toBe(-2);
    });

    it('永不过期返回 -1', async () => {
      await store.set('k', 'v', -1);
      await expect(store.getTimeout('k')).resolves.toBe(-1);
    });

    it('返回剩余秒数', async () => {
      await store.set('k', 'v', 100);
      vi.advanceTimersByTime(30_000);
      const ttl = await store.getTimeout('k');
      expect(ttl).toBeGreaterThan(65);
      expect(ttl).toBeLessThanOrEqual(70);
    });

    it('过期后返回 -2', async () => {
      await store.set('k', 'v', 5);
      vi.advanceTimersByTime(5_000);
      await expect(store.getTimeout('k')).resolves.toBe(-2);
    });
  });
});

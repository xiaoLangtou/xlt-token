import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { XltSession } from './xlt-session';
import { MemoryStore } from '../store/memory-store';
import { XLT_TOKEN_STORE } from '../core/xlt-token-config';

describe('XltSession', () => {
  let store: MemoryStore;
  const storeKey = 'test:login:session-data:u1';
  const timeout = 3600;

  const createSession = () => new XltSession('u1', store, storeKey, timeout);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: XLT_TOKEN_STORE, useClass: MemoryStore },
      ],
    }).compile();
    store = module.get<MemoryStore>(XLT_TOKEN_STORE);
  });

  describe('get / set', () => {
    it('set 后可以 get 到值', async () => {
      const session = createSession();
      await session.set('name', 'Alice');
      expect(await session.get('name')).toBe('Alice');
    });

    it('get 不存在的 key 返回 null', async () => {
      const session = createSession();
      expect(await session.get('nonexistent')).toBeNull();
    });

    it('set 覆盖已有值', async () => {
      const session = createSession();
      await session.set('name', 'Alice');
      await session.set('name', 'Bob');
      expect(await session.get('name')).toBe('Bob');
    });

    it('支持对象值', async () => {
      const session = createSession();
      const profile = { age: 25, roles: ['admin'] };
      await session.set('profile', profile);
      expect(await session.get('profile')).toEqual(profile);
    });

    it('数据持久化到 store', async () => {
      const session = createSession();
      await session.set('key', 'value');
      const session2 = createSession();
      expect(await session2.get('key')).toBe('value');
    });
  });

  describe('has', () => {
    it('存在的 key 返回 true', async () => {
      const session = createSession();
      await session.set('name', 'Alice');
      expect(await session.has('name')).toBe(true);
    });

    it('不存在的 key 返回 false', async () => {
      const session = createSession();
      expect(await session.has('nonexistent')).toBe(false);
    });
  });

  describe('remove', () => {
    it('remove 后 get 返回 null', async () => {
      const session = createSession();
      await session.set('name', 'Alice');
      await session.remove('name');
      expect(await session.get('name')).toBeNull();
    });

    it('remove 后 has 返回 false', async () => {
      const session = createSession();
      await session.set('name', 'Alice');
      await session.remove('name');
      expect(await session.has('name')).toBe(false);
    });

    it('remove 不存在的 key 不报错', async () => {
      const session = createSession();
      await expect(session.remove('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('keys', () => {
    it('返回所有 key', async () => {
      const session = createSession();
      await session.set('a', 1);
      await session.set('b', 2);
      await session.set('c', 3);
      const keys = await session.keys();
      expect(keys.sort()).toEqual(['a', 'b', 'c']);
    });

    it('空 session 返回空数组', async () => {
      const session = createSession();
      expect(await session.keys()).toEqual([]);
    });
  });

  describe('clear', () => {
    it('clear 后所有数据清空', async () => {
      const session = createSession();
      await session.set('a', 1);
      await session.set('b', 2);
      await session.clear();
      const session2 = createSession();
      expect(await session2.keys()).toEqual([]);
      expect(await session2.get('a')).toBeNull();
    });

    it('clear 后 store 中 key 被删除', async () => {
      const session = createSession();
      await session.set('a', 1);
      await session.clear();
      expect(await store.has(storeKey)).toBe(false);
    });
  });
});

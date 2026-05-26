import { RedisStore, XLT_REDIS_CLIENT } from './redis-store';
import { Test, TestingModule } from '@nestjs/testing';

describe('RedisStore', () => {
  let store: RedisStore;
  let redisClient: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisStore,
        {
          provide: XLT_REDIS_CLIENT,
          useValue: {
            get: vi.fn(),
            set: vi.fn(),
            del: vi.fn(),
            exists: vi.fn(),
            persist: vi.fn(),
            expire: vi.fn(),
            ttl: vi.fn(),
          },
        },
      ],
    }).compile();

    store = module.get<RedisStore>(RedisStore);
    redisClient = module.get(XLT_REDIS_CLIENT);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('应该返回存在的值', async () => {
      redisClient.get.mockResolvedValue('value');
      const result = await store.get('key');
      expect(result).toBe('value');
      expect(redisClient.get).toHaveBeenCalledWith('key');
    });

    it('key 不存在时返回 null', async () => {
      redisClient.get.mockResolvedValue(null);
      const result = await store.get('missing');
      expect(result).toBeNull();
      expect(redisClient.get).toHaveBeenCalledWith('missing');
    });
  });

  describe('set', () => {
    it('设置带过期时间的键值', async () => {
      redisClient.set.mockResolvedValue('OK');
      await store.set('key', 'value', 60);
      expect(redisClient.set).toHaveBeenCalledWith('key', 'value', { EX: 60 });
    });

    it('timeoutSec = -1 表示永不过期', async () => {
      redisClient.set.mockResolvedValue('OK');
      await store.set('key', 'value', -1);
      expect(redisClient.set).toHaveBeenCalledWith('key', 'value');
    });

    it('覆盖已存在的键值', async () => {
      redisClient.set.mockResolvedValue('OK');
      await store.set('key', 'value1', 60);
      await store.set('key', 'value2', 120);
      expect(redisClient.set).toHaveBeenCalledTimes(2);
      expect(redisClient.set).toHaveBeenLastCalledWith('key', 'value2', { EX: 120 });
    });
  });

  describe('delete', () => {
    it('成功删除键', async () => {
      redisClient.del.mockResolvedValue(1);
      await store.delete('key');
      expect(redisClient.del).toHaveBeenCalledWith('key');
    });

    it('删除不存在的键不报错', async () => {
      redisClient.del.mockResolvedValue(0);
      await store.delete('missing');
      expect(redisClient.del).toHaveBeenCalledWith('missing');
    });
  });

  describe('update', () => {
    it('更新存在的键值，保持过期时间', async () => {
      redisClient.set.mockResolvedValue('OK');
      await store.update('key', 'newValue');
      expect(redisClient.set).toHaveBeenCalledWith('key', 'newValue', {
        XX: true,
        KEEPTTL: true,
      });
    });

    it('key 不存在时抛出异常', async () => {
      redisClient.set.mockResolvedValue(null);
      await expect(store.update('missing', 'value')).rejects.toThrow('Key not found: missing');
      expect(redisClient.set).toHaveBeenCalledWith('missing', 'value', {
        XX: true,
        KEEPTTL: true,
      });
    });
  });

  describe('has', () => {
    it('存在的键返回 true', async () => {
      redisClient.exists.mockResolvedValue(1);
      const result = await store.has('key');
      expect(result).toBe(true);
      expect(redisClient.exists).toHaveBeenCalledWith('key');
    });

    it('不存在的键返回 false', async () => {
      redisClient.exists.mockResolvedValue(0);
      const result = await store.has('missing');
      expect(result).toBe(false);
      expect(redisClient.exists).toHaveBeenCalledWith('missing');
    });
  });

  describe('updateTimeout', () => {
    it('更新键的过期时间', async () => {
      redisClient.exists.mockResolvedValue(1);
      redisClient.expire.mockResolvedValue(1);
      await store.updateTimeout('key', 120);
      expect(redisClient.exists).toHaveBeenCalledWith('key');
      expect(redisClient.expire).toHaveBeenCalledWith('key', 120);
    });

    it('更新为永不过期', async () => {
      redisClient.exists.mockResolvedValue(1);
      redisClient.persist.mockResolvedValue(1);
      await store.updateTimeout('key', -1);
      expect(redisClient.exists).toHaveBeenCalledWith('key');
      expect(redisClient.persist).toHaveBeenCalledWith('key');
    });

    it('key 不存在时抛出异常', async () => {
      redisClient.exists.mockResolvedValue(0);
      await expect(store.updateTimeout('missing', 60)).rejects.toThrow('Key not found: missing');
      expect(redisClient.exists).toHaveBeenCalledWith('missing');
      expect(redisClient.expire).not.toHaveBeenCalled();
    });
  });

  describe('getTimeout', () => {
    it('key 不存在返回 -2', async () => {
      redisClient.ttl.mockResolvedValue(-2);
      const result = await store.getTimeout('missing');
      expect(result).toBe(-2);
      expect(redisClient.ttl).toHaveBeenCalledWith('missing');
    });

    it('永不过期返回 -1', async () => {
      redisClient.ttl.mockResolvedValue(-1);
      const result = await store.getTimeout('key');
      expect(result).toBe(-1);
      expect(redisClient.ttl).toHaveBeenCalledWith('key');
    });

    it('返回剩余秒数', async () => {
      redisClient.ttl.mockResolvedValue(50);
      const result = await store.getTimeout('key');
      expect(result).toBe(50);
      expect(redisClient.ttl).toHaveBeenCalledWith('key');
    });
  });
});

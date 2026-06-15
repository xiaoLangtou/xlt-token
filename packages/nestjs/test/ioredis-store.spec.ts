import { Test, type TestingModule } from '@nestjs/testing';
import { IORedisStore, XLT_IOREDIS_CLIENT } from '../src/store/ioredis-store';
import { IORedisStore as BaseIORedisStore } from '@xlt-token/store-redis';

describe('IORedisStore', () => {
  let store: IORedisStore;
  let redisClient: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    persist: ReturnType<typeof vi.fn>;
    expire: ReturnType<typeof vi.fn>;
    ttl: ReturnType<typeof vi.fn>;
    scan: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IORedisStore,
        {
          provide: XLT_IOREDIS_CLIENT,
          useValue: {
            get: vi.fn(),
            set: vi.fn(),
            del: vi.fn(),
            exists: vi.fn(),
            persist: vi.fn(),
            expire: vi.fn(),
            ttl: vi.fn(),
            scan: vi.fn(),
          },
        },
      ],
    }).compile();

    store = module.get(IORedisStore);
    redisClient = module.get(XLT_IOREDIS_CLIENT);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('extends the framework-agnostic IORedisStore', () => {
    expect(store).toBeInstanceOf(BaseIORedisStore);
  });

  it('gets a value', async () => {
    redisClient.get.mockResolvedValue('value');

    await expect(store.get('key')).resolves.toBe('value');
    expect(redisClient.get).toHaveBeenCalledWith('key');
  });

  it('sets a value with an expiration', async () => {
    redisClient.set.mockResolvedValue('OK');

    await store.set('key', 'value', 60);

    expect(redisClient.set).toHaveBeenCalledWith('key', 'value', 'EX', 60);
  });

  it('sets a value without an expiration', async () => {
    redisClient.set.mockResolvedValue('OK');

    await store.set('key', 'value', -1);

    expect(redisClient.set).toHaveBeenCalledWith('key', 'value');
  });

  it('deletes a value', async () => {
    redisClient.del.mockResolvedValue(1);

    await store.delete('key');

    expect(redisClient.del).toHaveBeenCalledWith('key');
  });

  it('updates an existing value while keeping its TTL', async () => {
    redisClient.set.mockResolvedValue('OK');

    await store.update('key', 'new-value');

    expect(redisClient.set).toHaveBeenCalledWith('key', 'new-value', 'XX', 'KEEPTTL');
  });

  it('throws when updating a missing value', async () => {
    redisClient.set.mockResolvedValue(null);

    await expect(store.update('missing', 'value')).rejects.toThrow('Key not found: missing');
  });

  it('reports whether a value exists', async () => {
    redisClient.exists.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    await expect(store.has('existing')).resolves.toBe(true);
    await expect(store.has('missing')).resolves.toBe(false);
  });

  it('updates the expiration', async () => {
    redisClient.exists.mockResolvedValue(1);
    redisClient.expire.mockResolvedValue(1);

    await store.updateTimeout('key', 120);

    expect(redisClient.expire).toHaveBeenCalledWith('key', 120);
  });

  it('removes the expiration', async () => {
    redisClient.exists.mockResolvedValue(1);
    redisClient.persist.mockResolvedValue(1);

    await store.updateTimeout('key', -1);

    expect(redisClient.persist).toHaveBeenCalledWith('key');
  });

  it('throws when updating the timeout of a missing value', async () => {
    redisClient.exists.mockResolvedValue(0);

    await expect(store.updateTimeout('missing', 60)).rejects.toThrow('Key not found: missing');
    expect(redisClient.expire).not.toHaveBeenCalled();
  });

  it('returns the Redis TTL value', async () => {
    redisClient.ttl.mockResolvedValue(50);

    await expect(store.getTimeout('key')).resolves.toBe(50);
    expect(redisClient.ttl).toHaveBeenCalledWith('key');
  });

  it('collects keys from all scan pages', async () => {
    redisClient.scan
      .mockResolvedValueOnce(['7', ['authorization:login:token:a']])
      .mockResolvedValueOnce(['0', ['authorization:login:token:b']]);

    await expect(store.keys('authorization:login:token:*')).resolves.toEqual([
      'authorization:login:token:a',
      'authorization:login:token:b',
    ]);
    expect(redisClient.scan).toHaveBeenNthCalledWith(
      1,
      '0',
      'MATCH',
      'authorization:login:token:*',
      'COUNT',
      100,
    );
    expect(redisClient.scan).toHaveBeenNthCalledWith(
      2,
      '7',
      'MATCH',
      'authorization:login:token:*',
      'COUNT',
      100,
    );
  });

  it('collects keys from every master in an ioredis cluster', async () => {
    const firstMaster = {
      scan: vi.fn().mockResolvedValue(['0', ['authorization:login:token:a']]),
    };
    const secondMaster = {
      scan: vi.fn().mockResolvedValue(['0', ['authorization:login:token:b']]),
    };
    const clusterClient = {
      ...redisClient,
      nodes: vi.fn().mockReturnValue([firstMaster, secondMaster]),
    };
    const clusterStore = new IORedisStore(clusterClient);

    await expect(clusterStore.keys('authorization:login:token:*')).resolves.toEqual([
      'authorization:login:token:a',
      'authorization:login:token:b',
    ]);
    expect(clusterClient.nodes).toHaveBeenCalledWith('master');
    expect(firstMaster.scan).toHaveBeenCalledWith(
      '0',
      'MATCH',
      'authorization:login:token:*',
      'COUNT',
      100,
    );
    expect(secondMaster.scan).toHaveBeenCalledWith(
      '0',
      'MATCH',
      'authorization:login:token:*',
      'COUNT',
      100,
    );
    expect(redisClient.scan).not.toHaveBeenCalled();
  });
});

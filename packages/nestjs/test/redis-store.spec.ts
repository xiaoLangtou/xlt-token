import { Test, type TestingModule } from "@nestjs/testing";
import { finiteTtl, persistentTtl } from "@xlt-token/core";
import { RedisStore as BaseRedisStore } from "@xlt-token/store-redis";
import { RedisStore, XLT_REDIS_CLIENT } from "../src/store/redis-store";

describe("RedisStore", () => {
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
            ttl: vi.fn(),
            scan: vi.fn(),
            eval: vi.fn(),
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

  it("继承框架无关的 RedisStore", () => {
    expect(store).toBeInstanceOf(BaseRedisStore);
  });

  it("按新 StoreTtl 契约写入有限与持久数据", async () => {
    redisClient.set.mockResolvedValue("OK");

    await store.set("finite", "value", finiteTtl(60));
    await store.set("persistent", "value", persistentTtl());

    expect(redisClient.set).toHaveBeenNthCalledWith(1, "finite", "value", { EX: 60 });
    expect(redisClient.set).toHaveBeenNthCalledWith(2, "persistent", "value");
  });

  it("读取值时返回 StoreEntry", async () => {
    redisClient.get.mockResolvedValue("value");
    redisClient.ttl.mockResolvedValue(60);

    const result = await store.get("key");

    expect(result?.value).toBe("value");
    expect(result?.expiresAt).toBeGreaterThan(Date.now());
  });
});

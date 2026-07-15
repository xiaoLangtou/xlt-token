import { Test, type TestingModule } from "@nestjs/testing";
import { finiteTtl, persistentTtl } from "@xlt-token/core";
import { IORedisStore as BaseIORedisStore } from "@xlt-token/store-redis";
import { IORedisStore, XLT_IOREDIS_CLIENT } from "../src/store/ioredis-store";

describe("IORedisStore", () => {
  let store: IORedisStore;
  let redisClient: any;

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
            ttl: vi.fn(),
            scan: vi.fn(),
            eval: vi.fn(),
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

  it("extends the framework-agnostic IORedisStore", () => {
    expect(store).toBeInstanceOf(BaseIORedisStore);
  });

  it("writes finite and persistent values through the new StoreTtl contract", async () => {
    redisClient.set.mockResolvedValue("OK");

    await store.set("finite", "value", finiteTtl(60));
    await store.set("persistent", "value", persistentTtl());

    expect(redisClient.set).toHaveBeenNthCalledWith(1, "finite", "value", "EX", 60);
    expect(redisClient.set).toHaveBeenNthCalledWith(2, "persistent", "value");
  });

  it("returns one scan page with cursor", async () => {
    redisClient.scan.mockResolvedValue(["7", ["authorization:login:token:a"]]);

    await expect(store.scan("authorization:login:token:*")).resolves.toEqual({
      keys: ["authorization:login:token:a"],
      cursor: "7",
    });
  });
});

import { Inject, Injectable } from "@nestjs/common";
import { IORedisStore as BaseIORedisStore, type IORedisClient } from "@xlt-token/store-redis";

export const XLT_IOREDIS_CLIENT = "XLT_IOREDIS_CLIENT";

/**
 * @deprecated Import `IORedisStore` from `@xlt-token/store-redis` and provide it
 * through `store.useValue` for new applications.
 */
@Injectable()
export class IORedisStore extends BaseIORedisStore {
  constructor(
    @Inject(XLT_IOREDIS_CLIENT)
    redisClient: IORedisClient,
  ) {
    super(redisClient);
  }
}

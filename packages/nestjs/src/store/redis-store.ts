import { Inject, Injectable } from '@nestjs/common';
import {
  RedisStore as BaseRedisStore,
  type RedisClient,
} from '@xlt-token/store-redis';

export const XLT_REDIS_CLIENT = 'XLT_REDIS_CLIENT';

/**
 * @deprecated Import `RedisStore` from `@xlt-token/store-redis` and provide it
 * through `store.useValue` for new applications.
 */
@Injectable()
export class RedisStore extends BaseRedisStore {
  constructor(
    @Inject(XLT_REDIS_CLIENT)
    redisClient: RedisClient,
  ) {
    super(redisClient);
  }
}

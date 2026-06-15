# @xlt-token/store-redis

Framework-agnostic Redis Store implementations for `xlt-token`.

## Installation

Choose the Redis client used by your application:

```bash
pnpm add @xlt-token/store-redis redis
# or
pnpm add @xlt-token/store-redis ioredis
```

## node-redis

```ts
import { createXltToken } from '@xlt-token/core'
import { RedisStore } from '@xlt-token/store-redis'
import { createClient } from 'redis'

const client = createClient({ url: process.env.REDIS_URL })
await client.connect()

const xlt = createXltToken({
  store: new RedisStore(client),
})
```

## ioredis

```ts
import { createXltToken } from '@xlt-token/core'
import { IORedisStore } from '@xlt-token/store-redis'
import Redis from 'ioredis'

const xlt = createXltToken({
  store: new IORedisStore(new Redis(process.env.REDIS_URL)),
})
```

`IORedisStore` supports standalone, Sentinel, and Cluster clients. The Store
scans every Cluster master when `keys(pattern)` is called.

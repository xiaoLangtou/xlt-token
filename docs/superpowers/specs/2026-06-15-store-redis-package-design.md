# Store Redis 独立包设计

## 目标

将 Redis 存储实现从 `@xlt-token/nestjs` 拆分到框架无关的
`@xlt-token/store-redis`。新包只依赖 `@xlt-token/core` 的
`XltTokenStore` 契约，可直接用于 Core、Express 和 NestJS。

现有 NestJS API 在一个大版本周期内保持可用：

- `RedisStore`
- `IORedisStore`
- `XLT_REDIS_CLIENT`
- `XLT_IOREDIS_CLIENT`

NestJS 中的两个 Store 改为兼容包装器，并标记为 deprecated。

## 包边界

### `@xlt-token/store-redis`

新包负责：

- node-redis 的 `RedisStore`
- ioredis 的 `IORedisStore`
- 两种客户端所需的最小结构化 TypeScript 类型
- Store 行为单元测试

新包不包含：

- NestJS 装饰器或注入令牌
- Redis 连接生命周期管理
- 应用配置读取
- 自动创建 Redis 客户端

依赖关系：

```text
@xlt-token/core
        ↑
@xlt-token/store-redis
        ↑
@xlt-token/nestjs
```

`redis` 和 `ioredis` 是新包的可选 peer dependency。实现通过构造函数接收客户端，
不会在模块加载时导入任何 Redis 客户端运行时代码。

### `@xlt-token/nestjs`

NestJS 包继续导出原有名称。包装器通过原有令牌注入客户端，并调用新包实现：

```ts
import { RedisStore as BaseRedisStore } from '@xlt-token/store-redis'

@Injectable()
/** @deprecated 请直接使用 @xlt-token/store-redis */
export class RedisStore extends BaseRedisStore {
  constructor(@Inject(XLT_REDIS_CLIENT) client: RedisClient) {
    super(client)
  }
}
```

`IORedisStore` 使用相同模式。包装器不复制 Redis 命令逻辑。

## 公共 API

Core 或 Express 项目直接实例化 Store：

```ts
import { createXltToken } from '@xlt-token/core'
import { IORedisStore } from '@xlt-token/store-redis'
import Redis from 'ioredis'

const store = new IORedisStore(new Redis(process.env.REDIS_URL))
const xlt = createXltToken({ store })
```

Express 项目也可以从 `@xlt-token/express` 获取认证 API：

```ts
import { createXltToken } from '@xlt-token/express'
import { RedisStore } from '@xlt-token/store-redis'
import { createClient } from 'redis'

const client = createClient({ url: process.env.REDIS_URL })
await client.connect()

const xlt = createXltToken({
  store: new RedisStore(client),
})
```

NestJS 新用法使用 `useValue`：

```ts
XltTokenModule.forRoot({
  store: {
    useValue: new IORedisStore(ioredisClient),
  },
})
```

现有 NestJS DI 用法继续工作：

```ts
XltTokenModule.forRoot({
  store: { useClass: RedisStore },
  providers: [
    {
      provide: XLT_REDIS_CLIENT,
      useValue: redisClient,
    },
  ],
})
```

## 类型策略

新包导出结构化类型：

- `RedisClient`
- `IORedisClient`
- `IORedisScanClient`

这些类型只描述 Store 实际调用的方法，不依赖客户端包的完整类型。这样只使用
node-redis 的项目不需要安装 ioredis，反之亦然。

Store 构造函数保持公开：

```ts
new RedisStore(client)
new IORedisStore(client)
```

## 迁移策略

- `@xlt-token/nestjs` 新增对 `@xlt-token/store-redis` 的正式依赖。
- Redis 客户端 peer dependency 从根兼容包和 NestJS 包迁移到新包。
- NestJS Store 与注入令牌继续导出，现有代码无需立即修改。
- NestJS Store 类添加 JSDoc `@deprecated`，但当前版本不输出运行时警告。
- 文档优先展示框架无关包，新旧 NestJS 用法同时保留。
- 后续大版本可以移除 NestJS 包中的兼容包装器。

## 测试

### 新包

直接测试两个 Store 的完整 `XltTokenStore` 行为：

- 永久和带 TTL 的写入
- 保留 TTL 的更新
- key 不存在时的错误
- TTL 查询与更新
- node-redis 分页扫描
- ioredis 单机分页扫描
- ioredis Cluster 全 master 扫描

### NestJS

保留包装器测试，验证：

- 原有注入令牌仍可解析 Store
- 包装器继承新包实现
- 原有 Redis 命令行为没有回归

### 构建

验证以下包可以独立构建：

- `@xlt-token/store-redis`
- `@xlt-token/nestjs`
- `@xlt-token/express`
- 根兼容包

## 文档

更新：

- 根 README 的包结构与安装命令
- 存储层文档
- Express 使用文档
- NestJS 模块配置文档
- 架构文档中的包布局

## 非目标

- 本次不拆分 `JwtStrategy`。
- 本次不移除 NestJS 兼容 API。
- 本次不改变 `XltTokenStore` 契约。
- 本次不增加真实 Redis 容器测试。
- 本次不负责 Redis 客户端连接、关闭或重试。

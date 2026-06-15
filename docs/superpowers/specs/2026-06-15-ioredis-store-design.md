# IORedisStore 设计

## 背景

当前 `@xlt-token/nestjs` 的 `RedisStore` 使用 `node-redis` 的参数和返回值格式。
`ioredis` 在 `SET` 选项和 `SCAN` 返回值上采用不同 API，因此不能直接注入现有
`RedisStore`。Issue #5 中的 `ERR syntax error` 就是把 node-redis 的选项对象传给
ioredis 导致的。

## 目标

- 保留现有 `RedisStore` 和 `XLT_REDIS_CLIENT` 行为，避免破坏现有用户。
- 新增实现 `XltTokenStore` 的 `IORedisStore`。
- 新增独立注入令牌 `XLT_IOREDIS_CLIENT`。
- 支持 ioredis 的单机、哨兵或集群客户端，只依赖其通用命令接口。
- 将 `ioredis` 声明为可选 peer dependency，不强制 node-redis 用户安装。

## 公开 API

`@xlt-token/nestjs` 新增以下导出：

```ts
export { IORedisStore, XLT_IOREDIS_CLIENT } from './store/ioredis-store.js'
```

NestJS 配置示例：

```ts
import Redis from 'ioredis'
import {
  IORedisStore,
  XLT_IOREDIS_CLIENT,
  XltTokenModule,
} from '@xlt-token/nestjs'

XltTokenModule.forRoot({
  store: { useClass: IORedisStore },
  providers: [
    {
      provide: XLT_IOREDIS_CLIENT,
      useFactory: () => new Redis(process.env.REDIS_URL),
    },
  ],
})
```

## 命令映射

`IORedisStore` 保持与 `RedisStore` 相同的 `XltTokenStore` 语义：

| 方法 | ioredis 调用 |
| --- | --- |
| `get` | `get(key)` |
| `set` 永久 | `set(key, value)` |
| `set` 过期 | `set(key, value, 'EX', timeoutSec)` |
| `delete` | `del(key)` |
| `update` | `set(key, value, 'XX', 'KEEPTTL')` |
| `has` | `exists(key)` |
| `updateTimeout` 永久 | `persist(key)` |
| `updateTimeout` 过期 | `expire(key, timeoutSec)` |
| `getTimeout` | `ttl(key)` |
| `keys` | 循环调用 `scan(cursor, 'MATCH', pattern, 'COUNT', 100)` |

`scan` 按 ioredis 的 `[nextCursor, keys]` 返回值读取。循环直到 cursor 回到 `"0"`，
避免使用会阻塞 Redis 的 `KEYS` 命令。

## 错误语义

- `update` 返回 `null` 时抛出 `Key not found: <key>`。
- `updateTimeout` 在 key 不存在时抛出同样的错误。
- Redis 客户端的连接错误和命令错误原样向上传递，不做重试或降级。
- 不通过捕获语法错误来判断客户端类型，避免重复写命令和掩盖真实故障。

## 依赖与构建

- `packages/nestjs/package.json` 和根兼容包将 `ioredis` 加入 peer dependencies。
- `ioredis` 在 peer dependency metadata 中标记为 optional。
- 构建配置将 `ioredis` 标记为 external，库本身不打包 Redis 客户端。
- 实现仅使用结构化的最小客户端类型，避免消费者必须加载 ioredis 运行时代码才能
  使用其他 Store。

## 测试

新增独立单元测试，覆盖：

- 永久和带过期时间的 `set` 参数格式。
- `update` 的 `XX KEEPTTL` 参数和 key 不存在错误。
- `get`、`delete`、`has`、`updateTimeout`、`getTimeout` 的接口语义。
- 单页和多页 `scan`，确认 cursor 与 keys 被正确汇总。
- 现有 `RedisStore` 测试保持不变，证明 node-redis API 没有回归。

不在本次变更中增加 Redis 容器或真实 Redis 集成测试；单元测试覆盖两种客户端的
API 差异，现有存储契约测试继续覆盖公共行为。

## 文档范围

更新存储文档和 NestJS 配置文档，分别展示 node-redis 与 ioredis 的选择方式。
README 仅补充安装命令和内置 Store 列表，不重写无关章节。

## 非目标

- 不把两种客户端合并到一个自动探测的 Store。
- 不废弃或重命名 `RedisStore`。
- 不增加连接管理、重连策略或 Redis 配置封装。
- 不修改 `XltTokenStore` 接口。

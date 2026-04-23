# 03 · 配置参考

`XltTokenConfig` 全量字段 + `XltTokenModule` 注册选项 + 同步/异步两种写法。

## `XltTokenConfig` 全量字段

类型定义见 `src/core/xlt-token-config.ts`：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `tokenName` | `string` | `'authorization'` | 读取 token 的 header / cookie / query 键名；**也是 Redis/内存 key 的前缀** |
| `timeout` | `number` | `2592000` (30 天) | token 会话有效期，单位**秒**。`-1` 表示永不过期 |
| `activeTimeout` | `number` | `-1` | 活跃超时，单位秒。`-1` 关闭；`>0` 启用 lastActive 机制 |
| `isConcurrent` | `boolean` | `true` | 是否允许同账号多端在线（否则二次登录触发"顶号"） |
| `isShare` | `boolean` | `true` | 多端在线时是否共享同一 token（仅 `isConcurrent=true` 生效） |
| `tokenStyle` | `'uuid' \| 'simple-uuid' \| 'random-32'` | `'uuid'` | token 字符串格式，详见 [07-token-strategy](./07-token-strategy.md) |
| `isReadHeader` | `boolean` | `true` | 是否从 HTTP Header 读取 token |
| `isReadCookie` | `boolean` | `false` | 是否从 Cookie 读取 |
| `isReadQuery` | `boolean` | `false` | 是否从 URL Query 读取 |
| `tokenPrefix` | `string` | `'Bearer '` | header 中 token 的前缀（读取时自动剥离） |
| `defaultCheck` | `boolean` | `true` | 全局守卫默认行为。`true`=默认全部校验（黑名单），`false`=默认全部放行（白名单） |

> **取 token 顺序**：`header → cookie → query`。三者同时开启时，前者优先。

### 默认值常量

```ts
import { DEFAULT_XLT_TOKEN_CONFIG } from 'xlt-token';
```

你的 `forRoot({ config })` 会与 `DEFAULT_XLT_TOKEN_CONFIG` **浅合并**，未指定的字段继承默认值。

## 典型配置模板

### 生产环境（Redis，30 天会话，无活跃过期）

```ts
{
  tokenName: 'authorization',
  timeout: 30 * 24 * 60 * 60,
  tokenStyle: 'random-32',       // 强随机，推荐
  isConcurrent: true,
  isShare: true,
  defaultCheck: true,
}
```

### 金融/后台（单设备强制，2 小时闲置超时）

```ts
{
  timeout: 24 * 60 * 60,         // 1 天绝对过期
  activeTimeout: 2 * 60 * 60,    // 2 小时无操作冻结
  isConcurrent: false,           // 顶号
  tokenStyle: 'random-32',
  defaultCheck: true,
}
```

### 多端独立登录（移动/桌面互不影响）

```ts
{
  isConcurrent: true,
  isShare: false,                // 各端独立 token
  timeout: 14 * 24 * 60 * 60,
}
```

### 开发联调（短超时便于测试）

```ts
{
  timeout: 60,                   // 1 分钟
  activeTimeout: 30,             // 30 秒闲置冻结
  tokenStyle: 'simple-uuid',
}
```

## `XltTokenModule.forRoot(options)` 选项

| 选项 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `config` | `Partial<XltTokenConfig>` | `DEFAULT_XLT_TOKEN_CONFIG` | 上表字段 |
| `store` | `{ useClass }` \| `{ useValue }` | `MemoryStore` | 存储实现 |
| `strategy` | `{ useClass }` | `UuidStrategy` | token 策略 |
| `isGlobal` | `boolean` | `false` | 是否全局模块（通常 `true`） |
| `providers` | `Provider[]` | `[]` | 追加 Provider，典型用法是提供 `XLT_REDIS_CLIENT` |

同步写法：

```ts
XltTokenModule.forRoot({
  isGlobal: true,
  config: { timeout: 3600 },
  store: { useClass: RedisStore },
  providers: [
    {
      provide: XLT_REDIS_CLIENT,
      useFactory: async () => {
        const client = createClient({ url: 'redis://localhost:6379' });
        await client.connect();
        return client;
      },
    },
  ],
})
```

## `XltTokenModule.forRootAsync(options)` 选项

在 `config` 依赖其他模块（典型：`ConfigModule`）时使用。

```ts
export interface XltTokenModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  useFactory: (...args: any[]) => Promise<XltTokenModuleOptions> | XltTokenModuleOptions;
  inject?: any[];
  store?: { useClass } | { useValue };
  strategy?: { useClass };
  isGlobal?: boolean;
  providers?: Provider[];
}
```

典型示例：从 `@nestjs/config` 读取配置

```ts
import { ConfigModule, ConfigService } from '@nestjs/config';

XltTokenModule.forRootAsync({
  isGlobal: true,
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (cfg: ConfigService) => ({
    config: {
      tokenName: cfg.get<string>('TOKEN_NAME', 'authorization'),
      timeout: cfg.get<number>('TOKEN_TTL', 2592000),
      tokenStyle: cfg.get<'random-32'>('TOKEN_STYLE', 'random-32'),
    },
  }),
  store: { useClass: RedisStore },
  providers: [
    {
      provide: XLT_REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: async (cfg: ConfigService) => {
        const client = createClient({ url: cfg.get<string>('REDIS_URL') });
        await client.connect();
        return client;
      },
    },
  ],
})
```

## 导出的 DI Token 与 Provider

在 `AppModule` 中可通过以下 DI Token 手动注入：

```ts
import {
  XLT_TOKEN_CONFIG,
  XLT_TOKEN_STORE,
  XLT_TOKEN_STRATEGY,
  XLT_REDIS_CLIENT,
  StpLogic,
} from 'xlt-token';

@Injectable()
class SomeService {
  constructor(
    @Inject(XLT_TOKEN_CONFIG) private config: XltTokenConfig,
    @Inject(XLT_TOKEN_STORE) private store: XltTokenStore,
    private stpLogic: StpLogic,
  ) {}
}
```

## 常见误配与提醒

- ⚠️ **`tokenPrefix` 尾部空格不能漏**：`'Bearer '` 而非 `'Bearer'`。客户端请求会发 `Authorization: Bearer xxx`，前缀不匹配会导致 token 解析失败。
- ⚠️ **`timeout` 与 `renewTimeout` 参数单位一致**：都是秒。
- ⚠️ **`activeTimeout > 0` 后 login 才会写入 lastActive 键**；若开发中先关闭再打开，历史 token 访问会直接命中 `TOKEN_FREEZE`，让用户重新登录即可。
- ⚠️ **多实例部署必须用 Redis**：`MemoryStore` 数据不跨进程。
- ⚠️ **`tokenName` 变更后旧 token 全部失效**（key 前缀变了），建议上线后锁死。

## 下一步

- 配置对应的运行时效果在哪看？→ [02-architecture · 三类存储键](./02-architecture.md#三类存储键)
- 我要切换 Store → [06-storage](./06-storage.md)
- 我要换 token 格式 → [07-token-strategy](./07-token-strategy.md)

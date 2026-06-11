# Core 配置参考

> 包：`XltTokenConfig` 定义于 `@xlt-token/core`。

本页说明 `@xlt-token/core` 的配置字段和 `createXltToken` 写法。NestJS 的 `XltTokenModule.forRoot` / `forRootAsync` 见 [NestJS 模块配置](/adapters/nestjs/module-config)。

## `XltTokenConfig` 全量字段

类型定义见 `packages/core/src/config/xlt-token-config.ts`：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `tokenName` | `string` | `'authorization'` | 读取 token 的 header / cookie / query 键名；**也是 Redis/内存 key 的前缀** |
| `timeout` | `number` | `2592000` (30 天) | token 会话有效期，单位**秒**。`-1` 表示永不过期 |
| `activeTimeout` | `number` | `-1` | 活跃超时，单位秒。`-1` 关闭；`>0` 启用 lastActive 机制 |
| `isConcurrent` | `boolean` | `true` | 是否允许同账号多端在线（否则二次登录触发"顶号"） |
| `isShare` | `boolean` | `true` | 多端在线时是否共享同一 token（仅 `isConcurrent=true` 生效） |
| `tokenStyle` | `'uuid' \| 'simple-uuid' \| 'random-32'` | `'uuid'` | token 字符串格式，详见 [Token 策略](/core/token-strategy) |
| `isReadHeader` | `boolean` | `true` | 是否从 HTTP Header 读取 token |
| `isReadCookie` | `boolean` | `false` | 是否从 Cookie 读取 |
| `isReadQuery` | `boolean` | `false` | 是否从 URL Query 读取 |
| `tokenPrefix` | `string` | `'Bearer '` | header 中 token 的前缀（读取时自动剥离） |
| `defaultCheck` | `boolean` | `true` | 全局守卫默认行为。`true`=默认全部校验（黑名单），`false`=默认全部放行（白名单） |
| `deviceConcurrent` | `boolean` | `true` | 是否允许同账号不同 device 共存。`false` 时任意新登录踢掉所有端，详见 [多端登录](/core/multi-device) |
| `offlineRecordEnabled` | `boolean` | `false` | 是否记录被踢/被顶的下线原因 |
| `offlineRecordTimeout` | `number` | `3600` | 下线记录保留秒数 |
| `permCacheTimeout` | `number` | `0` | 权限/角色列表缓存秒数（`0` = 不缓存） |
| `jwt` | `JwtConfig` | — | JWT 策略配置（`secret` 等），见 [JWT 策略](/core/jwt-strategy) |

> **取 token 顺序**：`header → cookie → query`。三者同时开启时，前者优先。

### 默认值常量

```ts twoslash
import { DEFAULT_XLT_TOKEN_CONFIG } from '@xlt-token/core';
```

传入 `createXltToken({ config })` 或 `XltTokenModule.forRoot({ config })` 的配置会与 `DEFAULT_XLT_TOKEN_CONFIG` **浅合并**，未指定的字段继承默认值。

## 典型配置模板

### 生产环境（Redis，30 天会话，无活跃过期）

```ts twoslash
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

```ts twoslash
{
  timeout: 24 * 60 * 60,         // 1 天绝对过期
  activeTimeout: 2 * 60 * 60,    // 2 小时无操作冻结
  isConcurrent: false,           // 顶号
  tokenStyle: 'random-32',
  defaultCheck: true,
}
```

### 多端独立登录（移动/桌面互不影响）

```ts twoslash
{
  isConcurrent: true,
  isShare: false,                // 各端独立 token
  timeout: 14 * 24 * 60 * 60,
}
```

### 开发联调（短超时便于测试）

```ts twoslash
{
  timeout: 60,                   // 1 分钟
  activeTimeout: 30,             // 30 秒闲置冻结
  tokenStyle: 'simple-uuid',
}
```

## `createXltToken(options)` 选项

| 选项 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `config` | `Partial<XltTokenConfig>` | `DEFAULT_XLT_TOKEN_CONFIG` | 上表字段 |
| `store` | `XltTokenStore` | `MemoryStore` | 存储实现 |
| `strategy` | `TokenStrategy` | `UuidStrategy` | token 生成策略 |
| `stpInterface` | `StpInterface` | 内置 stub | 权限/角色数据源，见 [权限与会话](/core/permissions-and-session) |
| `hooks` | `XltHooks` | — | 登录/踢人等生命周期钩子，见 [Hooks 与观测性](/core/hooks-and-observability) |

示例：

```ts twoslash
import { createXltToken, MemoryStore } from '@xlt-token/core';

const xlt = createXltToken({
  config: {
    tokenName: 'authorization',
    timeout: 3600,
    tokenStyle: 'random-32',
  },
  store: new MemoryStore(),
});
```

## 常见误配与提醒

- ⚠️ **`tokenPrefix` 尾部空格不能漏**：`'Bearer '` 而非 `'Bearer'`。客户端请求会发 `Authorization: Bearer xxx`，前缀不匹配会导致 token 解析失败。
- ⚠️ **`timeout` 与 `renewTimeout` 参数单位一致**：都是秒。
- ⚠️ **`activeTimeout > 0` 后 login 才会写入 lastActive 键**；若开发中先关闭再打开，历史 token 访问会直接命中 `TOKEN_FREEZE`，让用户重新登录即可。
- ⚠️ **多实例部署必须用 Redis**：`MemoryStore` 数据不跨进程。
- ⚠️ **`tokenName` 变更后旧 token 全部失效**（key 前缀变了），建议上线后锁死。

## 下一步

- 配置对应的运行时效果在哪看？→ [架构设计 · 三类存储键](/guide/architecture#三类存储键)
- NestJS 模块注册 → [NestJS 模块配置](/adapters/nestjs/module-config)
- 我要切换 Store → [存储层](/core/storage)
- 我要换 token 格式 → [Token 策略](/core/token-strategy)

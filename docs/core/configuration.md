# Core 配置参考

> 包：`XltTokenConfig` 定义于 `@xlt-token/core`。

本页说明 `@xlt-token/core` 的配置字段和 `createXltToken` 写法。NestJS 的 `XltTokenModule.forRoot` / `forRootAsync` 见 [NestJS 模块配置](/adapters/nestjs/module-config)。

## `XltTokenConfig` 全量字段

类型定义见 `packages/core/src/config/xlt-token-config.ts`：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `tokenName` | `string` | `'authorization'` | 读取 token 的 header / cookie / query 键名；**也是 Redis/内存 key 的前缀** |
| `timeout` | `number` | `2592000` (30 天) | token 会话有效期（秒），支持相对时间字符串，如 `'7d'` |
| `activeTimeout` | `number` | `-1` | 活跃超时（秒）。`-1` 关闭；`>0` 启用 lastActive 机制。支持相对时间字符串 |
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
| `offlineRecordTimeout` | `number` | `3600` | 下线记录保留秒数，支持相对时间字符串 |
| `permCacheTimeout` | `number` | `0` | 权限/角色列表缓存秒数（`0` = 不缓存），支持相对时间字符串 |
| `lifecycle` | `TokenLifecycleConfig` | — | refresh token 轮转、重放检测与 token family 生命周期配置 |

> **取 token 顺序**：`header → cookie → query`。三者同时开启时，前者优先。

### 默认值常量

```ts twoslash
import { DEFAULT_XLT_TOKEN_CONFIG } from '@xlt-token/core';
```

传入 `createXltToken({ config })` 或 `XltTokenModule.forRoot({ config })` 的配置会与 `DEFAULT_XLT_TOKEN_CONFIG` **浅合并**，未指定的字段继承默认值。

## 相对时间 DurationInput

配置中的时长字段（`timeout`, `activeTimeout`, `permCacheTimeout`, `offlineRecordTimeout`）和业务 API（`login`, `renewTimeout`, `openSafe`, `createTempToken`）的 `timeout` 参数均支持两种格式：

| 输入 | 含义 | 结果（秒） |
| --- | --- | --- |
| `3600` | 兼容现有的数字秒数 | `3600` |
| `'30s'` | 30 秒 | `30` |
| `'15m'` | 15 分钟 | `900` |
| `'2h'` | 2 小时 | `7200` |
| `'7d'` | 7 天 | `604800` |
| `'2w'` | 2 周 | `1209600` |
| `-1` | 永不过期或关闭功能 | `-1` |
| `0` | 立即过期或关闭缓存 | `0` |

字符串仅支持正数和 `s`、`m`、`h`、`d`、`w` 单位，支持小数：`'1.5h'` = 5400 秒。特殊值 `-1` 和 `0` 只接受数字形式，`'-1s'`、`'0s'` 会被拒绝。

底层 Store 统一使用归一化后的数字秒数，所有运行时注入的 `XltTokenConfig` 只包含数字时长。

## 典型配置模板

### 生产环境（Redis，30 天会话，无活跃过期）

```ts twoslash
{
  tokenName: 'authorization',
  timeout: '30d',                // 相对时间字符串
  tokenStyle: 'random-32',       // 强随机，推荐
  isConcurrent: true,
  isShare: true,
  defaultCheck: true,
}
```

### 金融/后台（单设备强制，2 小时闲置超时）

```ts twoslash
{
  timeout: '1d',                 // 1 天绝对过期
  activeTimeout: '2h',           // 2 小时无操作冻结
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
  timeout: '14d',
}
```

### 开发联调（短超时便于测试）

```ts twoslash
{
  timeout: '60s',                // 1 分钟
  activeTimeout: '30s',          // 30 秒闲置冻结
  tokenStyle: 'simple-uuid',
}
```

## `createXltToken(options)` 选项

| 选项 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `config` | `Partial<XltTokenConfigInput>` | `DEFAULT_XLT_TOKEN_CONFIG` | 上表字段，时长字段支持相对时间字符串 |
| `store` | `XltTokenStore` | `MemoryStore` | 存储实现 |
| `strategy` | `TokenStrategy` | `UuidStrategy` | token 生成策略 |
| `stpInterface` | `StpInterface` | 内置 stub | 权限/角色数据源，见 [权限与会话](/core/permissions-and-session) |
| `eventSink` | `XltEventSink` | — | 脱敏审计事件投递器，见 [审计事件与观测性](/core/hooks-and-observability) |

示例：

```ts twoslash
import { createXltToken, MemoryStore } from '@xlt-token/core';

const xlt = createXltToken({
  config: {
    tokenName: 'authorization',
    timeout: '1h',                // 支持 '1h', '30m', '7d' 等相对时间
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
- 我要实现 Store → [Store 契约与内存存储](/core/storage)
- 我要使用 Redis → [Redis Store 完整指南](/store-redis/)
- 我要换 token 格式 → [Token 策略](/core/token-strategy)

# 17 · Hooks 与观测性

> 包：`@xlt-token/core`（Hooks 与观测性 API 均在核心层实现）

1.1.0 新增**生命周期钩子（Hooks）**与**在线观测 API**，用于审计日志、消息推送、管理后台在线用户列表等场景。

## Hooks 系统

### 接口定义

```ts twoslash
interface XltHooks {
  onLogin?: (loginId: string, token: string, device: string) => void | Promise<void>;
  onLogout?: (loginId: string, token: string, reason: string) => void | Promise<void>;
  onKickout?: (loginId: string, token: string) => void | Promise<void>;
  onReplaced?: (loginId: string, oldToken: string, newToken: string) => void | Promise<void>;
}
```

### 注册方式

**NestJS** — 通过 `XltTokenModule.forRoot({ hooks })` 传入：

```ts twoslash
XltTokenModule.forRoot({
  isGlobal: true,
  hooks: {
    onLogin: (loginId, token, device) => {
      console.log(`[login] ${loginId} @ ${device}`);
    },
    onKickout: async (loginId, token) => {
      await auditService.record('kickout', { loginId, token });
    },
  },
});
```

**框架无关** — 通过 `createXltToken({ hooks })` 传入：

```ts twoslash
import { createXltToken, MemoryStore } from '@xlt-token/core';

const xlt = createXltToken({
  store: new MemoryStore(),
  hooks: {
    onLogin: (loginId, token, device) => {
      console.log(`[login] ${loginId} @ ${device}`);
    },
  },
});
```

异步钩子若 reject，**不会影响主流程**（内部 `catch` 后 `console.error`），钩子应只做观测性 side-effect。

### 触发时机

| 钩子 | 触发位置 | 当前状态 |
| --- | --- | --- |
| `onLogin` | `login()` 写入成功后 | ✅ 已实现 |
| `onKickout` | `kickout()` / `kickoutByDevice()` / `kickoutByToken()` | ✅ 已实现 |
| `onLogout` | `logout()` / `logoutByLoginId()` 成功后 | ✅ 已实现 |
| `onReplaced` | `isConcurrent: false` 同设备顶号，`login()` 成功后 | ✅ 已实现 |

> `onLogout` 的 `reason` 参数：`logout` 为 `'LOGOUT'`，`logoutByLoginId` 为 `'LOGOUT_BY_LOGIN_ID'`。

### 示例：登录审计

```ts twoslash
XltTokenModule.forRoot({
  hooks: {
    onLogin: (loginId, token, device) => {
      logger.info({ event: 'login', loginId, device });
    },
    onKickout: (loginId, token) => {
      logger.warn({ event: 'kickout', loginId });
      websocket.notify(loginId, '您已被强制下线');
    },
  },
});
```

## 观测性 API

依赖 Store 的 `keys(pattern)` 能力（MemoryStore / RedisStore 均已实现），扫描 `session-list:*` 前缀。

### `getOnlineLoginIds(opts?)`

分页查询当前有在线 session 的 **loginId 列表**。

```ts twoslash
getOnlineLoginIds(opts?: { page?: number; pageSize?: number }): Promise<string[]>
```

- 默认 `page = 0`，`pageSize = 100`
- 返回的是 **loginId**，不是 device 数（一个用户多端在线仍计为 1 条 session-list 键）

```ts twoslash
const page0 = await stp.getOnlineLoginIds({ page: 0, pageSize: 50 });
// ['1001', '1002', ...]
```

### `getOnlineCount()`

在线 **用户数**（有 session-list 记录的 loginId 数量）。

```ts twoslash
getOnlineCount(): Promise<number>
```

```ts twoslash
const count = await stp.getOnlineCount();
console.log(`当前在线用户: ${count}`);
```

> 若需统计**在线设备总数**，应对每个 loginId 调用 `getDeviceList` 后求和，或自行维护指标。

### `getDeviceList(loginId)`

某账号下所有在线 device（详见 [多端登录](/core/multi-device)）。

```ts twoslash
getDeviceList(loginId: string): Promise<DeviceInfo[]>
```

### `forceLogout(loginId)`

强制某账号所有 device 下线。

```ts twoslash
forceLogout(loginId: string): Promise<boolean>
```

## 管理后台示例

```ts twoslash
@Controller('admin/online')
export class OnlineController {
  constructor(private readonly stp: StpLogic) {}

  @Get('count')
  count() {
    return this.stp.getOnlineCount();
  }

  @Get('users')
  users(@Query('page') page = '0', @Query('size') size = '100') {
    return this.stp.getOnlineLoginIds({
      page: Number(page),
      pageSize: Number(size),
    });
  }

  @Get('users/:loginId/devices')
  devices(@Param('loginId') loginId: string) {
    return this.stp.getDeviceList(loginId);
  }
}
```

## 存储扫描说明

`getOnlineLoginIds` / `getOnlineCount` 使用的 pattern：

```
${tokenName}:login:session-list:*
```

- **MemoryStore**：内存前缀扫描，适合开发与小规模
- **RedisStore**：`SCAN` 迭代，避免 `KEYS` 阻塞

生产环境若在线用户量极大，建议：

- 降低扫描频率，或
- 自行维护在线计数器 / 索引结构

## Hooks + 观测性组合

典型运维面板数据流：

```
getOnlineLoginIds()  →  loginId 列表
    ↓
getDeviceList(id)    →  每用户 device / token / loginTime
    ↓
kickoutByDevice()    →  onKickout 钩子 → 审计日志
```

## 类型导出

```ts twoslash
import type { XltHooks, DeviceInfo } from '@xlt-token/core';
import { XLT_TOKEN_HOOKS } from '@xlt-token/core';
```

`DeviceInfo` 定义于 `packages/core/src/config/xlt-token-config.ts`。

## 下一步

- 多端 API 详解 → [多端登录](/core/multi-device)
- Store `keys()` 实现 → [存储层](/core/storage)
- 模块注册选项 → [NestJS 模块配置](/adapters/nestjs/module-config)

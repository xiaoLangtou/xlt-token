# 17 · Hooks 与观测性

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

通过 `XltTokenModule.forRoot({ hooks })` 传入：

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

异步钩子若 reject，**不会影响主流程**（内部 `catch` 后 `console.error`），钩子应只做观测性 side-effect。

### 触发时机

| 钩子 | 触发位置 | 当前状态 |
| --- | --- | --- |
| `onLogin` | `login()` 写入成功后 | ✅ 已实现 |
| `onKickout` | `kickoutByDevice()` / `kickoutByToken()` | ✅ 已实现 |
| `onLogout` | `logout()` 成功后 | ⏳ 接口已定义，待接入 |
| `onReplaced` | 同 device 顶号成功后 | ⏳ 接口已定义，待接入 |

> `kickout(loginId)` **当前不触发** `onKickout`，若需要统一审计，请使用 `kickoutByDevice` / `kickoutByToken`，或自行在业务层补调。

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

某账号下所有在线 device（详见 [14-multi-device](./14-multi-device.md)）。

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
import type { XltHooks, DeviceInfo } from 'xlt-token';
import { XLT_TOKEN_HOOKS } from 'xlt-token';
```

`DeviceInfo` 定义于 `src/core/xlt-token-config.ts`。

## 下一步

- 多端 API 详解 → [14-multi-device](./14-multi-device.md)
- Store `keys()` 实现 → [06-storage](./06-storage.md)
- 模块注册选项 → [03-configuration](./03-configuration.md)

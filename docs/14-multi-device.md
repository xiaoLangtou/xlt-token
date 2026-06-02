# 14 · 多端登录

> 包：`@xlt-token/core`（API 实现）；NestJS 示例通过 `StpLogic` / `StpUtil` 调用。

1.1.0 起，同一账号可在多个**设备类型**（`device`）上独立持有登录态。

> 若你只需「单设备顶号」或「多端共享 token」，仍可使用 1.0 的 `isConcurrent` / `isShare`，见 [架构设计 · 并发语义](/guide/architecture#并发--共享语义)。

## 核心概念

| 概念 | 说明 |
| --- | --- |
| `device` | 设备标识字符串，如 `'pc'`、`'app'`、`'h5'`。未传时默认为 `'default'`（与 1.0 行为兼容） |
| `sessionKey` | `${tokenName}:login:session:${loginId}:${device}`，每个设备一条 |
| `session-list` | `${tokenName}:login:session-list:${loginId}`，JSON 数组，记录该账号所有在线设备索引 |

`DeviceInfo` 结构：

```ts twoslash
interface DeviceInfo {
  device: string;      // 设备标识
  token: string;       // 该设备当前 token（JWT 模式下为完整 JWT 字符串）
  loginTime: number;   // 登录时间戳（毫秒）
}
```

## 配置：`deviceConcurrent`

新增字段 `deviceConcurrent`（默认 `true`），与 `isConcurrent` 组合控制互踢范围：

| `deviceConcurrent` | `isConcurrent` | 行为 |
| --- | --- | --- |
| `true` | `true` | **不同 device 互不影响**；同一 device 是否共享 token 由 `isShare` 决定 |
| `true` | `false` | **同 device 互踢**（顶号）；不同 device 各自独立 |
| `false` | *（忽略）* | **任意新登录踢掉所有 device**（全局单会话，类似 1.0 加强版） |

### 典型场景

**PC + App 同时在线，互不影响**（最常见）：

```ts twoslash
XltTokenModule.forRoot({
  config: {
    deviceConcurrent: true,   // 默认即可
    isConcurrent: true,
    isShare: false,           // 各端独立 token
  },
});
```

**同一 App 只允许一个会话，但 PC 与 App 可共存**：

```ts twoslash
XltTokenModule.forRoot({
  config: {
    deviceConcurrent: true,
    isConcurrent: false,      // 同 device 顶号
    isShare: false,
  },
});
```

**任意端登录即踢掉其他所有端**（全局单点）：

```ts twoslash
XltTokenModule.forRoot({
  config: {
    deviceConcurrent: false,
    isShare: false,
  },
});
```

## 登录时指定设备

```ts twoslash
// PC 端
const pcToken = await stp.login(userId, { device: 'pc' });

// 移动端
const appToken = await stp.login(userId, { device: 'app' });
```

两次登录生成**不同 token**（在 `isShare: false` 时），且互不影响。

## API 参考

以下方法在 **`StpLogic`** 与 **`StpUtil`** 上均可用（`StpUtil` 为静态转发）。

### `getDeviceList(loginId)`

查询某账号所有在线设备。

```ts twoslash
getDeviceList(loginId: string): Promise<DeviceInfo[]>
```

```ts twoslash
const list = await this.stp.getDeviceList('1001');
// [{ device: 'pc', token: '...', loginTime: 1700000000000 }, ...]
```

### `kickoutByDevice(loginId, device)`

只踢指定设备，其他 device 不受影响。

```ts twoslash
kickoutByDevice(loginId: string, device: string): Promise<boolean | null>
```

- 成功 → `true`
- 设备不存在 → `null`

```ts twoslash
await this.stp.kickoutByDevice('1001', 'pc');
// 仅 PC 端下线，App 端仍有效
```

### `kickoutByToken(token)`

按 token 踢下线，自动从 `session-list` 移除对应 device。

```ts twoslash
kickoutByToken(token: string): Promise<boolean | null>
```

### `kickout(loginId, device?)`

踢指定 loginId 的某个 device（默认 `'default'`）。与 `kickoutByDevice` 类似，但签名兼容 1.0「按 loginId 踢人」习惯。

```ts twoslash
kickout(loginId: string, device?: string): Promise<boolean | null>
```

### `forceLogout(loginId)`

强制某账号**所有 device** 下线（内部遍历 `getDeviceList` 并逐个 `kickoutByDevice`）。

```ts twoslash
forceLogout(loginId: string): Promise<boolean>
```

## 完整示例：管理后台「在线设备」

```ts twoslash
@Controller('admin/sessions')
export class SessionAdminController {
  constructor(private readonly stp: StpLogic) {}

  /** 查看某用户在线设备 */
  @Get(':loginId/devices')
  async listDevices(@Param('loginId') loginId: string) {
    return this.stp.getDeviceList(loginId);
  }

  /** 踢掉指定设备 */
  @Delete(':loginId/devices/:device')
  async kickDevice(
    @Param('loginId') loginId: string,
    @Param('device') device: string,
  ) {
    return { ok: await this.stp.kickoutByDevice(loginId, device) };
  }

  /** 一键全端下线 */
  @Delete(':loginId/sessions')
  async forceLogout(@Param('loginId') loginId: string) {
    await this.stp.forceLogout(loginId);
    return { ok: true };
  }
}
```

## 行为时序

### 不同 device 独立登录

```
login('1001', { device: 'pc' })   → tokenA，session-list: [{ device:'pc', token:tokenA }]
login('1001', { device: 'app' })  → tokenB，session-list: [pc, app 两条]
isLogin(tokenA) → true
isLogin(tokenB) → true
```

### 同 device 顶号（`isConcurrent: false`）

```
login('1001', { device: 'pc' })  → tokenA
login('1001', { device: 'pc' })  → tokenB，tokenA 标记 BE_REPLACED
isLogin(tokenA) → false (BE_REPLACED)
isLogin(tokenB) → true
```

### `kickoutByDevice` 只影响一端

```
login pc + login app
kickoutByDevice('1001', 'pc')
  → pc token 标记 KICK_OUT，session-list 移除 pc
  → app token 仍有效
```

## 与 1.0 的兼容

- 不传 `device` 时等价于 `device: 'default'`
- 新键格式：`session:${loginId}:default`（旧版无 device 后缀的键在首次登录时按 `default` device 迁移）

## 注意事项

- `logout(token)` 会从 `session-list` 移除对应 device，但当前实现仍可能误删共享的 `sessionData`（多 device 场景下需注意 session 数据生命周期）
- `logoutByLoginId(loginId)` 目前仅处理 `default` device，**多 device 全端登出请用 `forceLogout`**
- JWT 模式下踢人走黑名单机制，详见 [16-jwt-strategy](/core/jwt-strategy)

## 下一步

- 在线人数 / 在线列表 API → [17-hooks-and-observability](/core/hooks-and-observability)
- 管理员踢人场景代码 → [09-recipes · 管理员踢人](/core/recipes#6-管理员踢人下线)
- 配置字段完整列表 → [Core 配置参考](/core/configuration)

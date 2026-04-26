# Roadmap · 1.1.0（规划中）

> 当前稳定版：`1.0.0-rc.1`（发布于 2026-04-26）
> 本文档规划 `1.1.0` 的四大方向。所有特性遵循 **"与 1.0 API 完全兼容，新能力 opt-in"** 原则。

## 目标

1. 补齐与 Sa-Token 对齐的 **二级认证 + 临时 token**
2. 提供可生产落地的 **多端登录管理**（按设备互踢 / 在线设备列表）
3. 内置 **JWT Strategy**，作为 UuidStrategy 外的主流 Token 方案
4. 提升 **观测性**：在线用户列表、全量下线、钩子事件导出用于审计

## 非目标

- 不做前端 UI 组件或管理后台模板
- 不做用户/角色/权限数据的 CRUD（业务实现 `StpInterface`）
- 不做 OAuth2 / OIDC Server（属于 P3 范畴）

---

## 方向一：二级认证 + 临时 token

### 背景

部分敏感操作（修改密码、转账、删除账号）即使已登录也需要**再次确认身份**。临时 token 则用于**短有效期授权链接**（邮件确认、一次性下载链接等）。

### 新增 API（规划）

```ts
// 二级认证：业务触发（如验证码、短信、谷歌验证器通过后）
await StpUtil.openSafe(token, 'pay', 300);    // pay 业务打开安全认证 300 秒

// Guard / 装饰器里消费
await StpUtil.checkSafe(token, 'pay');        // 未开启抛 NotSafeException

// 一次性 / 短效 token
const tempToken = await StpUtil.createTempToken('resetPwd:userId=1001', 600);
const value = await StpUtil.parseTempToken(tempToken);   // 'resetPwd:userId=1001' | null
await StpUtil.deleteTempToken(tempToken);
```

### 新增装饰器

```ts
@XltCheckSafe('pay')       // 失败抛 NotSafeException（HTTP 403 + type=NOT_SAFE）
@Post('transfer')
transfer() {}
```

### 存储键扩展

```
<name>:safe:<token>:<business>        → expireAt（二级认证有效期）
<name>:temp-token:<tempToken>         → 关联业务数据（字符串）
```

### 工期估计

- 实现 + 单测：1~2 天
- E2E + 文档：1 天

---

## 方向二：多端登录管理

### 背景

当前 `isConcurrent` / `isShare` 机制不区分设备类型——PC 端登录会挤掉手机端。实际业务常需要 "不同端类型可同时在线，同端互踢"。

### 新增 API（规划）

```ts
// 登录时指定设备类型
const token = await StpUtil.login('1001', { device: 'web' });

// 查询同账号所有设备
const devices = await StpUtil.getDeviceList('1001');
// [{ device: 'web', token: 'xxx', loginTime: 1714112400000, ip: '...' }]

// 按设备踢人
await StpUtil.kickoutByDevice('1001', 'web');

// 踢除指定 token
await StpUtil.kickoutByToken(token);
```

### 配置扩展

```ts
{
  deviceConcurrent: true,   // 默认 true：不同设备可共存
  // false 时，登录任何设备都会挤掉其他所有设备（等于 1.0 行为）
}
```

### 存储键扩展

sessionKey 从 `login:session:<loginId>` 升级为 `login:session:<loginId>:<device>`，保留 `login:session-list:<loginId>` 作为所有设备的索引 Set。

**迁移策略**：1.0 → 1.1 自动兼容，`device` 默认为 `default`，老数据可直接复用。

### 工期估计

- 实现 + 单测：2~3 天（涉及 session 键结构变化，需谨慎回归）
- E2E + 文档：1 天

---

## 方向三：JWT Strategy

### 背景

1.0 只有 `UuidStrategy`（随机 token + store 查 loginId）。JWT 方案的优势：**自包含**（免 store 查询）、**跨服务验证**（无状态）。补齐后两种主流方案都内置。

### 新增 Strategy

```ts
import { JwtStrategy } from 'xlt-token';

XltTokenModule.forRoot({
  strategy: {
    useClass: JwtStrategy,
  },
  config: {
    jwt: {
      secret: 'your-secret',
      algorithm: 'HS256',
      issuer: 'xlt-token',
      audience: 'api',
    },
  },
})
```

### 与 UuidStrategy 的差异

| 维度 | UuidStrategy | JwtStrategy |
| --- | --- | --- |
| Token 格式 | 随机 UUID/字符串 | `header.payload.signature` |
| loginId 解析 | 查 store（1 次 IO） | 本地 JWT verify（0 IO） |
| 踢人 / 顶号 | 直接改 store 值 | 仍需 store 维护黑名单 |
| 续签 | 改 store TTL | 签发新 JWT（旧 JWT 仍有效到过期） |
| 跨服务 | 不支持（依赖共享 store） | 支持（只需共享 secret） |

### 存储键（JWT 模式下）

store 仍用于：
- 黑名单（被踢/被顶的 JWT 记入 `jwt-blacklist:<jti>`）
- 活跃时间戳（`lastActive:<jti>`）
- session-data / offline 记录

### 工期估计

- 实现 + 单测：2 天
- E2E + 与 UuidStrategy 的互相切换测试：1 天
- 文档：1 天

---

## 方向四：观测性 + 遗迹查询

### 背景

运维场景：封禁用户时需要"强制所有设备下线"、风控时需要"查询当前在线用户列表"、审计时需要"每个登录/登出事件打点"。

### 新增 API（规划）

```ts
// 查所有在线 loginId
const list = await StpUtil.getOnlineLoginIds();         // string[]
const list = await StpUtil.getOnlineLoginIds({ pageSize: 100, page: 0 });

// 强制某用户全部下线（所有设备）
await StpUtil.forceLogout('1001');

// 全局统计
const count = await StpUtil.getOnlineCount();
```

### 新增钩子（`XltTokenModule` 配置）

```ts
XltTokenModule.forRoot({
  hooks: {
    onLogin: (loginId, token, device) => audit.log(...),
    onLogout: (loginId, token, reason) => audit.log(...),
    onKickout: (loginId, operator) => audit.log(...),
    onReplaced: (loginId, oldToken, newToken) => audit.log(...),
  },
})
```

### 实现要点

- **在线列表**：需要 `XltTokenStore` 新增 `keys(pattern)` / `scan()` 方法。MemoryStore 直接遍历；RedisStore 用 `SCAN` 迭代
- **forceLogout**：直接遍历该 loginId 的所有 device session 并逐个 kickout
- **钩子**：在 `StpLogic.login` / `logout` / `kickout` 关键点调用，不抛异常（try-catch 吞掉）

### 工期估计

- Store 接口扩展 + 钩子：1 天
- 观测 API + 文档：1 天

---

## 新增 API 汇总

| 方向 | 方法 / 装饰器 | 新异常 |
| --- | --- | --- |
| 二级认证 | `StpUtil.openSafe / checkSafe`，`@XltCheckSafe` | `NotSafeException` |
| 临时 token | `StpUtil.createTempToken / parseTempToken / deleteTempToken` | - |
| 多端登录 | `StpUtil.getDeviceList / kickoutByDevice / kickoutByToken` | - |
| JWT | `JwtStrategy` + `config.jwt` | - |
| 观测性 | `StpUtil.getOnlineLoginIds / getOnlineCount / forceLogout` | - |
| 钩子 | `hooks: { onLogin, onLogout, onKickout, onReplaced }` | - |

---

## 版本兼容矩阵

| 1.0 功能 | 1.1 行为 |
| --- | --- |
| `login(id)` 不传 device | 默认 `device='default'`，旧数据自动命中 |
| `isConcurrent` / `isShare` | 仍生效，但优先级低于 `deviceConcurrent` |
| 不配置 `strategy` | 仍默认 `UuidStrategy` |
| 不配置 `hooks` | 所有钩子不触发 |
| 未注册 `stpInterface` | 权限相关 API 仍抛 "not registered" |

---

## 分步实施计划

### Milestone 1（核心扩展，优先级高）

1. ✅ [Step 1.1] 多端登录：session key 加 device 段 + `getDeviceList` / `kickoutByDevice`
2. ✅ [Step 1.2] 观测性 Store 扩展：`keys()` / `scan()` + `getOnlineLoginIds`
3. ✅ [Step 1.3] Hooks：`onLogin / onLogout / onKickout / onReplaced`

### Milestone 2（二级认证）

4. ✅ [Step 2.1] `openSafe / checkSafe`
5. ✅ [Step 2.2] `@XltCheckSafe` 装饰器 + `NotSafeException`
6. ✅ [Step 2.3] 临时 token（`createTempToken` 系列）

### Milestone 3（JWT）

7. ✅ [Step 3.1] `JwtStrategy` 实现（基于 `jsonwebtoken` peer dep）
8. ✅ [Step 3.2] JWT 模式下黑名单 + 续签逻辑
9. ✅ [Step 3.3] 与 UuidStrategy 互切换的 E2E

### Milestone 4（收尾）

10. ✅ [Step 4.1] 文档：权限/会话章节补二级认证 + 多端，新增 JWT 章节
11. ✅ [Step 4.2] Recipes 补多端踢人、审计日志场景
12. ✅ [Step 4.3] CHANGELOG 整理 + 发 `1.1.0-rc.1`

---

## 验收标准

- [ ] 1.0 全部测试无回归
- [ ] 新增 API 单测覆盖率 ≥ 95%
- [ ] 多端 / 二级认证 / JWT / 观测性四大方向各有完整 E2E 场景
- [ ] 文档新增章节 ≥ 4 篇
- [ ] 与 1.0 API 对比文档（迁移指南）

---

## 时间线（参考）

| 阶段 | 预计工期 |
| --- | --- |
| Milestone 1 | 1 周 |
| Milestone 2 | 3 天 |
| Milestone 3 | 4 天 |
| Milestone 4 | 3 天 |
| **合计** | **~3 周** |

---

## 社区反馈收集

在 `1.0.0-rc.1` 到 `1.0.0` 稳定期，优先观察以下 issue 类型来调整本 Roadmap：

- 对多端互踢语义的诉求（按设备？按 IP？按指纹？）
- 二级认证 vs 临时 token 哪个更紧迫
- 是否需要内置 JWT（或社区倾向于自行集成 `@nestjs/jwt`）
- 审计钩子的消费形态（同步回调 / EventEmitter / Observable）

欢迎在 [GitHub Issues](https://github.com/xiaoLangtou/xlt-token/issues) 提交需求。

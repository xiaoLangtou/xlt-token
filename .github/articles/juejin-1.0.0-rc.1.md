# 把 Sa-Token 搬到 NestJS 生态：聊聊 xlt-token 1.0 那些容易被低估的设计

> 本文不是产品安利，而是一篇**架构复盘**。聊一聊在为 NestJS 实现一个生产级 Token 鉴权库的过程中，那些拍板时纠结、上线后发现"还好这么做"的细节。

最近发布了 `xlt-token@1.0.0-rc.1`——一个为 NestJS 设计的 Token 鉴权库，灵感来源于 Java 生态广为人知的 [Sa-Token](https://sa-token.cc/)。

仓库地址：[github.com/xiaoLangtou/xlt-token](https://github.com/xiaoLangtou/xlt-token)

它的功能矩阵看起来并不复杂——登录、登出、踢人下线、权限校验、会话存储——但真正动手实现时，每一个看起来"理应如此"的能力背后都有几个不那么显然的设计选择。这篇文章想聊聊其中**最容易被低估**的 5 个设计点。

如果你也在思考"该自己写一个鉴权库还是直接用 `@nestjs/passport`"，希望这篇文章能给你一些参考。

---

## 一、为什么不直接用 Passport？

`@nestjs/passport` 在生态里几乎是 NestJS 鉴权的"默认答案"。但它本质是 **strategy 路由**——你提供一个策略（`local` / `jwt` / `oauth2`），Passport 负责调度。它**不解决**这些问题：

- **顶号语义**：同账号在第二台设备登录时，第一台应该被踢还是共存？
- **下线原因可追溯**：用户被踢下线后，前端拿到 401，要怎么区分"token 过期"和"被管理员强制下线"？
- **活跃过期 vs 绝对过期**：用户连续操作 24 小时不应该被踢，但闲置 30 分钟应该自动登出。
- **会话扩展数据**：除了 `loginId`，还想存"最近 IP / 昵称 / 设备 ID"等数据，与 token 同生命周期。

Sa-Token 在 Java 生态把这些"业务侧每次都要重新发明的轮子"统一封装好了。我希望 Node 生态也有这样一个库。

但**移植不是翻译**。Java 的同步阻塞模型、Spring 的注解扫描机制、JVM 的反射特性，在 TypeScript 里都需要重新设计。下面 5 个细节就是这种"重新设计"过程中最有代表性的取舍。

---

## 二、存储键的三层结构：为什么不能只用一个 Key

最朴素的想法是 `token -> userId` 一对一映射：

```
auth:token:abc123 → "1001"
```

但这有个致命问题：**怎么实现"同账号顶号"？**

你拿到的是新登录的 `userId=1001`，但你**不知道这个用户之前用的是哪个 token**。要遍历所有 key 才能找到？那性能就完了。

`xlt-token` 的解法是**三层键空间**：

```
authorization:login:token:<token>          → loginId       （正向：token 找用户）
authorization:login:session:<loginId>      → token         （反向：用户找 token）
authorization:login:lastActive:<token>     → timestamp     （活跃时间戳）
```

有了反向索引，登录时的逻辑变得清晰：

```ts
async login(loginId: string) {
  const oldToken = await store.get(sessionKey(loginId));  // O(1)
  if (oldToken && !isConcurrent) {
    await store.update(tokenKey(oldToken), 'BE_REPLACED');  // 顶号
  }
  const newToken = strategy.create();
  await store.set(tokenKey(newToken), loginId);
  await store.set(sessionKey(loginId), newToken);
  return newToken;
}
```

**关键设计**：登录、登出、踢人都是 O(1) 的 store 操作，**没有任何扫描遍历**。这是把 sessionKey 当成"反向索引"换来的。

P1 加上权限和会话后，键空间又扩展了几条，但**接口契约不变**：所有键都是平铺的字符串 KV，可以无差别 Plug 到 Memory / Redis / 任何 KV 存储上。

---

## 三、`BE_REPLACED` / `KICK_OUT` 哨兵值：删 Key 是错的

第二个容易踩坑的地方：**用户被踢下线时，要不要删除 tokenKey？**

朴素方案是直接删：

```ts
async kickout(loginId) {
  const token = await store.get(sessionKey(loginId));
  await store.delete(tokenKey(token));   // ❌ 看似干净，其实丢信息
  await store.delete(sessionKey(loginId));
}
```

问题来了：用户下次请求带着旧 token，服务端 `store.get(tokenKey)` 返回 `null`。你怎么告诉前端"是你被踢了"还是"token 单纯过期了"？

`xlt-token` 的做法是写**哨兵值**而不是删除：

```ts
async kickout(loginId) {
  const token = await store.get(sessionKey(loginId));
  await store.update(tokenKey(token), 'KICK_OUT');  // ✅ 保留 TTL，只改值
  await store.delete(sessionKey(loginId));
}
```

下次用户请求时，`_resolveLoginId` 顺序判定：

```
1. token 不存在     → NOT_TOKEN
2. value === null   → INVALID_TOKEN（绝对过期 / 错 token）
3. value === 'BE_REPLACED' → BE_REPLACED（顶号）
4. value === 'KICK_OUT'    → KICK_OUT（被踢）
5. activeTimeout 过期      → TOKEN_TIMEOUT
6. 通过                    → 解析 loginId
```

最终前端拿到的 401 响应体可以精确区分**六种**未登录原因：

| 类型 | 含义 | 前端建议行为 |
| --- | --- | --- |
| `NOT_TOKEN` | 未提供 token | 跳转登录页 |
| `INVALID_TOKEN` | token 不存在（错的 / 过期） | 跳转登录页 |
| `TOKEN_TIMEOUT` | 闲置过久（活跃过期机制触发） | 提示"长时间未操作"+登录页 |
| `TOKEN_FREEZE` | lastActive 键被人为清理 | 跳转登录页 |
| `BE_REPLACED` | 同账号在其他设备登录 | 提示"账号在其他设备登录" |
| `KICK_OUT` | 管理员强制下线 | 提示"已被强制下线" |

> 这是一个**写场景多花一点存储，换读场景的精确诊断**的典型权衡。哨兵值的 TTL 跟着原 token 的剩余时间，不会内存泄漏。

---

## 四、通配符权限匹配：两个让人翻车的细节

P1 加权限校验时，要支持 `user:*` 匹配 `user:add` / `user:edit` 这样的层级通配。一开始我想得很简单：

```ts
// ❌ 第一版（有 bug）
function matchPermission(pattern: string, target: string): boolean {
  pattern.split('').forEach((char, i) => {
    if (char === '*') return true;       // forEach 里的 return 不是函数 return!
    if (char !== target[i]) return false;
  });
  return true;
}
```

老 JS 写多了的人能一眼看出问题：**`Array.prototype.forEach` 的回调里 `return` 只是结束当次回调，不是结束外层函数**。结果就是不管什么输入都返回 `true`，权限校验直接形同虚设。

修复后用 `for...of` 或正则：

```ts
// ✅ 修复版
export function matchPermission(pattern: string, target: string): boolean {
  if (pattern === target) return true;
  if (pattern === '*') return true;

  // 转义除 * 外的所有正则元字符
  const regex = new RegExp(
    '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
  );
  return regex.test(target);
}
```

第二个翻车点：测试覆盖率拉到 90% 也没发现的 bug。在权限引擎里，原本有这样的"短路优化"：

```ts
// ❌ 有问题的写法
async hasPermission(loginId: string, perm: string) {
  const list = await this.stpInterface.getPermissionList(loginId);
  if (list.includes(perm)) return true;          // 短路 1
  return list.some(p => matchPermission(p, perm));
}
```

看起来很合理对吧？但 `list.includes(perm)` 是**全等匹配**——它会拦截 `user:*` 这种通配符权限的判定。如果用户拥有 `['user:*']`，校验 `'user:add'` 时：

1. `list.includes('user:add')` → `false`（因为 list 里只有 `'user:*'`）
2. 进入 `some(...)` → `matchPermission('user:*', 'user:add')` → 应该 true

但如果用户拥有的是 `['user:add']`，校验 `'user:add'` 时：

1. `list.includes('user:add')` → `true` → 短路返回

——等等，这看起来没问题啊？

问题在另一个方向：用户拥有 `['*']`（全权限），校验任何 perm：

1. `list.includes('user:add')` → `false`
2. `some(...)` 里 `matchPermission('*', 'user:add')` → `true`

OK，刚好对。**但**如果有一天 `getPermissionList` 返回了 `['user:add', 'user:add']`（业务方误传了重复），`includes` 会触发，看起来没问题——但你**永远不会知道**通配符的 `some(...)` 路径没有覆盖。

最终我把"短路优化"删掉了，无论如何都走通配符匹配，性能损失 < 5%（权限通常 10~50 项），但**逻辑可推理性**显著提升。

> 教训：**别在快路径上用看似等价但语义不同的 API**。`includes` 不是 `matchPermission` 的子集。

---

## 五、Guard 的"模板方法 + 钩子"设计：一个真实 bug 案例

NestJS 的 Guard 在做鉴权时，最常见的需求是**校验通过后加载用户信息到 `request.user`**。如果让每个项目都自己继承 `CanActivate` 写一遍这个流程，会有大量重复代码。

`xlt-token` 提供了一个抽象基类：

```ts
@Injectable()
export abstract class XltAbstractLoginGuard implements CanActivate {
  protected constructor(
    protected reflector: Reflector,
    protected config: XltTokenConfig,
    protected stpLogic: StpLogic,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!this.requiresLogin(ctx)) return true;

    const request = ctx.switchToHttp().getRequest();
    const result = await this.stpLogic.checkLogin(request);

    if (!result.ok) {
      await this.onAuthFail?.(result, request);    // 钩子 1
      throw new NotLoginException(result.reason);
    }

    request.stpLoginId = result.loginId;
    request.stpToken = result.token;
    await this.onAuthSuccess?.(result, request);   // 钩子 2
    return true;
  }

  // 三个钩子供子类 override
  protected requiresLogin(ctx: ExecutionContext): boolean { /* 默认实现 */ }
  protected onAuthSuccess?(result, request): void | Promise<void>;
  protected onAuthFail?(result, request): void | Promise<void>;
}
```

业务子类只需实现 `onAuthSuccess`：

```ts
@Injectable()
export class LoginGuard extends XltAbstractLoginGuard {
  constructor(
    reflector: Reflector,
    @Inject(XLT_TOKEN_CONFIG) config: XltTokenConfig,
    stpLogic: StpLogic,
    private redis: RedisService,
  ) {
    super(reflector, config, stpLogic);
  }

  protected async onAuthSuccess(result, request) {
    request.user = await this.redis.get(`user_info:${result.loginId}`);
  }
}
```

### 一个差点上线的 Bug

写完这个抽象类，单元测试全绿，提了 PR。E2E 测试时发现 `onAuthFail` **永远没被调用过**。

回看代码——原始实现长这样：

```ts
// ❌ 死代码
async canActivate(ctx) {
  const result = await this.stpLogic.checkLogin(request);
  // checkLogin 失败时会自己 throw NotLoginException

  if (!result.ok) {
    await this.onAuthFail?.(result, request);   // 永远到不了这里
    throw new NotLoginException(result.reason);
  }
  // ...
}
```

问题在于 `stpLogic.checkLogin` 内部就会**抛出 `NotLoginException`**——它的设计本意是"严格校验，失败抛错"，所以`if (!result.ok)` 这条分支是死代码。

修复也简单，用 try/catch 把钩子塞到抛错前：

```ts
// ✅ 修复后
async canActivate(ctx) {
  let result;
  try {
    result = await this.stpLogic.checkLogin(request);
  } catch (e) {
    if (e instanceof NotLoginException) {
      await this.onAuthFail?.({ ok: false, reason: e.message }, request);
    }
    throw e;
  }
  // ... 成功路径
}
```

**教训**：抽象类设计时，钩子的**触发时机**和**底层方法的副作用**要严格对齐。这种 bug 用单元测试很难发现——只有把抽象类放到真实 Nest 容器里跑 E2E 才会暴露。

为了防止类似 bug 再出现，我后来给这个项目建了完整的 E2E 测试基建，37 个用例覆盖 8 类场景，包括上面这个钩子的实际触发验证。

---

## 六、`StpUtil` 静态门面 vs DI：两种风格并存的取舍

NestJS 的最佳实践是**一切走 DI**：

```ts
@Injectable()
export class AuthController {
  constructor(private stpLogic: StpLogic) {}

  @Post('login')
  async login() {
    return await this.stpLogic.login('1001');
  }
}
```

但有些场景 DI 极不方便：

- 全局异常过滤器 / 拦截器：构造函数注入会让过滤器失去 NestJS 的"开箱即用"特性
- 工具类 / Helper / Utility：写个简单脚本就要构造一遍 IoC 容器
- 测试中需要快速 mock 全局认证状态时

参考 Sa-Token，`xlt-token` 提供了 `StpUtil` 静态门面：

```ts
import { StpUtil } from 'xlt-token';

// 任何地方直接调用，零 DI 依赖
const token = await StpUtil.login('1001');
const id = await StpUtil.getLoginId(req);
```

实现上是个简单的"延迟单例"：

```ts
let _stpLogic: StpLogic | null = null;
export function setStpLogic(logic: StpLogic) {
  _stpLogic = logic;
}

export class StpUtil {
  static async login(loginId: string, options = {}) {
    if (!_stpLogic) throw new Error('StpLogic not initialized');
    return _stpLogic.login(loginId, options);
  }
  // ...
}
```

`XltTokenModule` 在 `OnModuleInit` 时调 `setStpLogic` 把容器里的实例注入静态变量。

### 两种风格的取舍

| 维度 | DI（`StpLogic`） | 静态门面（`StpUtil`） |
| --- | --- | --- |
| 可测试性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐（需 mock 全局变量） |
| 类型推导 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 使用便捷度 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 多实例支持 | ✅ | ❌（全局单例） |
| 启动顺序敏感 | ❌ | ⚠️（必须 Module init 后才能用） |

**两者并存**是有意为之：让用户在不同上下文按习惯选择。统一的内部实现保证两者**行为完全一致**。

---

## 七、性能与质量数据

`1.0.0-rc.1` 的实测数据：

| 指标 | 数值 |
| --- | --- |
| 包大小（gzip） | **7.4 KB** |
| 单测覆盖率 | 98.20% / 92.18% / 98.75% |
| E2E 覆盖率 | 95.80% / 90.80% / 97.43% |
| 测试用例总数 | **195** |
| 装饰器 / Guard 覆盖 | **100% 全维度** |

依赖：

- `es-toolkit ^1.0.0`（替代 lodash）
- `uuid ^10.0.0`
- `@nestjs/common` / `@nestjs/core` 作为 peer dep

完全无业务侵入，没有任何 ORM / DB / Redis 强绑定。

---

## 八、与其他方案的对比

| 维度 | xlt-token | @nestjs/passport | Java Sa-Token |
| --- | --- | --- | --- |
| 类型 | 完整鉴权框架 | strategy 调度器 | 完整鉴权框架 |
| 顶号 / 踢人语义 | ✅ | ❌（自己实现） | ✅ |
| 下线原因区分 | ✅（6 种） | ❌ | ✅ |
| 权限通配符 | ✅ | ❌ | ✅ |
| 装饰器粒度 | 6 个 | 1 个 | 多个 |
| 静态门面 | ✅ | ❌ | ✅ |
| 包大小 | 7.4KB gzip | ~50KB | N/A（JVM） |
| 适合场景 | 中后台 / 单点登录 | OAuth2 等多协议适配 | Java 后台标准方案 |

---

## 九、未来：1.1.0 规划

`1.0` 的范畴是"最佳实践 + 完备的单点登录鉴权"。`1.1.0` 计划补齐四个方向：

- 🔐 **二级认证 + 临时 token**：敏感操作的二次确认 + 短效授权链接
- 📱 **多端登录管理**：按设备类型互踢、查询用户在线设备列表
- 🪪 **JWT Strategy**：内置另一种主流 Token 方案，与 `UuidStrategy` 互可切换
- 📊 **观测性 API**：在线用户列表、强制下线、钩子事件导出

详细的 Roadmap：[xiaolangtou.github.io/xlt-token/roadmap/1-1-0](https://xiaolangtou.github.io/xlt-token/roadmap/1-1-0)

---

## 十、试用与反馈

```bash
pnpm add xlt-token@next
```

文档：[xiaolangtou.github.io/xlt-token](https://xiaolangtou.github.io/xlt-token/)
GitHub：[github.com/xiaoLangtou/xlt-token](https://github.com/xiaoLangtou/xlt-token)

`1.0.0-rc.1` 是发稳定版前的最后窗口期，特别欢迎以下反馈：

- API 命名 / 类型签名建议
- 文档不清晰之处
- 与你现有方案对比的痛点

如果这篇文章对你有启发，欢迎点赞收藏。架构设计没有银弹，每个看似明显的选择背后都有不那么显然的考量——希望这种"复盘"形式的分享能帮到正在做类似设计的你。

---

## 附：本文涉及的关键源码位置

| 设计点 | 源码位置 |
| --- | --- |
| 三层键空间 | `src/auth/stp-logic.ts:101-138` |
| 哨兵值机制 | `src/auth/stp-logic.ts:283-310`（kickout） |
| 通配符匹配 | `src/perm/perm-pattern-match.ts` |
| 抽象 Guard | `src/guards/xlt-abstract-login.guard.ts` |
| 静态门面 | `src/auth/stp-util.ts` |

---

> 公众号 / 掘金转载请注明出处。Bug / 建议直接提 [Issue](https://github.com/xiaoLangtou/xlt-token/issues)。

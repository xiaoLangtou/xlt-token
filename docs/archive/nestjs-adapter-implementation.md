# 任务二：适配 NestJS（`@xlt-token/nestjs`）· 实现文档

> **状态**：实施规划  
> **前置**：[core-extraction-implementation.md](./core-extraction-implementation.md) 完成 HttpContext 化  
> **关联**：[multi-framework-architecture.md](./multi-framework-architecture.md) Phase 2  
> **目标版本**：`2.0.0`

---

## 1. 目标

把 NestJS 专属代码独立成集成包，职责清晰：

- **L3**：Module、Guard、Decorator、Nest 异常包装
- **L2**：Express HttpContext 桥接（Nest 默认 Express 适配器）
- **不重复实现**鉴权逻辑，全部委托 `@xlt-token/core`

最终用户可：

```ts
// 2.0 推荐
import { XltTokenModule, XltTokenGuard, LoginId } from '@xlt-token/nestjs';

// 1.x 兼容（compat 包）
import { XltTokenModule } from 'xlt-token'; // re-export
```

---

## 2. 总体思路

```
@xlt-token/nestjs (L3)
  XltTokenModule / Guard / Decorators / Nest Exceptions
           │
           ▼
  createExpressContext (L2)
           │
           ▼
@xlt-token/core (L1)
  StpLogic.checkLogin(ctx: HttpContext)
```

**NestJS 适配只做「框架胶水」，不做「鉴权算法」。**

---

## 3. 目标包结构

```
packages/nestjs/
├── package.json              # peer: @nestjs/common, @nestjs/core, @xlt-token/core
├── src/
│   ├── xlt-token.module.ts
│   ├── guards/
│   │   ├── xlt-token.guard.ts
│   │   └── xlt-abstract-login.guard.ts
│   ├── decorators/
│   │   ├── login-id.decorator.ts
│   │   ├── token-value.decorator.ts
│   │   ├── xlt-ignore.decorator.ts
│   │   ├── xlt-check-login.decorator.ts
│   │   ├── xlt-check-permission.decorator.ts
│   │   ├── xlt-check-role.decorator.ts
│   │   └── xlt-check-safe.decorator.ts
│   ├── exceptions/
│   │   ├── nest-not-login.exception.ts    # extends UnauthorizedException, wraps core
│   │   └── ...
│   ├── providers/
│   │   └── xlt-token-context.provider.ts  # 桥接 createXltToken ↔ Nest DI
│   ├── http/
│   │   └── nest-express-bridge.ts         # ExecutionContext → HttpContext
│   └── index.ts
└── tsdown.config.ts

packages/compat/              # 可选，或根包继续充当
└── index.ts                  # export * from '@xlt-token/nestjs'
```

---

## 4. 分步实施计划

### Step 1：创建 `packages/nestjs`（0.5 天）

**依赖关系：**

```json
{
  "name": "@xlt-token/nestjs",
  "peerDependencies": {
    "@nestjs/common": "^10 || ^11",
    "@nestjs/core": "^10 || ^11",
    "@xlt-token/core": "workspace:*"
  },
  "dependencies": {
    "@xlt-token/core": "workspace:*"
  }
}
```

`turbo.json` 增加 nestjs 包的 build/test 任务。

### Step 2：DI 桥接 — Module 改造（1 天）

**思路**：Module 内部调用 `createXltToken()`，再把实例注册进 Nest 容器。

```ts
// 方案 A：注册 XltTokenContext 单例
{
  provide: XLT_TOKEN_CONTEXT,
  useFactory: (opts) => createXltToken(opts),
  inject: [XLT_MODULE_OPTIONS],
}

// 方案 B：继续提供 StpLogic token（兼容现有 Guard 注入）
{
  provide: StpLogic,
  useFactory: (ctx: XltTokenContext) => ctx.stpLogic,
  inject: [XLT_TOKEN_CONTEXT],
}
```

**`forRoot` / `forRootAsync` 行为保持不变**，只是 provider 来源从本地 class 变为 core factory。

**注意**：修复 `xlt-token.module.ts` 中错误的 deep import：

```ts
// 错误 ❌
import { setStpLogic } from '../packages/core/src/auth/stp-util';

// 正确 ✅
import { setStpLogic } from '@xlt-token/core';
```

### Step 3：Guard 改造 — HttpContext 桥接（1~2 天）

**现在：**

```ts
const request = context.switchToHttp().getRequest();
const result = await this.stpLogic.checkLogin(request);
request.stpLoginId = result.loginId;
```

**目标：**

```ts
const req = context.switchToHttp().getRequest();
const res = context.switchToHttp().getResponse();
const httpCtx = createExpressContext(req, res);

const result = await this.stpLogic.checkLogin(httpCtx);
if (!result.ok) {
  throw new NestNotLoginException(result.reason!, result.token);
}

// 1.0 兼容：继续写 req.stpLoginId
req.stpLoginId = result.loginId;
req.stpToken = result.token;
```

**元数据逻辑（Reflector）完全保留：**

- `@XltIgnore` / `@XltCheckLogin` ↔ `defaultCheck`
- `@XltCheckPermission` / `@XltCheckRole` ↔ `StpPermLogic`
- `@XltCheckSafe` ↔ `StpLogic.checkSafe`

**`XltAbstractLoginGuard`**：改为基于 `AuthResult` + core 异常，不再直接依赖 Express Request 类型。

### Step 4：Decorator 迁移（0.5 天）

Decorators 几乎**原样搬迁**，仅改 import 路径：

| 装饰器 | 依赖 |
| --- | --- |
| `@LoginId()` | `createParamDecorator((_, ctx) => ctx.switchToHttp().getRequest().stpLoginId)` |
| `@TokenValue()` | 读 `req.stpToken` |
| `@XltIgnore()` 等 | 写 metadata key（key 常量来自 `@xlt-token/core`） |

**1.0 兼容关键**：Decorator 仍读 `request.stpLoginId`，Guard 负责从 `ctx.state` 同步到 `req`。

### Step 5：异常双层包装（0.5 天）

**思路**：core 异常是「源真相」，Nest 异常是「HTTP 响应适配」。

```ts
// packages/nestjs/src/exceptions/nest-not-login.exception.ts
export class NestNotLoginException extends UnauthorizedException {
  constructor(type: NotLoginType, token?: string) {
    super({ statusCode: 401, type, message: describeType(type) });
  }

  static fromCore(err: CoreNotLoginException) {
    return new NestNotLoginException(err.type, err.token);
  }
}
```

根包 `src/exceptions/*` 删除，改为：

```ts
// 兼容导出
export { NestNotLoginException as NotLoginException } from '@xlt-token/nestjs';
```

或保留 class 名 `NotLoginException` 作为 alias。

### Step 6：Store / Strategy 的 Nest 注册（1 天）

| 组件 | 处理方式 |
| --- | --- |
| `MemoryStore` | core 默认实现；Module 可选 `useClass: MemoryStore` |
| `UuidStrategy` | 同上 |
| `RedisStore` | 暂留 `@xlt-token/nestjs` 或拆 `@xlt-token/store-redis`，Module 继续 `useClass: RedisStore` |
| `JwtStrategy` | 暂留 nestjs 包，依赖 `jsonwebtoken` peer |

**去掉 Store/Strategy 上的 `@Injectable()` 后**，Module 注册方式改为：

```ts
{ provide: XLT_TOKEN_STORE, useClass: MemoryStore } // MemoryStore 是普通 class
```

Nest 仍可通过 `useClass` 实例化 plain class。

### Step 7：E2E 迁移与 compat 包（1 天）

1. 根 `test/*.e2e-spec.ts` 改为 import `@xlt-token/nestjs`（或保持 `xlt-token` re-export）
2. 创建 `packages/compat`（或根包继续充当）：

```ts
export * from '@xlt-token/nestjs';
export * from '@xlt-token/core'; // 按需
```

3. npm 发布：`xlt-token` 包 dependencies 包含 `@xlt-token/nestjs` + `@xlt-token/core`

### Step 8：文档与迁移指南（0.5 天）

- 新增 `docs/migration-2.0.md`
- 说明：1.x 用户**零改动**；可选改为 `@xlt-token/nestjs` 导入

---

## 5. NestJS 适配关键设计点

### 5.1 请求状态双写策略（兼容 1.0）

| 写入位置 | 用途 |
| --- | --- |
| `ctx.state.stpLoginId` | core 运行时标准 |
| `req.stpLoginId` | 1.0 Decorator / 用户代码兼容 |

Guard 在 `checkLogin` 成功后**两处都写**，过渡期不 breaking。

### 5.2 Module 与 Factory 的关系

```
XltTokenModule.forRoot(options)
  └─> createXltToken(options)     // core 工厂，纯 JS
  └─> Nest providers 桥接        // 把 core 实例注入 Guard
```

Nest 用户**不需要**手动调 `createXltToken`；Express 用户**不需要** Module。

### 5.3 Fastify 适配器（Nest 可选）

若用户使用 `NestFactory.create(AppModule, new FastifyAdapter())`：

- Phase 2 先只支持默认 Express 适配器
- 后续加 `@xlt-token/adapter-fastify` + Nest 检测 adapter 类型

---

## 6. 验收标准

- [ ] `@xlt-token/nestjs` 不含鉴权算法实现（StpLogic 只在 core）
- [ ] 现有 11 个 E2E spec / 63 用例全绿
- [ ] `import from 'xlt-token'` 与 1.0 完全一致
- [ ] `import from '@xlt-token/nestjs'` 可用
- [ ] Guard + Decorator + Module + forRootAsync 行为与现网一致

---

## 7. 与 Core 任务的协作顺序

**不要并行做**：Nest Guard 依赖 core 的 `checkLogin(ctx: HttpContext)` 签名，core 未完成 HttpContext 化会导致 nestjs 包反复返工。

```
Week 1  Core：异常 + StpLogic HttpContext 化 + spec 迁移
Week 2  Core：Perm/Session/Store/Factory + 覆盖率
Week 3  NestJS：Module 桥接 + Guard/Decorator/Exception
Week 4  NestJS：E2E + compat re-export + 文档
```

---

## 8. 建议 PR 切分

| PR | 范围 | 预估 |
| --- | --- | --- |
| PR-5 | 新建 `@xlt-token/nestjs`，Module DI 桥接 | 中 |
| PR-6 | Guard / Decorator / Exception 迁移 + E2E 验证 | 大 |
| PR-7 | compat 包 + 文档 + 发布配置 | 小 |

> Core 抽离相关 PR 见 [core-extraction-implementation.md](./core-extraction-implementation.md)。

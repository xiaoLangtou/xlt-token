# E2E 测试方案（基于 NestJS 官方规范）

> 本文档是 xlt-token 的端到端测试方案，遵循 [NestJS 官方测试文档](https://docs.nestjs.com/fundamentals/testing) 的规范，结合本项目实际情况（库性质、vitest 测试运行器、已有 P0 + P1 能力）落地。
>
> - 前置：P0 + P1 全部完成（139/139 单测通过）
> - 目标：在发布首个稳定版前补齐 **HTTP 层端到端覆盖**，验证 Guard + Decorator + Controller 全链路
> - 最后更新：2026-04-26

---

## 一、方案总览

### 1.1 对照 NestJS 官方范式

| 官方约定 | 本项目落地 |
| --- | --- |
| `@nestjs/testing` + `Test.createTestingModule` | ✅ 直接使用 |
| `supertest` 发起 HTTP 请求 | ✅ 需新增 devDep |
| 默认 Jest | ⚠️ 使用 **vitest**（API 兼容：`describe/it/expect`，`vi.fn` 替代 `jest.fn`） |
| `test/` 目录放 `*.e2e-spec.ts` | ✅ 新建 `test/` + 独立 vitest 配置 |
| `createNestApplication()` → `app.init()` | ✅ 每个 suite 在 `beforeAll` 中构建 |
| 覆盖全局守卫：保持 `APP_GUARD` 插槽 + `overrideProvider` | ✅ 测试自定义 Guard 场景时采用 |

### 1.2 测试金字塔定位

```
          ┌──────────┐
          │  E2E     │  ← 本文档（HTTP 层：Guard + Decorator + Controller）
          └──────────┘
        ┌──────────────┐
        │  单元测试     │  ← 已完成 139 个（StpLogic / StpPermLogic / XltSession 等）
        └──────────────┘
```

E2E 聚焦在**单元测试覆盖不到**的维度：

- 装饰器元数据 → Guard 读取 → 业务逻辑的**真实链路**
- 异常 → HTTP 状态码的**正确映射**（401 / 403）
- `@LoginId()` / `@TokenValue()` 参数装饰器**通过 DI 上下文**真正拿到值
- `request.stpLoginId` 在 Guard 中注入后，Controller 能读到

---

## 二、目录结构

```
xlt-token/
├── src/                          # 保持不变（*.spec.ts 单元测试）
└── test/                         # 新增：E2E 测试
    ├── fixtures/
    │   ├── mock-stp-interface.ts # 共享的权限/角色 Mock 实现
    │   └── test-app.module.ts    # 共享测试 Module 构造器 + Controller
    ├── app-guard.e2e-spec.ts     # XltTokenGuard 全局守卫（黑名单 + 白名单）
    ├── permission.e2e-spec.ts    # @XltCheckPermission / @XltCheckRole
    ├── custom-guard.e2e-spec.ts  # XltAbstractLoginGuard 子类 + 钩子
    ├── session.e2e-spec.ts       # XltSession 跨请求读写
    ├── lifecycle.e2e-spec.ts     # 登出/踢人/被顶/冻结 → HTTP 语义
    └── vitest.e2e.config.ts      # E2E 专用 vitest 配置
```

---

## 三、基础设施

### 3.1 依赖安装

```bash
pnpm add -D supertest @types/supertest
```

已有的 `@nestjs/testing` / `@nestjs/platform-express` / `@nestjs/common` 不需要重复安装。

### 3.2 E2E 专用 vitest 配置

与单元测试配置分离，避免互相串扰、便于独立跑。

```ts
// test/vitest.e2e.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
```

### 3.3 `package.json` 脚本

```json
{
  "scripts": {
    "test": "vitest run",
    "test:e2e": "vitest run --config test/vitest.e2e.config.ts",
    "test:all": "pnpm test && pnpm test:e2e"
  }
}
```

### 3.4 共享 Fixture：`MockStpInterface`

```ts
// test/fixtures/mock-stp-interface.ts
import type { StpInterface } from '../../src';

export class MockStpInterface implements StpInterface {
  private readonly perms = new Map<string, string[]>([
    ['1001', ['user:read', 'user:write', 'user:delete']],
    ['1002', ['user:read']],
  ]);
  private readonly roles = new Map<string, string[]>([
    ['1001', ['admin', 'super']],
    ['1002', ['user']],
  ]);

  async getPermissionList(loginId: string) {
    return this.perms.get(String(loginId)) ?? [];
  }
  async getRoleList(loginId: string) {
    return this.roles.get(String(loginId)) ?? [];
  }
}
```

### 3.5 共享 App 构造器：`buildTestApp`

统一构造一个包含所有典型路由的测试 App，通过参数控制不同场景。

```ts
// test/fixtures/test-app.module.ts
import { Controller, Get, Module, Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  LoginId, TokenValue,
  XltCheckLogin, XltCheckPermission, XltCheckRole, XltIgnore,
  XltMode, XltTokenGuard, XltTokenModule,
} from '../../src';
import { MockStpInterface } from './mock-stp-interface';

@Controller('api')
export class DemoController {
  @XltIgnore()
  @Get('public')
  pub() { return { ok: true }; }

  @Get('me')
  me(@LoginId() id: string, @TokenValue() token: string) {
    return { id, token };
  }

  @XltCheckPermission({ permissions: ['user:read'] })
  @Get('read')
  read() { return { action: 'read' }; }

  @XltCheckPermission({ permissions: ['user:read', 'user:delete'], mode: XltMode.AND })
  @Get('delete')
  del() { return { action: 'delete' }; }

  @XltCheckPermission({ permissions: ['user:*'], mode: XltMode.OR })
  @Get('wildcard')
  wild() { return { action: 'wild' }; }

  @XltCheckRole({ roles: ['admin'] })
  @Get('admin')
  admin() { return { action: 'admin' }; }

  @XltCheckLogin()
  @Get('whitelisted')
  whitelisted(@LoginId() id: string) { return { id }; }
}

export interface BuildOpts {
  defaultCheck?: boolean;
  extraProviders?: Provider[];
  guardClass?: any;
}

export async function buildTestApp(opts: BuildOpts = {}) {
  @Module({
    imports: [
      XltTokenModule.forRoot({
        isGlobal: true,
        config: {
          tokenName: 'authorization',
          tokenPrefix: '',                       // 测试里不带 Bearer 前缀
          defaultCheck: opts.defaultCheck ?? true,
        },
        stpInterface: MockStpInterface,
      }),
    ],
    controllers: [DemoController],
    providers: [
      { provide: APP_GUARD, useClass: opts.guardClass ?? XltTokenGuard },
      ...(opts.extraProviders ?? []),
    ],
  })
  class TestAppModule {}

  const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return { app, moduleRef };
}
```

---

## 四、核心用例文件

### 4.1 `test/app-guard.e2e-spec.ts` — 全局守卫 + 装饰器

覆盖：`XltTokenGuard`、`@XltIgnore`、`@XltCheckLogin`、`@LoginId`、`@TokenValue`、黑白名单模式。

```ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { StpLogic } from '../src';
import { buildTestApp } from './fixtures/test-app.module';

describe('XltTokenGuard 黑名单模式 (e2e)', () => {
  let app: INestApplication;
  let stpLogic: StpLogic;
  let token1001: string;

  beforeAll(async () => {
    const { app: a, moduleRef } = await buildTestApp();
    app = a;
    stpLogic = moduleRef.get(StpLogic);
    token1001 = await stpLogic.login('1001');
  });
  afterAll(() => app.close());

  it('@XltIgnore 路由无 token 放行', () =>
    request(app.getHttpServer()).get('/api/public').expect(200, { ok: true }));

  it('默认校验：无 token → 401 + NOT_TOKEN', async () => {
    const res = await request(app.getHttpServer()).get('/api/me').expect(401);
    expect(res.body.type).toBe('NOT_TOKEN');
  });

  it('有效 token → 200 且 @LoginId/@TokenValue 注入', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/me').set('authorization', token1001).expect(200);
    expect(res.body).toEqual({ id: '1001', token: token1001 });
  });

  it('无效 token → 401 + INVALID_TOKEN', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/me').set('authorization', 'garbage').expect(401);
    expect(res.body.type).toBe('INVALID_TOKEN');
  });
});

describe('XltTokenGuard 白名单模式 (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const { app: a, moduleRef } = await buildTestApp({ defaultCheck: false });
    app = a;
    token = await moduleRef.get(StpLogic).login('1001');
  });
  afterAll(() => app.close());

  it('默认不校验：/api/me 放行', () =>
    request(app.getHttpServer()).get('/api/me').expect(200));

  it('@XltCheckLogin 强制校验：无 token → 401', () =>
    request(app.getHttpServer()).get('/api/whitelisted').expect(401));

  it('@XltCheckLogin + token → 200', () =>
    request(app.getHttpServer())
      .get('/api/whitelisted').set('authorization', token).expect(200, { id: '1001' }));
});
```

### 4.2 `test/permission.e2e-spec.ts` — 权限/角色

覆盖：`@XltCheckPermission`、`@XltCheckRole`、AND/OR 模式、通配符匹配。

```ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { StpLogic } from '../src';
import { buildTestApp } from './fixtures/test-app.module';

describe('Permission & Role (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;  // 1001: admin + 全权限
  let userToken: string;   // 1002: user + 只读

  beforeAll(async () => {
    const { app: a, moduleRef } = await buildTestApp();
    app = a;
    const stp = moduleRef.get(StpLogic);
    adminToken = await stp.login('1001');
    userToken = await stp.login('1002');
  });
  afterAll(() => app.close());

  describe('@XltCheckPermission', () => {
    it('admin 访问 read → 200', () =>
      request(app.getHttpServer()).get('/api/read').set('authorization', adminToken).expect(200));

    it('user 访问 read → 200', () =>
      request(app.getHttpServer()).get('/api/read').set('authorization', userToken).expect(200));

    it('AND 模式：user 缺 delete → 403', () =>
      request(app.getHttpServer()).get('/api/delete').set('authorization', userToken).expect(403));

    it('AND 模式：admin 齐全 → 200', () =>
      request(app.getHttpServer()).get('/api/delete').set('authorization', adminToken).expect(200));

    it('通配符匹配：user:read 命中 user:*', () =>
      request(app.getHttpServer()).get('/api/wildcard').set('authorization', userToken).expect(200));
  });

  describe('@XltCheckRole', () => {
    it('admin → 200', () =>
      request(app.getHttpServer()).get('/api/admin').set('authorization', adminToken).expect(200));

    it('user → 403', () =>
      request(app.getHttpServer()).get('/api/admin').set('authorization', userToken).expect(403));
  });
});
```

### 4.3 `test/custom-guard.e2e-spec.ts` — 自定义 Guard 钩子

覆盖：`XltAbstractLoginGuard` 子类 + `onAuthSuccess` / `onAuthFail` 钩子。

```ts
import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import {
  StpLogic, XltAbstractLoginGuard, XLT_TOKEN_CONFIG, type XltTokenConfig,
} from '../src';
import { buildTestApp } from './fixtures/test-app.module';

@Injectable()
class CustomLoginGuard extends XltAbstractLoginGuard {
  public static successCalls = 0;
  public static failCalls = 0;

  constructor(
    reflector: Reflector,
    @Inject(XLT_TOKEN_CONFIG) config: XltTokenConfig,
    stpLogic: StpLogic,
  ) {
    super(reflector, config, stpLogic);
  }

  protected async onAuthSuccess(result: any, request: any) {
    CustomLoginGuard.successCalls++;
    request.user = { id: result.loginId, role: 'mocked' };
  }
  protected async onAuthFail() {
    CustomLoginGuard.failCalls++;
  }
}

describe('XltAbstractLoginGuard 钩子 (e2e)', () => {
  it('onAuthSuccess / onAuthFail 正确触发', async () => {
    CustomLoginGuard.successCalls = 0;
    CustomLoginGuard.failCalls = 0;

    const { app, moduleRef } = await buildTestApp({ guardClass: CustomLoginGuard });
    const token = await moduleRef.get(StpLogic).login('1001');

    await request(app.getHttpServer()).get('/api/me').set('authorization', token).expect(200);
    expect(CustomLoginGuard.successCalls).toBe(1);

    await request(app.getHttpServer()).get('/api/me').expect(401);
    expect(CustomLoginGuard.failCalls).toBe(1);

    await app.close();
  });
});
```

### 4.4 `test/lifecycle.e2e-spec.ts` — 下线语义

覆盖：登出、踢人下线、异常类型映射。

```ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { StpLogic } from '../src';
import { buildTestApp } from './fixtures/test-app.module';

describe('Token 生命周期 (e2e)', () => {
  let app: INestApplication;
  let stp: StpLogic;

  beforeAll(async () => {
    const { app: a, moduleRef } = await buildTestApp();
    app = a;
    stp = moduleRef.get(StpLogic);
  });
  afterAll(() => app.close());

  it('logout 后旧 token → 401 INVALID_TOKEN', async () => {
    const token = await stp.login('3003');
    await request(app.getHttpServer()).get('/api/me').set('authorization', token).expect(200);
    await stp.logout(token);
    const res = await request(app.getHttpServer())
      .get('/api/me').set('authorization', token).expect(401);
    expect(res.body.type).toBe('INVALID_TOKEN');
  });

  it('kickout 后旧 token → 401 KICK_OUT', async () => {
    const token = await stp.login('4004');
    await stp.kickout('4004');
    const res = await request(app.getHttpServer())
      .get('/api/me').set('authorization', token).expect(401);
    expect(res.body.type).toBe('KICK_OUT');
  });
});
```

### 4.5 `test/session.e2e-spec.ts` — 会话读写

覆盖：`XltSession` 跨请求/跨实例持久化（MemoryStore）。

```ts
import request from 'supertest';
import { StpLogic } from '../src';
import { buildTestApp } from './fixtures/test-app.module';

describe('XltSession (e2e)', () => {
  it('跨请求保持会话数据', async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);
    const token = await stp.login('5005');

    const session = await stp.getSession('5005');
    await session.set('nickname', 'xlt');
    await session.set('ext', { role: 'vip' });

    await request(app.getHttpServer())
      .get('/api/me').set('authorization', token).expect(200);

    const reloaded = await stp.getSession('5005');
    expect(await reloaded.get('nickname')).toBe('xlt');
    expect(await reloaded.get('ext')).toEqual({ role: 'vip' });

    await app.close();
  });
});
```

---

## 五、关键实践清单（对照官方文档）

- **`Test.createTestingModule({ imports: [AppModule] }).compile()`**：每个 E2E suite 隔离构建，避免全局状态串扰
- **`createNestApplication()` + `app.init()` + `app.close()`**：标准生命周期，必须 close 否则端口泄漏
- **`supertest(app.getHttpServer())`**：官方推荐的 HTTP 模拟入口，无需真实监听端口
- **`APP_GUARD` 插槽**：
  - 本方案用「构造不同 TestAppModule」的方式切换 Guard，比 `overrideProvider(APP_GUARD)` 更干净
  - 官方文档提到的 `overrideProvider(APP_GUARD).useClass(MockAuthGuard)` 方式同样可行
- **`overrideProvider`**：预留给**业务项目使用本库**时的扩展，例如 mock Redis；库自身测试用 `MemoryStore` 即可
- **vitest 适配**：
  - `vi.fn` / `vi.spyOn` 代替 `jest.fn` / `jest.spyOn`
  - 静态计数器（如 `CustomLoginGuard.successCalls`）比 spy 更稳定
- **断言维度**：
  - 状态码（`.expect(200/401/403)`）
  - 响应体结构（`res.body.type === 'NOT_TOKEN'` 等）
  - 业务不变式：`request.stpLoginId` 通过 `/api/me` 响应间接验证

---

## 六、CI 集成

```yaml
# .github/workflows/test.yml（片段）
- run: pnpm install --frozen-lockfile
- run: pnpm test              # 单元测试（快）
- run: pnpm test:e2e          # E2E 测试
- run: pnpm build             # 构建产物校验
```

---

## 七、推进路线图

按以下顺序落地，每步都可独立跑通：

| 阶段 | 内容 | 产出 |
| --- | --- | --- |
| **M1 基建** | 装 `supertest` + 建 `test/` 目录 + 加脚本 + E2E vitest 配置 | 目录结构 + CI 可运行 |
| **M2 Fixture** | `MockStpInterface` + `buildTestApp` | 可复用测试基座 |
| **M3 核心** | `app-guard.e2e-spec.ts` + `permission.e2e-spec.ts` | 覆盖 80% 价值 |
| **M4 增强** | `custom-guard` + `lifecycle` + `session` | 全链路覆盖 |
| **M5 CI** | 接入 GitHub Actions，E2E 进入发布门禁 | 发布前自动校验 |

---

## 八、与官方文档的差异说明

| 维度 | 官方文档 | 本方案 |
| --- | --- | --- |
| 测试运行器 | Jest | vitest（单测已在用，保持一致） |
| 测试目录 | `test/` + `testRegex: .e2e-spec.ts$` | 同目录，用独立 `vitest.e2e.config.ts` |
| 请求作用域提供者 | `ContextIdFactory.spyOn` | 本库无请求作用域提供者，不适用 |
| 全局增强器覆盖 | `overrideProvider(APP_GUARD)` | 改用「不同 TestAppModule 构造」方式 |
| 自动 Mock | `useMocker(createMock)` | 本库依赖少，手写 Mock 更清晰 |

---

## 九、发布就绪度增量

补齐本方案后，xlt-token **首发 v1.0.0 的信心指数**：

- 单元测试：139/139 ✅
- E2E 测试（预估）：约 30 个用例，覆盖 Guard/装饰器/权限/生命周期/会话 ✅
- 文档：在线站点 + README + E2E 方案 ✅
- CI 门禁：单测 + E2E + 构建三重校验 ✅

**结论**：M3 完成后即可发 `v1.0.0-rc.0`；M4 完成后发 `v1.0.0`。

# xlt-token 抽离为独立 npm 包 — 实施文档

> 生成时间：2026-04-20

---

## 一、目标结构

抽离后的独立包目录结构如下：

```
xlt-token/                        ← 新建独立 repo 或 monorepo 子包
├── src/
│   ├── auth/
│   │   ├── stp-logic.ts
│   │   ├── stp-logic.spec.ts
│   │   └── stp-util.ts
│   ├── const/
│   │   └── index.ts
│   ├── core/
│   │   └── xlt-token-config.ts
│   ├── decorators/
│   │   ├── login-id.decorator.ts
│   │   ├── token-value.decorator.ts
│   │   ├── xlt-check-login.decorator.ts
│   │   └── xlt-ignore.decorator.ts
│   ├── exceptions/
│   │   └── not-login.exception.ts
│   ├── guards/
│   │   └── xlt-token.guard.ts
│   ├── store/
│   │   ├── memory-store.spec.ts
│   │   ├── memory-store.ts
│   │   └── xlt-token-store.interface.ts
│   ├── token/
│   │   ├── token-strategy.interface.ts
│   │   ├── uuid-strategy.spec.ts
│   │   └── uuid-strategy.ts
│   ├── xlt-token.module.ts
│   └── index.ts                  ← barrel 导出入口
├── package.json
├── tsconfig.json
├── tsdown.config.ts
├── README.md
└── CHANGELOG.md
```

---

## 二、`package.json` 配置

```json
{
  "name": "xlt-token",
  "version": "0.1.0",
  "description": "NestJS token authentication library inspired by Sa-Token",
  "keywords": ["nestjs", "token", "auth", "jwt", "session"],
  "author": "xltorg",
  "license": "MIT",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsdown",
    "build:watch": "tsdown --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage",
    "prepublishOnly": "pnpm run build"
  },
  "peerDependencies": {
    "@nestjs/common": "^10.0.0 || ^11.0.0",
    "@nestjs/core": "^10.0.0 || ^11.0.0",
    "reflect-metadata": "^0.1.13 || ^0.2.0",
    "rxjs": "^7.0.0"
  },
  "peerDependenciesMeta": {
    "reflect-metadata": { "optional": false },
    "rxjs": { "optional": false }
  },
  "dependencies": {
    "es-toolkit": "^1.0.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "@types/uuid": "^10.0.0",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.0",
    "tsdown": "^0.20.0",
    "typescript": "^5.1.0",
    "vitest": "^2.0.0"
  }
}
```

> **关键说明：**
> - `@nestjs/common`、`@nestjs/core`、`reflect-metadata`、`rxjs` 放 `peerDependencies`，不打包进库
> - `es-toolkit`、`uuid` 是库的运行时依赖，放 `dependencies`，会随包安装
> - express 类型（`@types/express`）仅 devDependencies，不暴露给使用方

---

## 三、`tsconfig.json` 配置

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2020"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "node_modules", "dist"]
}
```

> `emitDecoratorMetadata: true` 是 NestJS DI 的必须项，不能省略。

---

## 四、`tsdown.config.ts` 配置

```ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: 'src/index.ts',
  format: ['esm', 'cjs'],
  dts: true,
  exports: true,
  clean: true,
  platform: 'node',
  external: [
    '@nestjs/common',
    '@nestjs/core',
    'reflect-metadata',
    'rxjs',
    'express',
  ],
})
```

> **说明：**
> - `format: ['esm', 'cjs']`：同时输出 ESM（`.js`）和 CJS（`.cjs`），兼容 CommonJS 的 NestJS 项目
> - `dts: true`：自动生成 `.d.ts` 类型声明
> - `exports: true`：自动更新 `package.json` 的 `exports` 字段
> - `external`：peerDependencies 必须显式声明为 external，否则会被打包进去

---

## 五、`src/index.ts` 导出检查清单

发包前确认以下所有内容已导出：

```ts
// 模块
export { XltTokenModule, XltTokenModuleOptions, XltTokenModuleAsyncOptions } from './xlt-token.module';

// 核心逻辑
export { StpLogic } from './auth/stp-logic';
export { StpUtil } from './auth/stp-util';

// 配置与类型
export {
  XltTokenConfig,
  DEFAULT_XLT_TOKEN_CONFIG,
  XLT_TOKEN_CONFIG,
  XLT_TOKEN_STORE,
  XLT_TOKEN_STRATEGY,
} from './core/xlt-token-config';

// 存储接口与实现
export { XltTokenStore } from './store/xlt-token-store.interface';
export { MemoryStore } from './store/memory-store';

// Token 策略接口与实现
export { TokenStrategy } from './token/token-strategy.interface';
export { UuidStrategy } from './token/uuid-strategy';

// 装饰器
export { XltCheckLogin } from './decorators/xlt-check-login.decorator';
export { XltIgnore } from './decorators/xlt-ignore.decorator';
export { LoginId } from './decorators/login-id.decorator';
export { TokenValue } from './decorators/token-value.decorator';

// 守卫
export { XltTokenGuard } from './guards/xlt-token.guard';

// 异常
export { NotLoginException } from './exceptions/not-login.exception';

// 常量
export { NotLoginType } from './const/index';
```

---

## 六、路径别名处理

当前业务代码使用 `@/config/xlt-token/...` 路径别名。抽包后库内部需要改为**相对路径**，不能依赖外部 tsconfig 的 alias 配置。

### 需要逐文件替换的 import 示例

| 原路径 | 改为相对路径 |
|---|---|
| `@/config/xlt-token/core/xlt-token-config` | `../core/xlt-token-config` |
| `@/config/xlt-token/store/xlt-token-store.interface` | `../store/xlt-token-store.interface` |
| `@/config/xlt-token/const` | `../const` |
| `@/config/xlt-token/exceptions/not-login.exception` | `../exceptions/not-login.exception` |

> **建议**：用全局替换 `@/config/xlt-token/` → `../`（注意各文件层级不同需逐一调整）

---

## 七、发布流程

### 7.1 手动发布（第一次）

```bash
# 1. 安装依赖
pnpm install

# 2. 构建
pnpm run build

# 3. 检查产物
ls dist/
# 期望：index.js  index.cjs  index.d.ts  index.d.cts

# 4. 本地验证
pnpm pack --dry-run

# 5. 登录 npm
npm login

# 6. 发布
npm publish --access public
```

### 7.2 GitHub Actions 自动发布（CI/CD）

在独立 repo 中创建 `.github/workflows/publish.yml`：

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run test
      - run: pnpm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 7.3 PR 测试流水线

```yaml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run test
      - run: pnpm run build
```

---

## 八、抽离步骤（操作顺序）

| 步骤 | 操作 | 说明 |
|---|---|---|
| **1** | 新建 repo `xlt-token` 或在 monorepo 中新建 `packages/xlt-token` | 选一种方式 |
| **2** | 复制 `src/config/xlt-token/` 下所有文件到新包的 `src/` | 去掉 `docs/` 目录，不需要打包 |
| **3** | 替换所有 `@/config/xlt-token/` 路径为相对路径 | 逐文件核查 |
| **4** | 创建 `package.json`（参考第二节） | |
| **5** | 创建 `tsconfig.json`（参考第三节） | |
| **6** | 创建 `tsdown.config.ts`（参考第四节） | |
| **7** | 安装依赖 `pnpm install` | |
| **8** | 运行 `pnpm run build`，确认 `dist/` 产物正确 | |
| **9** | 运行 `pnpm run test`，确认所有单测通过 | |
| **10** | 在业务项目中 `pnpm add xlt-token`，验证 API 可用 | 最终集成测试 |
| **11** | 发布 `npm publish` 或推 tag 触发 CI | |

---

## 九、业务项目迁移后的用法

```ts
// app.module.ts（迁移后）
import { XltTokenModule } from 'xlt-token';

@Module({
  imports: [
    XltTokenModule.forRoot({
      isGlobal: true,
      config: {
        timeout: 2592000,
        tokenStyle: 'simple-uuid',
        tokenPrefix: 'Bearer ',
      },
    }),
  ],
})
export class AppModule {}
```

```ts
// 注入使用
import { StpLogic, XltIgnore, LoginId } from 'xlt-token';

@Controller('auth')
export class AuthController {
  constructor(private readonly stpLogic: StpLogic) {}

  @XltIgnore()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const token = await this.stpLogic.login(userId);
    return { token };
  }
}
```

---

## 十、注意事项 ⚠️

- **`emitDecoratorMetadata`**：tsdown 构建时需要开启，否则 NestJS DI 的 `@Inject()` 装饰器元数据丢失
- **测试框架**：建议用 `vitest`（更快），替换业务项目中的 `jest` 配置，单测文件无需改动
- **`express` 类型**：`Request` 类型来自 `@types/express`，只放 `devDependencies`，使用方项目一般已安装
- **版本策略**：遵循 semver，破坏性变更升 major，新功能升 minor，修 bug 升 patch

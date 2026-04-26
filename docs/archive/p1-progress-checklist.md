# P1 进度检查清单

> 基于 [p1-implementation-design.md](./p1-implementation-design.md) 逐项对照源码
>
> 最后更新：2026-04-26（全部完成）

---

## 一、已完成项

### 1. StpInterface 接口 + DI Token ✅

- 文件：`src/perm/stp-interface.ts`
- 状态：完整。

### 2. XltMode + 元数据 Key 常量 ✅

- 文件：`src/const/index.ts`
- 状态：完整。

### 3. XltTokenConfig P1 字段 ✅

- 文件：`src/core/xlt-token-config.ts`
- 状态：完整。

### 4. XltTokenModule stpInterface 注册 ✅

- 文件：`src/xlt-token.module.ts`
- 状态：完整。含 `StpPermLogic` 静态门面初始化。

### 5. @XltCheckPermission 装饰器 ✅

- 文件：`src/decorators/xlt-check-permission.decorator.ts`

### 6. @XltCheckRole 装饰器 ✅

- 文件：`src/decorators/xlt-check-role.decorator.ts`

### 7. XltTokenGuard 权限校验分支 ✅

- 文件：`src/guards/xlt-token.guard.ts`
- Bug 已修复：角色元数据 key 已改为 `XLT_ROLE_KEY`。

### 8. XltSession 会话对象 ✅

- 文件：`src/session/xlt-session.ts`
- `keys()` 方法已补充。

### 9. StpLogic 扩展 ✅

- 文件：`src/auth/stp-logic.ts`
- `getSession` / `getOfflineRecords` / `writeOfflineRecord` / logout 清理均已完成。

### 10. 通配符匹配函数 ✅

- 文件：`src/perm/perm-pattern-match.ts`
- Bug 已修复：`forEach` → `for` 循环；循环边界 `<=` → `<`。

### 11. StpPermLogic 权限引擎 ✅

- 文件：`src/perm/stp-perm-logic.ts`
- Bug 已修复：删除多余 `includes` 判断；`checkPermission`/`checkRole` 改为抛异常（`void` 返回）。

### 12. NotPermissionException ✅

- 文件：`src/exceptions/not-permission.exception.ts`
- 继承 `ForbiddenException`（403），含 `permission` / `mode` 公开字段。

### 13. NotRoleException ✅

- 文件：`src/exceptions/not-role.exception.ts`
- 继承 `ForbiddenException`（403），含 `role` / `mode` 公开字段。

### 14. StpUtil 门面扩展 ✅

- 文件：`src/auth/stp-util.ts`
- 新增：`hasPermission` / `checkPermission` / `hasRole` / `checkRole` / `getSession` / `getOfflineReason`。
- 权限方法正确路由到 `StpPermLogic`（通过 `getStpPermLogic()` 辅助函数）。

### 15. index.ts 导出更新 ✅

- 文件：`src/index.ts`
- 已导出所有 P1 新增 API，interface/type 使用 `export type` 消除构建警告。

### 16. XltAbstractLoginGuard onPermissionDenied 钩子 ✅

- 文件：`src/guards/xlt-abstract-login.guard.ts`
- 已新增可选 `onPermissionDenied` 钩子。

### 17. 单测文件 ✅

- `src/perm/perm-pattern-match.spec.ts` — 15 个用例，全部通过
- `src/perm/stp-perm-logic.spec.ts` — 25 个用例，全部通过
- `src/session/xlt-session.spec.ts` — 14 个用例，全部通过

---

## 二、Bug 修复记录

| # | 文件 | 问题 | 修复 |
| --- | --- | --- | --- |
| 1 | `perm-pattern-match.ts` | `forEach` + `return` 不中断外层 | 改为 `for` 循环 |
| 2 | `perm-pattern-match.ts` | 循环条件 `i <= length` 越界 | 改为 `i < length` |
| 3 | `stp-perm-logic.ts` | `includes` 在 `matchPermission` 前拦截通配符 | 删除 `includes` 行 |
| 4 | `stp-perm-logic.ts` | `checkPermission`/`checkRole` 返回 boolean | 改为 `void`，不通过抛异常 |
| 5 | `xlt-token.guard.ts` | 角色校验用了 `XLT_PERMISSION_KEY` | 改为 `XLT_ROLE_KEY` |
| 6 | `not-permission.exception.ts` | 继承 `UnauthorizedException`（401） | 改为 `ForbiddenException`（403） |
| 7 | `not-role.exception.ts` | 继承 `UnauthorizedException`（401） | 改为 `ForbiddenException`（403） |
| 8 | `stp-util.ts` | 权限方法调 `getStpLogic()` 而非 `StpPermLogic` | 新增 `getStpPermLogic()` 辅助函数 |
| 9 | 多文件 | interface 导出导致 tsdown 构建警告 | 改为 `import type` / `export type` |

---

## 三、构建与测试状态

- 构建：`pnpm build` ✅ 零警告
- P1 单测：54/54 通过 ✅
- P0 已有单测：存在预先存在的问题（`memory-store.spec.ts` 用 jest API、`stp-logic.spec.ts` header key 不匹配），与 P1 无关

---

## 四、总览

| 模块 | 状态 |
| --- | --- |
| StpInterface 接口 | ✅ |
| XltMode / 元数据 Key | ✅ |
| XltTokenConfig P1 字段 | ✅ |
| Module stpInterface 注册 | ✅ |
| 通配符匹配 | ✅ 已修复 |
| StpPermLogic | ✅ 已修复 |
| @XltCheckPermission | ✅ |
| @XltCheckRole | ✅ |
| XltTokenGuard 权限分支 | ✅ 已修复 |
| XltSession | ✅ 含 keys() |
| StpLogic 扩展 | ✅ |
| NotPermissionException | ✅ ForbiddenException |
| NotRoleException | ✅ ForbiddenException |
| StpUtil 门面扩展 | ✅ |
| index.ts 导出 | ✅ type export |
| XltAbstractLoginGuard 钩子 | ✅ onPermissionDenied |
| 单测 | ✅ 54 pass |

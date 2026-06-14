## 1. 修复 JWT 模式下的登出

- [x] 1.1 修复 `StpLogic.logout(token)` 的 JWT 模式分支：解析 JWT 提取 jti，将 jti 加入黑名单，清理会话存储条目
- [x] 1.2 修复 `logoutByLoginId(loginId)` 遍历 `session-list:{loginId}` 中所有设备会话，对每个 jti 加入黑名单（JWT 模式），清理所有设备条目
- [x] 1.3 更新 `stp-logic.jwt.spec.ts`：补充 JWT 模式下 `logout` 和 `logoutByLoginId` 的测试用例

## 2. 新增 `logoutByDevice` 方法

- [x] 2.1 在 `StpLogic` 中实现 `logoutByDevice(loginId, device)`，包含 JWT 和 UUID 两种模式分支，复用 `kickoutByDevice` 结构但语义为自愿登出
- [x] 2.2 在 `logoutByDevice` 中触发 `onLogout` 钩子
- [x] 2.3 在 `multi-device.e2e-spec.ts` 中添加 `logoutByDevice` 的端到端测试

## 3. 新增 `refreshToken` 方法

- [x] 3.1 在 `StpLogic` 中实现 `refreshToken(token, timeout?)`：验证当前 JWT，提取 loginId 和 jti，旧 jti 加入黑名单，生成带新 jti 的 JWT，更新存储条目，返回新 token
- [x] 3.2 在 `stp-logic.jwt.spec.ts` 中添加 `refreshToken` 单元测试（成功刷新、已黑名单 token、过期 token、自定义超时）
- [x] 3.3 在 `jwt.e2e-spec.ts` 中添加 JWT 刷新流程的端到端测试

## 4. 修复 JWT 模式下的 `renewTimeout`

- [x] 4.1 修复 `renewTimeout(token, timeout)` 在 JWT 模式下的逻辑：解析 JWT 获取 loginId，从 session 查找 jti，延长 sessionKey 和 lastActiveKey 的 TTL
- [x] 4.2 更新 `stp-logic.jwt.spec.ts`：将 `renewTimeout` 测试断言从 `null` 改为 `true`

## 5. 修复发布依赖声明

- [x] 5.1 在 `packages/nestjs/package.json` 的 `peerDependencies` 中添加 `"jsonwebtoken": "^9.0.0"`（保留 `peerDependenciesMeta` 中的 optional 标记）
- [x] 5.2 在 `packages/nestjs/package.json` 的 `peerDependencies` 中添加 `"redis": "^4.0.0 || ^5.0.0"`（保留 `peerDependenciesMeta` 中的 optional 标记）
- [x] 5.3 在根 `package.json` 的 `peerDependencies` 中添加 `"jsonwebtoken": "^9.0.0"`（已在 `peerDependenciesMeta` 中）
- [x] 5.4 运行 `pnpm install` 验证依赖解析成功

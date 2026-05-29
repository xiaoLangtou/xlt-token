# 归档文档

本目录存放**非用户向**文档：路线图、架构设计草案、分阶段实施记录、适配器设计等。保留用于历史追溯与贡献者参考，**不纳入 VitePress 在线文档**。

使用 xlt-token 请以上级目录 [用户文档](../README.md) 为准。

## 目录结构

```
archive/
├── README.md                          # 本文件
├── 10-roadmap-1.1.0.md                # 1.1.0 功能规划（已实现）
├── 12-multi-framework-architecture.md # 2.0 多框架适配架构方案
├── 13-1.1.0-implementation-design.md  # 1.1.0 实现设计摘要
├── core-extraction-implementation.md  # Phase 1：@xlt-token/core 抽离
├── nestjs-adapter-implementation.md   # Phase 2：@xlt-token/nestjs 适配
└── express-adapter/                   # Phase 3：Express 适配器设计（分文件）
```

## 文件清单

| 文件 / 目录 | 用途 | 状态 |
| --- | --- | --- |
| `10-roadmap-1.1.0.md` | 1.1.0 四大方向规划 | ✅ 已实现，用户文档见 [多端登录](../14-multi-device.md) 等 |
| `13-1.1.0-implementation-design.md` | 1.1.0 实施摘要 | ✅ 归档 |
| `12-multi-framework-architecture.md` | 2.0 多框架「核心 + 适配器」总方案 | Phase 1/2 完成，Phase 3 进行中 |
| `core-extraction-implementation.md` | core 包抽离任务分解 | ✅ Phase 1 完成 |
| `nestjs-adapter-implementation.md` | nestjs 包适配任务分解 | ✅ Phase 2 完成 |
| `express-adapter/` | Express L2/L3 适配器详细设计 | 📋 Phase 3 规划 |

## 早期归档（历史）

以下文件若存在于本目录，为更早期的规划 / 快照，内容与当前实现可能有差异：

| 文件 | 说明 |
| --- | --- |
| `00-roadmap.md` | 项目总体规划（已 superseded） |
| `03-integration.md` | 旧鉴权迁移方案 |
| `04-status.md` | 2026-04 现状快照 |
| `05-npm-package.md` | npm 包抽离记录 |
| `10-roadmap-p1.md` | P1 权限与会话路线图 → 见 [权限与会话](../11-permissions-and-session.md) |
| `p1-implementation-design.md` | P1 实施设计 |
| `p1-progress-checklist.md` | P1 进度清单 |
| `e2e-testing-plan.md` | E2E 测试计划 |

## 关联

- 用户向架构概览：[架构设计](../02-architecture.md)
- 用户向迁移说明：[2.0 迁移指南](../migration-2.0.md)

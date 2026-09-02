---
title: xlt-token LLMs.txt 指南
description: 了解 xlt-token 为 AI 编码代理提供的 llms.txt 项目入口，以及推荐阅读路径和验证命令。
---

# LLMs.txt

`llms.txt` 是给 AI 编码代理使用的项目入口文件。它应该简短、稳定，并回答三个问题：

- 这个项目是什么？
- 代理应该优先读哪些文件？
- 修改代码后应该怎么验证？

## 当前入口

本项目已经提供根目录入口：

- 仓库文件：[`llms.txt`](https://github.com/xiaoLangtou/xlt-token/blob/master/llms.txt)
- GitHub Raw：[`raw.githubusercontent.com/xiaoLangtou/xlt-token/refs/heads/master/llms.txt`](https://raw.githubusercontent.com/xiaoLangtou/xlt-token/refs/heads/master/llms.txt)

文档站也会发布一份静态副本：

- 文档站：[`/llms.txt`](/llms.txt)

## 维护原则

- 只放稳定事实，不放临时计划。
- 优先列公共 API、包边界、测试命令和文档入口。
- 公共 API 或包职责变化时同步更新。
- 不把完整 API 文档复制进去，详细内容交给 `docs/`。

## 推荐阅读顺序

AI 编码代理进入项目后，建议按这个顺序读取：

1. `llms.txt`
2. `docs/README.md`
3. `docs/SRC-REFERENCE.md`
4. 与任务相关的包入口，例如 `packages/core/src/index.ts`
5. 对应测试文件和示例

## 更新检查

修改这些内容后应检查 `llms.txt` 是否需要同步：

- 新增包或适配器
- 改动公共导出
- 改动鉴权语义
- 调整构建、测试或发布命令
- 新增关键文档页

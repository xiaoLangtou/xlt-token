## 1. 修复 RedisStore keys() cursor 类型

- [x] 1.1 初始化 cursor 从 `let cursor = 0` 改为 `let cursor = "0"`，满足 `RedisArgument = string | Buffer` 类型要求
- [x] 1.2 `reply.cursor` 返回值是 `Buffer`，需用 `String(reply.cursor)` 转为字符串后再与 `"0"` 比较

## Context

`RedisStore.keys()` uses `@redis/client` (via the `redis` npm package) SCAN command. Two bugs:

1. **Cursor type mismatch**: `@redis/client` expects `RedisArgument = string | Buffer` for the cursor argument, but the code passes a `number` (`let cursor = 0`). The internal parser stores it as-is in `#redisArgs`, and subsequent serialization fails with `"arguments[1]" must be of type "string | Buffer", got number instead`.

2. **Infinite loop**: `reply.cursor` from `@redis/client`'s `transformReply` returns a `Buffer` (blob string). The comparison `cursor !== 0` between a `Buffer` and a `number` is always `true`, so the loop never terminates.

## Goals / Non-Goals

**Goals:**
- `keys()` works correctly with `redis` npm package ^5.0.0 and ^6.0.0
- No infinite loop even when `reply.cursor` is a `Buffer`

**Non-Goals:**
- No changes to other methods (they accept `number` for `timeoutSec` parameters, which is a separate code path)
- No Redis client type improvements

## Decisions

1. **Cursor initialization**: Change `let cursor = 0` to `let cursor = "0"` — a string matches the `RedisArgument` type and works with both `string` and `Buffer` comparisons.

2. **Loop condition**: Change `while (cursor !== 0)` to `while (cursor !== "0")`. Since `reply.cursor` is `BlobStringReply<string>` which has a `toString()` method, and `"0"` is a plain string, the comparison works correctly — `Buffer("0") !== "0"` is still `true` in JS. To handle Buffer responses robustly, convert `reply.cursor` to string explicitly.

3. **Explicit string conversion**: Add `String(reply.cursor)` to normalize the Buffer/string return from `transformReply` before comparison.

## Risks / Trade-offs

- No risk: fixing a broken code path that currently either crashes or infinite-loops.

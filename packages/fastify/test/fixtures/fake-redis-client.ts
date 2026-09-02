/**
 * 最小可用的 Redis client 仿真（node-redis v4 命令形态），
 * 用于在无真实 Redis 服务的环境下运行 Fastify 适配器的 Redis Store E2E。
 * 覆盖 RedisStore 使用到的命令：get / set / del / ttl / expire / persist / eval / scan。
 */
export function createFakeRedisClient() {
  const values = new Map<string, { value: string; ttl: number }>();

  return {
    get: async (key: string) => values.get(key)?.value ?? null,
    set: async (key: string, value: string, options?: { NX?: boolean; EX?: number }) => {
      if (options?.NX && values.has(key)) return null;
      values.set(key, { value, ttl: options?.EX ?? -1 });
      return "OK";
    },
    del: async (key: string) => (values.delete(key) ? 1 : 0),
    exists: async (key: string) => (values.has(key) ? 1 : 0),
    persist: async (key: string) => {
      const entry = values.get(key);
      if (!entry || entry.ttl === -1) return 0;
      entry.ttl = -1;
      return 1;
    },
    expire: async (key: string, seconds: number) => {
      const entry = values.get(key);
      if (!entry) return 0;
      entry.ttl = seconds;
      return 1;
    },
    ttl: async (key: string) => values.get(key)?.ttl ?? -2,
    scan: async () => ({ cursor: 0, keys: [...values.keys()] }),
    eval: async (
      _script: string,
      options: { keys: string[]; arguments: string[] },
    ): Promise<unknown> => {
      const [key] = options.keys;
      const entry = values.get(key);

      // GET_AND_DELETE_SCRIPT：读取并原子删除
      if (options.arguments.length === 0) {
        if (!entry) return null;
        values.delete(key);
        return [entry.value, entry.ttl];
      }

      // TOUCH_SCRIPT：保留值更新 TTL
      if (options.arguments.length === 2) {
        if (!entry) return 0;
        const [mode, ttlSeconds] = options.arguments;
        entry.ttl = mode === "persistent" ? -1 : Number(ttlSeconds);
        return 1;
      }

      // CAS_SCRIPT：compareAndSet / compareAndDelete
      const [expected, nextValue, mode, ttlSeconds] = options.arguments;
      if (!entry || entry.value !== expected) return 0;
      if (mode === "delete") {
        values.delete(key);
        return 1;
      }
      values.set(key, {
        value: nextValue,
        ttl: mode === "keep" ? entry.ttl : mode === "persistent" ? -1 : Number(ttlSeconds),
      });
      return 1;
    },
  };
}

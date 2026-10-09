import {
  createXltInstance,
  MemoryStore,
  type StpInterface,
  type XltInstance,
} from "@xlt-token/core";
import { createEventBufferSink } from "@xlt-token/inspector";
import { createJwtStrategyConfig, JwtStrategy } from "@xlt-token/jwt";
import { composeEventSinks, createLoggerEventSink } from "@xlt-token/observability";
import { RedisStore } from "@xlt-token/store-redis";

/** 监控台事件缓冲（@xlt-token/inspector） */
export const inspectorEventBuffer = createEventBufferSink();

export type StoreKind = "memory" | "redis";
export type StrategyKind = "uuid" | "jwt";

/**
 * 环境变量开关（均有默认值，开箱即可跑）：
 * - XLT_STRATEGY=uuid|jwt       Token 策略，默认 uuid
 * - XLT_STORE=memory|redis      存储后端，默认 memory
 * - XLT_IS_READ_COOKIE=true     开启 Cookie Token 来源（依赖 @fastify/cookie）
 * - REDIS_URL                   Redis 连接地址，默认 redis://127.0.0.1:6379
 * - JWT_SECRET                  JWT 签名密钥（HS256 至少 32 字节）
 * - PORT                        监听端口，默认 3000
 */
export const exampleConfig = {
  port: Number(process.env.PORT ?? 3000),
  store: (process.env.XLT_STORE === "redis" ? "redis" : "memory") as StoreKind,
  strategy: (process.env.XLT_STRATEGY === "jwt" ? "jwt" : "uuid") as StrategyKind,
  isReadCookie: process.env.XLT_IS_READ_COOKIE === "true",
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  jwtSecret: process.env.JWT_SECRET ?? "example-jwt-secret-change-me-at-least-32-bytes",
};

/**
 * 权限 / 角色数据源（业务侧提供）：
 * - 1001：user:read、order:read、order:write 权限 + admin 角色
 * - 2002：ops 角色（用于 OR 模式演示）
 */
const stpInterface: StpInterface = {
  getPermissionList: async (loginId) =>
    loginId === "1001" ? ["user:read", "order:read", "order:write"] : [],
  getRoleList: async (loginId) =>
    loginId === "1001" ? ["admin"] : loginId === "2002" ? ["ops"] : [],
};

export async function createExampleInstance(): Promise<XltInstance> {
  const store = exampleConfig.store === "redis" ? await createRedisStore() : new MemoryStore();

  const strategy =
    exampleConfig.strategy === "jwt"
      ? new JwtStrategy(
          createJwtStrategyConfig({
            activeKid: "example-active",
            keys: [{ kid: "example-active", algorithm: "HS256", secret: exampleConfig.jwtSecret }],
            issuer: "xlt-token-fastify-example",
          }),
        )
      : undefined;

  const instance = createXltInstance({
    config: {
      tokenName: "authorization",
      tokenPrefix: "Bearer ",
      timeout: 7 * 24 * 60 * 60,
      activeTimeout: 2 * 60 * 60,
      isReadCookie: exampleConfig.isReadCookie,
    },
    store,
    ...(strategy ? { strategy } : {}),
    stpInterface,
    // 官方导出器组合：inspector 事件缓冲（监控台）+ 结构化 JSON 日志
    eventSink: composeEventSinks([inspectorEventBuffer.sink, createLoggerEventSink()]),
  });

  console.log(
    `[xlt] instance ready: store=${exampleConfig.store}, strategy=${exampleConfig.strategy}, cookie=${exampleConfig.isReadCookie}`,
  );
  return instance;
}

async function createRedisStore(): Promise<RedisStore> {
  const { createClient } = await import("redis");
  const client = createClient({ url: exampleConfig.redisUrl });
  client.on("error", (err) => console.error("[redis]", err));
  await client.connect();
  console.log(`[redis] connected: ${exampleConfig.redisUrl}`);
  return new RedisStore(client);
}

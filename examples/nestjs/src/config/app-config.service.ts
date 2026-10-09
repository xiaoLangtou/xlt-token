import { Injectable } from "@nestjs/common";
import {
  createJwtStrategyConfig,
  JwtStrategy,
  RedisStore,
  XLT_REDIS_CLIENT,
  type XltTokenModuleAsyncOptions,
} from "@xlt-token/nestjs";
import { createLoggerEventSink } from "@xlt-token/observability";
import { composeEventSinks } from "@xlt-token/observability";
import { DemoStpInterface } from "../stp/demo-stp-interface";
import { demoEventBuffer } from "./event-buffer";

export type StoreKind = "memory" | "redis";
export type StrategyKind = "uuid" | "jwt";

@Injectable()
export class AppConfigService {
  readonly port = Number(process.env.PORT ?? 3000);
  readonly defaultCheck = process.env.XLT_DEFAULT_CHECK !== "false";
  readonly store: StoreKind = process.env.XLT_STORE === "redis" ? "redis" : "memory";
  readonly strategy: StrategyKind = process.env.XLT_STRATEGY === "jwt" ? "jwt" : "uuid";
  readonly redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  readonly jwtSecret = process.env.JWT_SECRET ?? "example-jwt-secret-change-me-at-least-32-bytes";

  /** forRootAsync useFactory 仅返回 config；其余项见 buildAsyncModuleOptions */
  getTokenConfig() {
    const config = {
      tokenName: "authorization",
      tokenPrefix: "Bearer ",
      timeout: 7 * 24 * 60 * 60,
      activeTimeout: 2 * 60 * 60,
      defaultCheck: this.defaultCheck,
      deviceConcurrent: true,
      isConcurrent: true,
      isShare: false,
    } as Record<string, unknown>;
    return config;
  }
}

/** 在模块装饰器阶段读取 env，组装 forRootAsync 顶层选项 */
export function buildAsyncModuleOptions(): Pick<
  XltTokenModuleAsyncOptions,
  "stpInterface" | "eventSink" | "store" | "strategy" | "providers" | "isGlobal"
> {
  const cfg = new AppConfigService();
  const options: Pick<
    XltTokenModuleAsyncOptions,
    "stpInterface" | "eventSink" | "store" | "strategy" | "providers" | "isGlobal"
  > = {
    isGlobal: true,
    stpInterface: DemoStpInterface,
    // 官方导出器组合：inspector 事件缓冲（监控台）+ 结构化 JSON 日志
    eventSink: composeEventSinks([demoEventBuffer.sink, createLoggerEventSink()]),
  };

  if (cfg.strategy === "jwt") {
    options.strategy = {
      useValue: new JwtStrategy(
        createJwtStrategyConfig({
          activeKid: "example-active",
          keys: [{ kid: "example-active", algorithm: "HS256", secret: cfg.jwtSecret }],
          issuer: "xlt-token-example",
        }),
      ),
    };
  }

  if (cfg.store === "redis") {
    options.store = { useClass: RedisStore };
    options.providers = [
      {
        provide: XLT_REDIS_CLIENT,
        useFactory: async () => {
          const { createClient } = await import("redis");
          const client = createClient({ url: cfg.redisUrl });
          client.on("error", (err) => console.error("[redis]", err));
          await client.connect();
          console.log(`[redis] connected: ${cfg.redisUrl}`);
          return client;
        },
      },
    ];
  }

  return options;
}

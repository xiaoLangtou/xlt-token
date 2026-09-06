import type { ModuleMetadata, Provider } from "@nestjs/common";
import { Module } from "@nestjs/common";
import type {
  StpInterface,
  TokenStrategy,
  XltEventSink,
  XltTokenConfig,
  XltTokenConfigInput,
  XltTokenStore,
} from "@xlt-token/core";
import {
  MemoryStore,
  setStpLogic,
  setStpPermLogic,
  StpLogic,
  StpPermLogic,
  UuidStrategy,
  XLT_STP_INTERFACE,
  XLT_EVENT_SINK,
  XLT_TOKEN_CONFIG,
  XLT_TOKEN_STORE,
  XLT_TOKEN_STRATEGY,
  normalizeXltTokenConfig,
} from "@xlt-token/core";

export interface XltTokenModuleOptions {
  config?: Partial<XltTokenConfigInput>;
  store?: { useClass: new (...args: any[]) => XltTokenStore } | { useValue: XltTokenStore };
  strategy?: { useClass: new (...args: any[]) => TokenStrategy } | { useValue: TokenStrategy };
  isGlobal?: boolean;
  providers?: Provider[];
  stpInterface?: new (...args: any[]) => StpInterface;
  eventSink?: XltEventSink;
}

export interface XltTokenModuleAsyncOptions extends Pick<ModuleMetadata, "imports"> {
  useFactory: (
    ...args: any[]
  ) => Promise<Pick<XltTokenModuleOptions, "config">> | Pick<XltTokenModuleOptions, "config">;
  inject?: any[];
  store?: { useClass: new (...args: any[]) => XltTokenStore } | { useValue: XltTokenStore };
  strategy?: { useClass: new (...args: any[]) => TokenStrategy } | { useValue: TokenStrategy };
  isGlobal?: boolean;
  providers?: Provider[];
  stpInterface?: new (...args: any[]) => StpInterface;
  eventSink?: XltEventSink;
}

@Module({})
export class XltTokenModule {
  private static readonly stpLogicProvider: Provider = {
    provide: StpLogic,
    useFactory: (
      config: XltTokenConfig,
      store: XltTokenStore,
      strategy: TokenStrategy,
      eventSink: XltEventSink,
    ) => new StpLogic(config, store, strategy, eventSink),
    inject: [XLT_TOKEN_CONFIG, XLT_TOKEN_STORE, XLT_TOKEN_STRATEGY, XLT_EVENT_SINK],
  };
  private static readonly stpPermLogicProvider: Provider = {
    provide: StpPermLogic,
    useFactory: (stpInterface: StpInterface, store: XltTokenStore, config: XltTokenConfig) =>
      new StpPermLogic(stpInterface, store, config),
    inject: [XLT_STP_INTERFACE, XLT_TOKEN_STORE, XLT_TOKEN_CONFIG],
  };
  private static readonly initProvider: Provider = {
    provide: "XLT_TOKEN_INIT",
    useFactory: (stpLogic: StpLogic, stpPermLogic: StpPermLogic) => {
      setStpLogic(stpLogic);
      setStpPermLogic(stpPermLogic);
      return true;
    },
    inject: [StpLogic, StpPermLogic],
  };
  private static readonly moduleExports = [
    XLT_TOKEN_CONFIG,
    XLT_TOKEN_STORE,
    XLT_TOKEN_STRATEGY,
    StpLogic,
    StpPermLogic,
  ];

  static forRoot(options: XltTokenModuleOptions = {}) {
    const {
      config: userConfig,
      store,
      strategy,
      isGlobal = false,
      providers = [],
      stpInterface,
    } = options;

    return {
      module: XltTokenModule,
      providers: [
        { provide: XLT_TOKEN_CONFIG, useValue: normalizeXltTokenConfig(userConfig) },
        XltTokenModule.createStoreProvider(store),
        XltTokenModule.createStrategyProvider(strategy),
        XltTokenModule.createStpInterfaceProvider(stpInterface),
        XltTokenModule.createEventSinkProvider(options.eventSink),
        XltTokenModule.stpLogicProvider,
        XltTokenModule.stpPermLogicProvider,
        XltTokenModule.initProvider,
        ...providers,
      ],
      exports: XltTokenModule.moduleExports,
      global: isGlobal,
    };
  }

  static forRootAsync(options: XltTokenModuleAsyncOptions) {
    const {
      useFactory,
      inject = [],
      imports = [],
      store,
      strategy,
      isGlobal = false,
      providers = [],
      stpInterface,
    } = options;

    return {
      module: XltTokenModule,
      imports,
      providers: [
        {
          provide: XLT_TOKEN_CONFIG,
          useFactory: async (...args: any[]) => {
            const { config = {} } = await useFactory(...args);
            return normalizeXltTokenConfig(config);
          },
          inject,
        },
        XltTokenModule.createStoreProvider(store),
        XltTokenModule.createStrategyProvider(strategy),
        XltTokenModule.createStpInterfaceProvider(stpInterface),
        XltTokenModule.createEventSinkProvider(options.eventSink),
        XltTokenModule.stpLogicProvider,
        XltTokenModule.stpPermLogicProvider,
        XltTokenModule.initProvider,
        ...providers,
      ],
      exports: XltTokenModule.moduleExports,
      global: isGlobal,
    };
  }

  private static createStoreProvider(store?: XltTokenModuleOptions["store"]): Provider {
    if (!store) return { provide: XLT_TOKEN_STORE, useClass: MemoryStore };
    return "useClass" in store
      ? { provide: XLT_TOKEN_STORE, useClass: store.useClass }
      : { provide: XLT_TOKEN_STORE, useValue: store.useValue };
  }

  private static createStrategyProvider(strategy?: XltTokenModuleOptions["strategy"]): Provider {
    if (!strategy) return { provide: XLT_TOKEN_STRATEGY, useClass: UuidStrategy };
    return "useClass" in strategy
      ? { provide: XLT_TOKEN_STRATEGY, useClass: strategy.useClass }
      : { provide: XLT_TOKEN_STRATEGY, useValue: strategy.useValue };
  }

  private static createStpInterfaceProvider(
    stpInterface?: new (...args: any[]) => StpInterface,
  ): Provider {
    if (stpInterface) return { provide: XLT_STP_INTERFACE, useClass: stpInterface };
    return {
      provide: XLT_STP_INTERFACE,
      useValue: {
        getPermissionList: () => {
          throw new Error("StpInterface not registered: getPermissionList");
        },
        getRoleList: () => {
          throw new Error("StpInterface not registered: getRoleList");
        },
      },
    };
  }

  private static createEventSinkProvider(eventSink?: XltTokenModuleOptions["eventSink"]): Provider {
    return { provide: XLT_EVENT_SINK, useValue: eventSink ?? {} };
  }
}
